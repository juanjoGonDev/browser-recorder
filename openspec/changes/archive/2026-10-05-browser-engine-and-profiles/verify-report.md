validator unavailable (gentle-ai 3.7.0); persisted by orchestrator override

```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:708912cdf425eebd0867166bcda4463df9e489125a86650d086333b4c0f55f98
verdict: pass
blockers: 0
critical_findings: 0
requirements: 35/35
scenarios: 62/62
test_command: pnpm quality && pnpm test:coverage
test_exit_code: 0
test_output_hash: sha256:41c33cdd33161065a44f963963de4304a141c636298bee476e0019f4b0312565
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:ba41b571ad7aeb5a053a3afd1ac7fbd95c43f8708ac2e384f12e4ff2a4f957b8
```

## Verification Report (re-verify after remediation R.1-R.6)

**Change**: browser-engine-and-profiles
**Version**: N/A (delta specs, 9 capabilities; 35 requirements, 62 scenarios after R.3 added "Shared-memory sibling")
**Mode**: Strict TDD
**Candidate**: HEAD `783ddb2` (tree `c4b0c4d7`) on `feat/bootstrap-browser-recorder`, clean worktree
**Evidence revision**: sha256 of the tree id plus the four gate log hashes

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 61 (55 original + R.1-R.6) |
| Tasks complete | 61 |
| Tasks incomplete | 0 |

### Build & Tests Execution (headless; opt-in real-browser suite NOT run; no real profile touched)
| Gate | Exit | Result | Output sha256 |
|------|------|--------|---------------|
| `pnpm quality` (typecheck x3, eslint --max-warnings 0, prettier, knip, depcruise src+scripts AND tests, vitest) | 0 | 158 files passed, 1 skipped; 1894 passed, 6 skipped | 20070d9e...7c0d |
| `pnpm test:coverage` | 0 | 1894 passed, 6 skipped; thresholds met | 4acce189...b3442 |
| `pnpm build` | 0 | built | ba41b571...57b8 |
| `pnpm audit` | 0 | No known vulnerabilities found | 15950a68...7955 |

Skipped (6): `real-browser.test.ts` (4, needs `BROWSER_RECORDER_REAL_BROWSER_TESTS=1`) and 2 headed-dialog checks (need `BROWSER_RECORDER_HEADED_TESTS=1`). Both variables unset.
depcruise: "no dependency violations found" for `src scripts` (199 modules) and for `tests` (387 modules).
**Coverage**: 97.33 % statements / 93.34 % branches / 97.61 % functions / 98.21 % lines (above thresholds).

### Previous findings - re-check
| Previous finding | Status | Evidence |
|---|---|---|
| CRITICAL-1 recording fallback contradicted | RESOLVED | `createLaunchPlanner.forRecording` now goes through `planWithFallback` + `resolveReplayBrowser`; managed stays managed, copy-of-real becomes ephemeral "with a clean profile". Tests pass: `browser-launch-plan.test.ts > falls back to the bundled browser and warns when the browser is not installed`, `> records a missing copy of a real profile on a clean profile`; `create-app-services.test.ts > records on the bundled browser and warns live when the chosen one is not installed` (live warning, bundled saved in `recording.json`). The refusal test is gone |
| CRITICAL-2 missing TDD Cycle Evidence table | RESOLVED | Table present in `apply-progress.md` and engram #1276, with honest "not itemised" / "TESTS AFTER CODE" / "MUTATION-BASED RED" markings. Judged below (W1, W2) |
| WARNING `-shm` spec mismatch | RESOLVED | Spec now says MUST NOT copy `-shm` with rationale and a "Shared-memory sibling" scenario; `copy-profile.test.ts > skips locks, caches, transient files...` adds `Cookies-shm` and asserts the copy holds `Cookies`, `Cookies-wal` and no `-shm`; `copy-filter.test.ts` it.each includes `Cookies-shm` |
| WARNING encryption reporting | RESOLVED (by spec amendment) | Requirement (SHOULD) now scoped to the pre-launch warning; post-launch detection explicitly out of scope with rationale. `profile-store.test.ts > warns about app-bound encryption on Windows only`, `profile-messages`/launch-plan wording tests pass |
| WARNING TUI Pickers coverage | RESOLVED | `tui-controller-pickers.test.ts > starts on Chrome with the copy of Profile 2 after cycling both pickers` drives keys tab/right/return through the real controller and asserts the start request (`chrome`, `copy-of-real`, `Profile 2`); plus default managed case |
| SUGGESTION playwright bans in tests | RESOLVED | `.dependency-cruiser.tests.json` (`no-playwright`, `no-playwright-unresolved`) wired into `deps:check`; `depcruise-rules.test.ts` +4 cases (installed/uninstalled `playwright`, `playwright-core`, `@playwright/test`) pass; ESLint `no-restricted-imports` fixtures pass |
| SUGGESTION stale `node_modules/.pnpm/playwright*` | RESOLVED | `ls node_modules/.pnpm | grep playwright` returns nothing. The only lockfile mention is vitest's optional peer metadata `@vitest/browser-playwright` (not installed) |

### Hard requirements (re-checked)
| Requirement | Result | Evidence |
|---|---|---|
| Patchright only | Holds | `patchright: 1.63.0` sole runtime dependency; no `playwright` import in `src`/`scripts`/`tests` (one v1 script string literal in `managed-profile-roundtrip.test.ts`, test data); depcruise (src + tests), ESLint, `dependency-pins.test.ts` |
| No `Runtime.enable` / `Console.enable` | Holds | No literal in `src`/`scripts`; ESLint selector rule; `guardCdp`; `cdp-method-audit.test.ts` (6) passes |
| No main-world code in recording | Holds | No `addInitScript`/`exposeBinding`/`exposeFunction`/`page.evaluate`/`addScriptToEvaluateOnNewDocument` in `src`; capture uses `Page.createIsolatedWorld` + `Runtime.evaluate({ contextId })` |
| No main-world code in generated replay | Holds | Prelude uses `Page.createIsolatedWorld` + `Runtime.callFunctionOn({ executionContextId })`; `generated-script.test.ts` main-world check passes |
| Tests headless only | Holds | Only `headless: false` is in the lint fixture; headed and real-browser tests skipped |
| Zero vulnerabilities | Holds | `pnpm audit` exit 0 |
| Exact pins | Holds | No `^`/`~` in `package.json`; `.npmrc` save-exact, minimum-release-age, engine-strict, prefer-frozen-lockfile |
| Strict lint / knip / depcruise | Holds | All inside `pnpm quality`, exit 0 |

### Spec Compliance Matrix (runtime-passing tests in this run)
| Capability / Requirement | Scenario | Test | Result |
|---|---|---|---|
| browser-profiles / Managed profile | First use | `node-adapters.test.ts` (0700), `profile-store.test.ts > creates the directory privately on first use` | COMPLIANT |
| | Reuse | `profile-store.test.ts > reuses the same directory...`; `managed-profile-roundtrip.test.ts` | COMPLIANT |
| | Per browser | `profile-store.test.ts > keeps one directory per browser` | COMPLIANT |
| browser-profiles / Ephemeral | Cleanup | `profile-store.test.ts > ...deletes it on release`; `create-app-services.test.ts > releases the profile when the browser fails to launch` | COMPLIANT |
| browser-profiles / Real profile listing | Multiple profiles | `parse-local-state.test.ts`; `profile-store-on-fixture.test.ts` | COMPLIANT |
| | Unreadable Local State | `profile-store.test.ts > returns null and writes nothing...`; `parse-local-state.test.ts` | COMPLIANT |
| browser-profiles / Copy of real | WAL sibling | `copy-profile.test.ts > copies Local State, the profile and its WAL sibling byte for byte` | COMPLIANT |
| | Shared-memory sibling | `copy-profile.test.ts > skips locks, caches, transient files...` (`Cookies-shm` absent, `Cookies`/`Cookies-wal` present) | COMPLIANT |
| | Torn read | `copy-profile.test.ts > retries a torn read and ends with the final bytes` | COMPLIANT |
| | Running browser | `profile-store.test.ts > warns that the snapshot may be stale...` | COMPLIANT |
| | Skipped entries | `copy-profile.test.ts > skips locks, caches...` | COMPLIANT |
| browser-profiles / Read-only source | Hash unchanged | `profile-store-on-fixture.test.ts` (tree hash and mtimes) | COMPLIANT |
| browser-profiles / Lock detection | Locked managed profile | `profile-store.test.ts`; `create-app-services.test.ts > rejects a locked profile...` | COMPLIANT |
| | Stale lock | `check-profile-lock.test.ts > ignores a stale lock...` | COMPLIANT |
| browser-profiles / Encryption failure reporting | Unreadable cookies | `profile-store.test.ts > warns about app-bound encryption on Windows only`; launch-plan wording tests | COMPLIANT |
| browser-selection / Catalogue | macOS Brave | `browser-catalog.test.ts` | COMPLIANT |
| | Windows paths | `browser-catalog.test.ts > expands Windows templates and handles spaces` | COMPLIANT |
| | Linux paths | `browser-catalog-table.test.ts`, `browser-catalog.test.ts` | COMPLIANT |
| browser-selection / Bundled always | Nothing installed | `browser-catalog.test.ts > lists exactly the bundled browser...` | COMPLIANT |
| browser-selection / Fallback with warning | Recorded Brave missing | `resolve-replay-browser.test.ts`; `browser-launch-plan.test.ts` | COMPLIANT |
| | Installed browser | `resolve-replay-browser.test.ts`; `browser-launch-plan.test.ts > keeps the recorded browser and adds no warning...` | COMPLIANT |
| browser-selection / Unknown id | Unknown id | `resolve-replay-browser.test.ts > treats an id outside the catalogue as missing` | COMPLIANT |
| environment-setup / Chromium detection | Present | `ensure-browser.test.ts` | COMPLIANT |
| | Missing | `ensure-browser.test.ts > announces the missing browser...` | COMPLIANT |
| | System browser only | `menu-setup-form-screens.test.ts`; `app-reducer.test.ts` | COMPLIANT |
| environment-setup / Automatic install | Success | `ensure-browser.test.ts` | COMPLIANT |
| | Failure | `ensure-browser.test.ts` (non-zero exit, still absent) | COMPLIANT |
| | Offline | `ensure-browser.test.ts`; `keymap.test.ts` | COMPLIANT |
| environment-setup / Linux deps | Missing libs | `linux-deps-hint.test.ts` | COMPLIANT |
| recording-capture / Patchright persistent context | Stored browser | `patchright-browser-launcher.test.ts` | COMPLIANT |
| | Fallback | `browser-launch-plan.test.ts > falls back to the bundled browser and warns...`; `create-app-services.test.ts > records on the bundled browser and warns live...` | COMPLIANT |
| recording-capture / No leaking CDP domains | Protocol trace | `cdp-method-audit.test.ts` (6) | COMPLIANT |
| recording-capture / Stores browser and mode | Saved fields | `recording-session.test.ts` | COMPLIANT |
| recording-capture / Locked at start | Locked | `recording-session.test.ts`; `patchright-browser-launcher.test.ts` | COMPLIANT |
| replay / Recorded browser and profile | Stored browser | `create-app-services.test.ts`; `replay-runner.test.ts` | COMPLIANT |
| | Legacy recording | `managed-profile-roundtrip.test.ts > replays a version 1 recording...` | COMPLIANT |
| replay / Fallback reported | Missing browser | `create-app-services.test.ts > warns on the live replay...` | COMPLIANT |
| replay / Lock reported | Locked | `create-app-services.test.ts > rejects a locked profile...` | COMPLIANT |
| repository-quality / Dependency hygiene | Audit | `pnpm audit` exit 0 | COMPLIANT |
| | Range detected | `dependency-pins.test.ts` | COMPLIANT |
| | Playwright reintroduced | `dependency-pins.test.ts`, `depcruise-rules.test.ts` (src and tests), `eslint-rules.test.ts` | COMPLIANT |
| repository-quality / CDP leak lint | Forbidden call | `eslint-rules.test.ts` | COMPLIANT |
| repository-quality / Opt-in real-browser tests | Default run | real-browser suite skipped; `isolated-home.test.ts` (unit 6 + integration 4) | COMPLIANT |
| repository-quality / Dependency direction | Layer violation | `depcruise-rules.test.ts` | COMPLIANT |
| script-generation / Plain Patchright ESM | Runnable | `generate-script.test.ts` + goldens | COMPLIANT |
| | Deterministic | `generate-script.test.ts` | COMPLIANT |
| script-generation / Event mapping | Multi-tab | `generate-script.test.ts`; `generated-script.test.ts` | COMPLIANT |
| | Unknown event type | `generate-script.test.ts` | COMPLIANT |
| script-generation / Launch recorded browser | Managed Brave | `brave-managed.mjs` golden; `script-prelude.test.ts` | COMPLIANT |
| | Ephemeral | `script-prelude.test.ts` | COMPLIANT |
| | Copy of real | `browser-launch-plan.test.ts`; prelude accepts only `--profile-directory=` | COMPLIANT |
| script-generation / Old recordings | Legacy recording | `generate-script.test.ts`; `legacy-emulated.mjs` | COMPLIANT |
| script-library / Browser fields | Round trip | `library-service.test.ts` | COMPLIANT |
| script-library / Old recordings | Legacy file | `library-service.test.ts` | COMPLIANT |
| script-library / Invalid browser fields | Bad mode | `library-service.test.ts` | COMPLIANT |
| script-library / Browser immutable | Rename | `library-service.test.ts` | COMPLIANT |
| tui / Create flow | Invalid URL | `tui-controller.test.ts` | COMPLIANT |
| | Empty URL | `tui-controller.test.ts` | COMPLIANT |
| | Pickers | `tui-controller-pickers.test.ts > starts on Chrome with the copy of Profile 2...` | COMPLIANT |
| | Only bundled | `tui-controller.test.ts`; `menu-setup-form-screens.test.ts` | COMPLIANT |
| tui / Lock and fallback messages | Locked profile | `tui-controller.test.ts` | COMPLIANT |
| | Fallback warning | `timeline-replay-screens.test.ts`; `tui-controller.test.ts` | COMPLIANT |

**Compliance summary**: 62/62 scenarios compliant; 35/35 requirements compliant.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|---|---|---|
| Recording fallback | Implemented | `planWithFallback` shared by recording and replay; the saved recording holds the resolved `bundled` choice |
| Copy of real (`-shm`) | Implemented, spec aligned | `copy-filter.ts:49` denies `-shm`, spec now requires it |
| Encryption reporting | Implemented as amended | pre-launch Windows app-bound warning only |
| All other requirements | Implemented | unchanged since the previous verify |

### Coherence (Design)
All decisions from the previous report still hold (S0 transport (b), `guardCdp` on every session, `launchPersistentContext` + `viewport: null`, four env vars, fresh copy per launch, lock probe first, Opera without copy-of-real, `regenerateScript` before replay). The `-shm` design/spec conflict is gone. Windows app-bound copy remains a design open question handled by a warning.

### TDD Compliance
| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | Yes | "TDD Cycle Evidence" table in `apply-progress.md` and engram #1276 |
| All tasks have tests | Yes | every code task maps to test files; doc/decision rows (0.5, R.2, R.4) are N/A |
| RED confirmed (tests exist) | Yes (one path typo) | all listed files exist except the listed `tests/support/isolated-home.test.ts`; the real files are `tests/unit/support/` and `tests/integration/support/isolated-home.test.ts` (S1) |
| GREEN confirmed (tests pass) | Yes | 1894/1894 non-skipped pass, including every R.1/R.5/R.6 test |
| RED written first | Partial | Clean RED: WP0, WP1, 4.1-4.3, 5.3, WP7, R.1 (2 tests seen failing), R.6 (4/5 seen failing). TESTS AFTER CODE: 4.4, 4.5, 5.1, 5.4, R.5. Not itemised: WP2 (2.1-2.7), WP3, WP6. Mutation-based RED: 7.3 |
| Triangulation adequate | Yes | multi-case tests throughout; 5.4 single-scenario by spec |
| Safety net for modified files | Yes | recorded per row (existing suites, 20/20 + 42/42 for R.1, 53/53 for R.5, 16/16 for R.6) |

**Judgement on honestly marked rows** (no evidence fabricated):
- TESTS AFTER CODE (4.4, 4.5, 5.1, 5.4): the behaviour was produced in WP0 under task 0.6 (RED+GREEN contract work); the later WP added verification tests. Every test passes now and covers the scenario. Process deviation, not a missing test: WARNING.
- R.5: a coverage-gap test for behaviour that already existed; first run GREEN is expected and honestly reported. No new behaviour was written without a test: acceptable, folded into W1.
- Not itemised (WP2, WP3, WP6): per-task RED cannot be confirmed from the reports; tests exist and pass. Evidence incompleteness: WARNING.
- 7.3 MUTATION-BASED RED: a valid way to prove the test can fail for an e2e harness: acceptable.

### Test Layer Distribution
| Layer | Notes |
|---|---|
| Unit | domain, application with fakes (`tests/unit/**`) |
| Integration | headless Patchright, temp-dir fs, composition, tool runs (`tests/integration/**`, repository tests) |
| Spike | engine behaviour pins (`tests/spike/**`) |
| E2E | `record-replay-roundtrip`, `managed-profile-roundtrip` (headless) |

### Changed File Coverage (lowest; all others 95 %+ lines)
| File | Line % | Branch % | Uncovered | Rating |
|---|---|---|---|---|
| `browser-profiles/adapters/node-profile-file-system.ts` | 90.32 | 72.22 | L56, 65, 74 | Acceptable |
| `recording-capture/adapters/frame-path-resolver.ts` | 97.95 | 68.75 | L150 | Excellent lines |
| `recording-capture/adapters/page-wiring.ts` | 95.74 | 75 | L62-63 | Excellent lines |
| `composition/browser-launch-plan.ts` | 96.55 | 90 | L49 | Excellent |
| `browser-profiles/domain/copy-filter.ts` | 100 | 75 | L57 | Excellent lines |

### Assertion Quality
New R tests assert concrete values (start request objects, exact warning strings, saved `recording.json` fields, depcruise rule names). Each `toEqual([])`-style check has non-empty companions. No tautologies, ghost loops or production-free assertions.
**Assertion quality**: 0 CRITICAL, 0 WARNING

### Quality Metrics
**Linter**: No errors (`eslint . --max-warnings 0`)
**Type checker**: No errors (node, in-page, tests)

### Issues Found

**CRITICAL**: None

**WARNING**
1. W1 Strict TDD order not followed for 4.4, 4.5, 5.1, 5.4 (tests after code, behaviour written in WP0) and R.5 (coverage-gap test, first run green). Honestly reported; covering tests pass.
2. W2 Per-task RED evidence is not itemised for WP2 (2.1-2.7), WP3 (3.1-3.8) and WP6 (6.1-6.5). Tests exist and pass, but RED-first cannot be confirmed per task.

**SUGGESTION**
1. S1 Fix the TDD table path for 0.8: `tests/support/isolated-home.test.ts` does not exist; the tests are `tests/unit/support/isolated-home.test.ts` (6) and `tests/integration/support/isolated-home.test.ts` (4).
2. S2 `browser-launch-plan.ts` L49 (the "not installed" throw in `plan`) is now reachable only if the catalogue changes between `list()` and `find()`; consider documenting it as a race guard or removing it.
3. S3 When the bundled install failed and the chosen browser is also missing, recording now falls back to a bundled Chromium that may not exist and fails at launch. The picker only lists detected browsers, so this needs a stale choice; a clearer message for that case would help.
4. S4 Branch coverage of `node-profile-file-system.ts` (72 %), `frame-path-resolver.ts` (69 %) and `page-wiring.ts` (75 %) could get a few error-path cases.
5. S5 `locator-verifier` has a load-sensitive deadline (noted in WP2); it did not flake in this run.

### Verdict
**PASS WITH WARNINGS**
All gates green, 62/62 scenarios compliant at runtime, every hard requirement holds; both previous CRITICAL findings are resolved. Remaining warnings are strict-TDD process evidence gaps that are honestly reported and do not block archive.
