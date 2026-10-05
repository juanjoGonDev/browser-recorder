validator unavailable (gentle-ai 3.7.0); persisted by orchestrator override

```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:06cfedd8e843961b9ae93c49db76ab705225604c879096942fcd5e1aa9181484
verdict: fail
blockers: 2
critical_findings: 2
requirements: 31/35
scenarios: 58/61
test_command: pnpm quality && pnpm test:coverage
test_exit_code: 0
test_output_hash: sha256:5b9ff8291903014d4783ee4f09d6b9c3022231a4185e101d392d177f821ea0e2
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:3d9d1fc6d069e8da62b48e835e08791a3a23db8fc7bb6a716dfd80cc68d1e0bb
```

## Verification Report

**Change**: browser-engine-and-profiles
**Version**: N/A (delta specs, 9 capabilities)
**Mode**: Strict TDD
**Candidate**: HEAD `e5534f7` on `feat/bootstrap-browser-recorder`, clean worktree
**Evidence revision**: sha256 of the HEAD tree id plus the four gate logs

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 55 |
| Tasks complete | 55 |
| Tasks incomplete | 0 |

### Build & Tests Execution (all headless; opt-in real-browser suite NOT run; no real profile touched)
| Gate | Exit | Result | Output sha256 |
|------|------|--------|---------------|
| `pnpm quality` (typecheck x3, eslint --max-warnings 0, prettier, knip, depcruise, vitest) | 0 | 157 files passed, 1 skipped; 1885 tests passed, 6 skipped | 5b9ff829...a0e2 |
| `pnpm test:coverage` | 0 | 1885 passed, 6 skipped; thresholds met | 1d5c39a4...e43e2 |
| `pnpm build` | 0 | built | 3d9d1fc6...e0bb |
| `pnpm audit` | 0 | No known vulnerabilities found | 185f7eef...2deb |

Skipped tests (6): `tests/integration/real-browser/real-browser.test.ts` (4, gated on `BROWSER_RECORDER_REAL_BROWSER_TESTS=1`) and 2 opt-in headed-dialog checks (gated on `BROWSER_RECORDER_HEADED_TESTS=1`). Both variables were unset.

**Coverage**: 97.36 % statements / 93.4 % branches / 97.61 % functions / 98.24 % lines. Above the configured thresholds.

### Bootstrap hard requirements (re-checked)
| Requirement | Result | Evidence |
|---|---|---|
| No main-world code in recording | Holds | Capture uses `Page.createIsolatedWorld` + `Runtime.evaluate({contextId})` in `isolated-world-capture.ts`; no `addInitScript`/`exposeBinding`/`page.evaluate` in `src` |
| No main-world code in generated replay | Holds | Prelude uses only `Page.createIsolatedWorld` + `Runtime.callFunctionOn`; `generated-script.test.ts` "runs nothing in the main world" passes (light DOM and shadow trees) |
| Tests headless only | Holds | No `headless: false` outside the lint fixture; headed tests opt-in and skipped |
| Zero vulnerabilities | Holds | `pnpm audit` clean |
| Exact pins | Holds | `dependency-pins.test.ts`; `patchright: 1.63.0` is the only runtime dependency; `onlyBuiltDependencies: ["lefthook"]` |
| Strict lint / knip / depcruise | Holds | All pass inside `pnpm quality` |

### User requirements for this change
| Requirement | Result | Evidence |
|---|---|---|
| Patchright replaces Playwright everywhere | Holds | No `playwright` import in `src`/`scripts`/`tests` (only a v1 script fixture string in an e2e test); not in `package.json` or lockfile; not resolvable from the repo; depcruise `no-playwright` + ESLint `no-restricted-imports` |
| No `Runtime.enable` / `Console.enable` from our CDP sessions | Holds | `guardCdp` wraps every session (`guarded-session.ts` is the only `newCDPSession` caller in the recorder); `cdp-method-audit.test.ts` (same-origin, cross-origin OOPIF, navigation, dialog, scroll) asserts neither was sent nor attempted; lint rule on the literals; prelude text scan |
| Persistent managed profile keeps logins | Holds | `managed-profile-login.test.ts`, `tests/e2e/managed-profile-roundtrip.test.ts` (login survives second recording and replay) |
| Optional copy-of-real (Brave included), original never modified | Holds | `copy-profile.test.ts`, `profile-store-on-fixture.test.ts` (tree hash and mtimes unchanged after success and after refusals); destinations guarded inside `profiles/*/sessions/` |
| TUI picker of detected browsers and profile modes | Holds (see W3) | `tui-controller.test.ts`, `menu-setup-form-screens.test.ts`, `browser-views.test.ts` |
| Recordings remember browser/profile; replay reuses them with fallback warning | Holds for replay | `recording-session.test.ts`, `create-app-services.test.ts` (four env vars, fallback warning), `timeline-replay-screens.test.ts` |

### Spec Compliance Matrix
| Capability / Requirement | Scenario | Test | Result |
|---|---|---|---|
| browser-profiles / Managed profile | First use | `node-adapters.test.ts > creates nested directories with mode 0700`; `profile-store.test.ts > creates the directory privately on first use` | COMPLIANT |
| | Reuse | `profile-store.test.ts > reuses the same directory...`; `managed-profile-roundtrip.test.ts > keeps a login...` | COMPLIANT |
| | Per browser | `profile-store.test.ts > keeps one directory per browser` | COMPLIANT |
| browser-profiles / Ephemeral | Cleanup | `profile-store.test.ts > gives a fresh private directory and deletes it on release`; `create-app-services.test.ts > releases the profile when the browser fails to launch` | COMPLIANT |
| browser-profiles / Real profile listing | Multiple profiles | `parse-local-state.test.ts > follows profiles_order...Default first`; `profile-store-on-fixture.test.ts > lists the profiles` | COMPLIANT |
| | Unreadable Local State | `profile-store.test.ts > returns null and writes nothing...`; `parse-local-state.test.ts > describes why...rejected` | COMPLIANT |
| browser-profiles / Copy of real | WAL sibling | `copy-profile.test.ts > copies Local State, the profile and its WAL sibling byte for byte` | COMPLIANT |
| | Torn read | `copy-profile.test.ts > retries a torn read and ends with the final bytes` | COMPLIANT |
| | Running browser | `profile-store.test.ts > warns that the snapshot may be stale while the browser runs` | COMPLIANT |
| | Skipped entries | `copy-profile.test.ts > skips locks, caches, transient files, symlinks...` | COMPLIANT |
| browser-profiles / Read-only source | Hash unchanged | `profile-store-on-fixture.test.ts > copies a profile, leaving the source tree byte and mtime identical` | COMPLIANT |
| browser-profiles / Lock detection | Locked managed profile | `profile-store.test.ts > refuses a profile locked by a live process`; `create-app-services.test.ts > rejects a locked profile...leaves no entry` | COMPLIANT |
| | Stale lock | `check-profile-lock.test.ts > ignores a stale lock whose owner is gone` | COMPLIANT |
| browser-profiles / Encryption failure reporting (SHOULD) | Unreadable cookies | `profile-store.test.ts > warns about app-bound encryption on Windows only` (pre-launch warning only) | PARTIAL |
| browser-selection / Catalogue | macOS Brave | `browser-catalog.test.ts > lists an installed macOS Brave...` | COMPLIANT |
| | Windows paths | `browser-catalog.test.ts > expands Windows templates and handles spaces` | COMPLIANT |
| | Linux paths | `browser-catalog-table.test.ts`, `browser-catalog.test.ts > keeps table order...` | COMPLIANT |
| browser-selection / Bundled always | Nothing installed | `browser-catalog.test.ts > lists exactly the bundled browser when nothing is installed` | COMPLIANT |
| browser-selection / Fallback with warning | Recorded Brave missing | `resolve-replay-browser.test.ts > falls back to bundled and names the missing browser`; `browser-launch-plan.test.ts` | COMPLIANT |
| | Installed browser | `resolve-replay-browser.test.ts > keeps the recorded choice when the browser is installed` | COMPLIANT |
| browser-selection / Unknown id | Unknown id | `resolve-replay-browser.test.ts > treats an id outside the catalogue as missing` | COMPLIANT |
| environment-setup / Chromium detection | Present | `ensure-browser.test.ts > does not install when Chromium is present` | COMPLIANT |
| | Missing | `ensure-browser.test.ts > announces the missing browser before it installs` | COMPLIANT |
| | System browser only | `menu-setup-form-screens.test.ts > offers the detected browsers when only the bundled one failed`; `app-reducer.test.ts > stays available after a failed install when another browser was detected` | COMPLIANT |
| environment-setup / Automatic install | Success | `ensure-browser.test.ts > ...then re-checks` | COMPLIANT |
| | Failure | `ensure-browser.test.ts > fails with the manual command on a non-zero exit`, `> fails when the installer exited 0 but Chromium is still absent` | COMPLIANT |
| | Offline | `ensure-browser.test.ts > does not crash when the installer cannot even start (offline)`; `keymap.test.ts > opens the main menu from a failed setup only when another browser exists` | COMPLIANT |
| environment-setup / Linux deps | Missing libs | `linux-deps-hint.test.ts` | COMPLIANT |
| recording-capture / Patchright persistent context | Stored browser | `patchright-browser-launcher.test.ts > launches the stored browser's executable on the managed directory with a real window` | COMPLIANT |
| | Fallback | `browser-launch-plan.test.ts > refuses a browser that is not installed and prepares nothing` asserts the OPPOSITE behaviour | FAILING (contradicted) |
| recording-capture / No leaking CDP domains | Protocol trace | `cdp-method-audit.test.ts` (6 tests) | COMPLIANT |
| recording-capture / Stores browser and mode | Saved fields | `recording-session.test.ts > holds the browser and the profile mode of the choice`, `> never stores a path...` | COMPLIANT |
| recording-capture / Locked at start | Locked | `recording-session.test.ts > creates no recording and reports the lock error itself`; `patchright-browser-launcher.test.ts > reports a profile held by another browser as a lock error` | COMPLIANT |
| replay / Recorded browser and profile | Stored browser | `create-app-services.test.ts > sets the four browser variables for the stored browser`; `replay-runner.test.ts > hands over the four browser variables verbatim` | COMPLIANT |
| | Legacy recording | `managed-profile-roundtrip.test.ts > replays a version 1 recording after regenerating its script` | COMPLIANT |
| replay / Fallback reported | Missing browser | `create-app-services.test.ts > warns on the live replay when the recorded browser is missing` | COMPLIANT |
| replay / Lock reported | Locked | `create-app-services.test.ts > rejects a locked profile with a message and spawns nothing` | COMPLIANT |
| repository-quality / Dependency hygiene | Audit | `pnpm audit` exit 0 | COMPLIANT |
| | Range detected | `dependency-pins.test.ts > reports caret, tilde and range specifiers` | COMPLIANT |
| | Playwright reintroduced | `dependency-pins.test.ts` (3 names), `depcruise-rules.test.ts`, `eslint-rules.test.ts` | COMPLIANT |
| repository-quality / CDP leak lint | Forbidden call | `eslint-rules.test.ts > reports each forbidden CDP method with the offending name` | COMPLIANT |
| repository-quality / Opt-in real-browser tests | Default run | real-browser suite skipped in this run; `isolated-home.test.ts` (4); `real-browser.test.ts` guards | COMPLIANT |
| repository-quality / Dependency direction | Layer violation | `depcruise-rules.test.ts > rejects an adapter import from a browser-profiles / browser-selection domain module` | COMPLIANT |
| script-generation / Plain Patchright ESM | Runnable | `generate-script.test.ts` (it.each over CASES), goldens | COMPLIANT |
| | Deterministic | `generate-script.test.ts` (it.each over CASES) | COMPLIANT |
| script-generation / Event mapping | Multi-tab | `generate-script.test.ts` + `multi-tab.mjs` golden; `generated-script.test.ts > handles a recorded dialog and a popup tab` | COMPLIANT |
| | Unknown event type | `generate-script.test.ts > throws naming the unsupported type and index` | COMPLIANT |
| script-generation / Launch recorded browser | Managed Brave | `brave-managed.mjs` golden; `script-prelude.test.ts > launches a persistent context from the four environment variables` | COMPLIANT |
| | Ephemeral | `script-prelude.test.ts > removes the temporary profile...`, `> treats empty variables as unset` | COMPLIANT |
| | Copy of real | `browser-launch-plan.test.ts > carries the arguments and the real keychain of a copied profile`; prelude accepts only `--profile-directory=` | COMPLIANT |
| script-generation / Old recordings | Legacy recording | `generate-script.test.ts > reads as bundled and ephemeral for a recording migrated from version 1`; `legacy-emulated.mjs` | COMPLIANT |
| script-library / Browser fields | Round trip | `library-service.test.ts > keeps the browser, the mode and the source profile through a save` | COMPLIANT |
| script-library / Old recordings | Legacy file | `library-service.test.ts > loads a version 1 file as bundled and ephemeral without touching its bytes` | COMPLIANT |
| script-library / Invalid browser fields | Bad mode | `library-service.test.ts > lists an unknown profile mode as invalid and still returns the valid ones` | COMPLIANT |
| script-library / Browser immutable | Rename | `library-service.test.ts > keeps the browser and the mode of the recording` | COMPLIANT |
| tui / Create flow | Invalid URL | `tui-controller.test.ts > shows an inline error and does not start for an ftp URL` | COMPLIANT |
| | Empty URL | `tui-controller.test.ts > starts on a blank page when the URL is empty` | COMPLIANT |
| | Pickers | `tui-controller.test.ts > starts with the browser and profile the user picked` (Brave + copy of `Default` only; Chrome and `Profile 2` not exercised) | PARTIAL |
| | Only bundled | `tui-controller.test.ts > preselects the bundled browser when it is the only one`; `menu-setup-form-screens.test.ts` | COMPLIANT |
| tui / Lock and fallback messages | Locked profile | `tui-controller.test.ts > shows a locked profile inline and keeps the library usable` | COMPLIANT |
| | Fallback warning | `timeline-replay-screens.test.ts > shows the fallback warning with the missing browser name`; `tui-controller.test.ts > shows the recorded browser and the fallback warning` | COMPLIANT |

**Compliance summary**: 58/61 scenarios compliant (1 FAILING, 2 PARTIAL); 31/35 requirements fully compliant (Patchright persistent context, Copy of real text, Encryption reporting, Create flow are not).

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|---|---|---|
| Copy of real profile | Deviates in text | Spec says MUST copy `-shm`; code (and design) deny-list `-shm` (`copy-filter.ts:49`). Safer choice, but spec drift |
| Recording fallback | Not implemented | `createLaunchPlanner.forRecording` throws "`<Browser>` is not installed on this machine." (`src/composition/browser-launch-plan.ts`) |
| Encryption failure reporting (SHOULD) | Partial | Only a pre-launch win32 `app-bound-encryption` warning; no post-launch detection |
| All other requirements | Implemented | See matrix |

### Coherence (Design)
| Decision | Followed? | Notes |
|---|---|---|
| S0 transport (b), per-frame injection, no document-start script | Yes | `isolated-world-capture.ts`, `world-contexts.ts`; audit asserts no document-start script |
| `guardCdp` on every recorder session | Yes | `guarded-session.ts` is the single `newCDPSession` caller |
| `launchPersistentContext`, `viewport: null` + `--window-size`, 30 s timeout, keychain switches ignored only for copy-of-real | Yes | `launch-arguments.ts`, launcher, prelude parity golden |
| Env-var hand-off (four variables, empty = unset) | Yes | `toReplayEnvironment`; prelude accepts only `--profile-directory=` |
| Fresh copy per launch in `sessions/`, swept at startup | Yes | `profile-store.ts`, `sweepStaleSessions` |
| Lock probe first, `ProfileInUseError` mapping | Yes | `check-profile-lock.ts`, `is-profile-in-use-error.ts` |
| `sourceProfile` revalidated against `SAFE_PROFILE_DIR` + `Local State` | Yes | `copy-profile.test.ts` hostile names |
| Opera without copy-of-real | Yes | `userDataDir: null` |
| `regenerateScript` before every replay; v1 file untouched | Yes | e2e + library tests |
| Tooling (depcruise, ESLint, isolated-home, CI install) | Yes | all gates green |
| Copy denylist incl. `-shm` | Yes (design) | Conflicts with spec text (W1) |
| Open question: Windows app-bound copy | Still open | Design keeps it as a warning |

### TDD Compliance
| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | Missing table | apply-progress (#1276 and WP1-WP6 topics) states "Strict TDD" and gives RED/GREEN prose for WP7, but has no per-task "TDD Cycle Evidence" table |
| All tasks have tests | Yes | every WP has matching test files (unit, integration, spike, e2e) |
| RED confirmed (tests exist) | Yes | all referenced test files exist |
| GREEN confirmed (tests pass) | Yes | 1885/1885 non-skipped pass |
| Triangulation adequate | Mostly | multi-case `it.each` throughout; Pickers single path (W3) |
| Safety net for modified files | Not verifiable | no table |

### Test Layer Distribution (files touched by this change: 92 test files)
| Layer | Notes |
|---|---|
| Unit | pure domain, fakes (`tests/unit/**`) |
| Integration | headless Patchright, temp-dir fs, composition (`tests/integration/**`) |
| Spike | 6 files pinning engine behaviour (`tests/spike/**`) |
| E2E | `record-replay-roundtrip`, `managed-profile-roundtrip` |

### Changed File Coverage (lowest changed files; everything else 95 %+ lines)
| File | Line % | Branch % | Uncovered | Rating |
|---|---|---|---|---|
| `browser-profiles/adapters/node-profile-file-system.ts` | 91.89 | 72.22 | L56, 65, 74 | Acceptable |
| `recording-capture/adapters/frame-path-resolver.ts` | 92.59 | 68.75 | L150 | Acceptable |
| `recording-capture/adapters/page-wiring.ts` | 95.91 | 75 | L62-63 | Excellent lines |
| `browser-profiles/domain/copy-filter.ts` | 100 | 75 | L57 | Excellent lines |
| `browser-selection/domain/expand-path.ts` | 100 | 86.66 | L40, 45 | Excellent |

### Assertion Quality
No tautologies, no ghost loops, no production-free assertions. Every empty-collection assertion has a non-empty companion (for example `cdp-method-audit.test.ts > traces real capture traffic, so an empty trace cannot pass the audit`). One `vi.mock` across the changed tests.
**Assertion quality**: 0 CRITICAL, 0 WARNING

### Quality Metrics
**Linter**: No errors (`eslint . --max-warnings 0`)
**Type checker**: No errors (node, in-page, tests projects)

### Issues Found

**CRITICAL**
1. `recording-capture` / "Patchright persistent context" / scenario **Fallback** is contradicted. The spec says a recording on a browser that is not installed launches the bundled Chromium and surfaces the fallback warning. `createLaunchPlanner.forRecording` (`src/composition/browser-launch-plan.ts`) throws "`<Browser>` is not installed on this machine." instead, and `tests/unit/composition/browser-launch-plan.test.ts > refuses a browser that is not installed and prepares nothing` locks that in. Task 2.5 claims the scenario. Fix one side: (a) make `forRecording` fall back via `resolveReplayBrowser` and warn, or (b) amend the spec delta to say recording refuses (the picker only lists detected browsers). Either needs an apply pass.
2. Strict TDD protocol: apply-progress has no "TDD Cycle Evidence" table (RED / GREEN / TRIANGULATE / SAFETY NET per task). The strict-tdd verify module rates this CRITICAL. Code and tests are fine; the fix is to record the table, or to have the owner explicitly waive it.

**WARNING**
1. Spec text drift: `browser-profiles` "Copy of real profile" requires `-shm` to be copied with its database. Code and design deliberately deny-list `-shm` (SQLite rebuilds it from `-wal`; copying a live `-shm` can corrupt the copy). The scenarios pass. Amend the spec wording before archive so the merged main spec matches the code.
2. `browser-profiles` "Encryption failure reporting" (SHOULD): only a pre-launch win32 warning exists; nothing detects rejected cookies after launch, as the scenario describes. The design records this as an open question.
3. `tui` "Pickers" is PARTIAL: the covering test picks Brave + copy of `Default` from a fixture without Chrome or `Profile 2`. Choosing a non-first real profile is not exercised end to end; `browser-views.test.ts` only shows `Profile 1` being listed.

**SUGGESTION**
1. The local virtual store still holds orphan `node_modules/.pnpm/playwright@1.63.0` and `playwright-core@1.63.0`. They are not in the lockfile and not resolvable from the repo, so nothing uses them; `pnpm store prune` / a clean reinstall removes them.
2. The `no-playwright` depcruise rule and the ESLint import ban only cover `src` (and `scripts` for depcruise); `tests/**` is unguarded. Today that is harmless because `playwright` cannot be resolved.
3. Branch coverage of `node-profile-file-system.ts` (72 %) and `frame-path-resolver.ts` (69 %) could get a few more error-path cases.
4. WP2 noted a load-sensitive 150 ms deadline in `locator-verifier`; it did not flake in this run.

### Verdict
**FAIL**
All gates are green (quality, coverage, build, audit) and the bootstrap and user hard requirements hold. Two CRITICAL findings block archive: the recording-fallback scenario is contradicted, and the strict-TDD evidence table is missing.
