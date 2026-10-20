```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:619d2b61eb0849679f95aa47b1e95644201d6e74496008817e0a3f3bc3caad78
verdict: pass
blockers: 0
critical_findings: 0
requirements: 7/7
scenarios: 21/21
test_command: pnpm quality && pnpm test:coverage
test_exit_code: 0
test_output_hash: sha256:619d2b61eb0849679f95aa47b1e95644201d6e74496008817e0a3f3bc3caad78
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:2c2f9c43749bfe0d64ab9685b0a514eb78a63551c086213cc7b685b2b0eec854
```

## Verification Report

**Change**: profile-access-and-browser-switch
**Version**: N/A
**Mode**: Strict TDD
**Branch**: fix/brave-profile-and-browser-choice, 8 commits over main (7d99658..1049936)
**Persistence**: validator unavailable (gentle-ai 3.7.0, `sdd-verify-validate` is an unknown command); persisted by orchestrator override.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 28 |
| Tasks complete | 28 |
| Tasks incomplete | 0 |

### Build & Tests Execution
**Build**: Passed (`pnpm build`, exit 0)

**Tests**: 2464 passed / 0 failed / 6 skipped (209 files passed, 1 skipped)
```text
pnpm quality  -> typecheck, lint:strict, format:check, deadcode, deps:check, test: exit 0
pnpm test:coverage -> 2464 passed, 6 skipped: exit 0
```
All runs headless; no real browser profile or `recordings/` content was read.

**Coverage**: All files 97.62% stmts / 93.46% branches / 97.8% funcs / 98.54% lines (no configured failure).

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| browser-profiles: Permission-denied source reporting | macOS permission denied | `profile-store.test.ts > reports source-unreadable when Local State is denied on darwin`; `profile-messages.test.ts > names Full Disk Access and the terminal restart on macOS`; `cli-replay-profile-access.test.ts > prints the Full Disk Access message ... on macOS` | COMPLIANT |
| browser-profiles: Permission-denied source reporting | Profile directory denied on another OS | `copy-profile.test.ts > removes the copy without retrying when a file is denied (linux EACCES)`, `reports source-unreadable when listing the profile directory is denied`; `cli-replay-profile-access.test.ts > prints the generic permission hint on Linux` | COMPLIANT |
| browser-profiles: Permission-denied source reporting | Missing is still missing | `profile-store.test.ts > reports source-missing for a missing Local State`; `profile-messages.test.ts > keeps a missing source worded as not found`; `cli-replay-profile-access.test.ts > keeps a missing Local State worded as not found` | COMPLIANT |
| browser-profiles: Permission-denied source reporting | Unknown error | `read-local-state.test.ts > rethrows an unrelated errno unchanged`; `profile-store.test.ts > rethrows an unrelated Local State failure unchanged`; `copy-profile.test.ts > rethrows an unrelated failure when listing a directory`; `profile-messages.test.ts > leaves an unrelated error unchanged` | COMPLIANT |
| browser-profiles: Real profile listing | Multiple profiles | `profile-store.test.ts > lists the profiles of Local State`; `read-local-state.test.ts > returns the parsed profiles` | COMPLIANT |
| browser-profiles: Real profile listing | Unreadable Local State | `profile-store.test.ts > returns null and writes nothing when Local State is unusable`, `reports source-missing for a missing/invalid Local State` | COMPLIANT |
| browser-profiles: Real profile listing | Permission-denied listing | `profile-store.test.ts > returns null without throwing or writing when Local State is denied` | COMPLIANT |
| cli: Profile permission error output | macOS denied | `cli-replay-profile-access.test.ts > prints the Full Disk Access message to stderr and exits 1 on macOS` (stdout empty, exit 1, no path, nothing spawned) | COMPLIANT |
| cli: Profile permission error output | Missing stays distinct | `cli-replay-profile-access.test.ts > keeps a missing Local State worded as not found` | COMPLIANT |
| cli: Profile permission error output | Changed browser used | `cli-replay-profile-access.test.ts > launches the browser and profile a recording was changed to` (see WARNING 1) | COMPLIANT |
| script-library: Change browser | Change applied | `library-service-change-browser.test.ts > writes the browser, mode and profile and keeps everything else` | COMPLIANT |
| script-library: Change browser | Concurrent change and rename | `library-service-change-browser.test.ts > runs a change and a rename on one slug one after the other` | COMPLIANT |
| script-library: Change browser | Unknown slug | `library-service-change-browser.test.ts > fails for an unknown slug and writes nothing` | COMPLIANT |
| script-library: Browser immutable | Rename | `library-service-change-browser.test.ts > keeps the new browser through a later rename and a rename alone leaves it` | COMPLIANT |
| script-library: Browser immutable | Explicit change | same test (change to brave, later rename keeps brave) | COMPLIANT |
| tui: Change browser action | Preselected and saved | `tui-controller-browser-change.test.ts > saves a changed choice, closes the mode and shows the new browser`; `reduce-browser-change.test.ts > preselects the current browser and profile` | COMPLIANT |
| tui: Change browser action | Cancel | `tui-controller-browser-change.test.ts > writes nothing on Esc` | COMPLIANT |
| tui: Change browser action | Current browser missing | `tui-controller-browser-change.test.ts > preselects the first option when the current browser is not detected`; `browser-picker.test.ts` preselect fallbacks | COMPLIANT |
| tui: Change browser action | Copy-of-real profile | `library-screen.test.ts > shows the current copy-of-real profile with its note`; `reduce-browser-change.test.ts > preselects the current browser and profile`; `browser-picker.test.ts > preselectPicker` | COMPLIANT |
| tui: Change browser action | Empty library | `tui-controller-browser-change.test.ts > does nothing with b on an empty library` | COMPLIANT |
| tui: Profile permission message | Full Disk Access message | `tui-controller.test.ts > shows the Full Disk Access message and keeps the library usable` (see WARNING 2) | COMPLIANT |

**Compliance summary**: 21/21 scenarios compliant (7/7 requirements).

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Permission-denied source reporting | Implemented | `classifyFileError` (EPERM busy on win32, denied elsewhere; EACCES denied); `guardSourceRead` on `exists`/`list`; `copyFileGroup.attempt` throws immediately on denied; partial copy removed by existing catch; unknown errors rethrown |
| Real profile listing | Implemented | `listRealProfiles` maps missing/unreadable and catches `other` to `null` |
| Profile permission error output (CLI) | Implemented | `explainProfileFailure(error, browserId, platform)`; `LaunchPlannerDeps.platform` wired from `create-production-services.ts` |
| Change browser | Implemented | `LibraryService.changeBrowser` inside `serializer.run(slug)`, validates with `parseRecording`, writes through `writeFiles` (regenerates `script.mjs`) |
| Browser immutable | Implemented | Only `changeBrowser` alters `browser`; rename untouched |
| Change browser action (TUI) | Implemented | key `b` in `LIBRARY_KEYS`, `change-browser` mode uses `PICKER_KEYS`, `LibraryFlow.submit` dispatches rename vs change-browser; unchanged choice closes without writing |
| Profile permission message (TUI) | Implemented | `library-error` shown; long errors wrapped via `wrapped-error.ts` / `wrap-text.ts` |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Port unchanged, errno classified in domain | Yes | `domain/file-access-failure.ts`; port doc updated |
| Errno mapping | Yes | Table test covers 11 code x platform rows |
| Tagged `readLocalState` | Yes, with recorded deviation | Lock (`busy`) also maps to `unreadable` (Reconciliation) |
| Copy errors (`source-unreadable`, no retry) | Yes | `guardSourceRead` helper added (Reconciliation) |
| Platform-aware wording, no paths | Yes | Uses `›` as in design; spec text writes `>` (design wins for wording) |
| Long TUI errors wrapped | Yes | Extra `wrapped-error.ts` (Reconciliation) |
| Shared picker | Yes | `browser-picker.ts`; form reuses `cyclePicker` |
| Library mode `change-browser`, slug captured | Yes | `reduce-browser-change.ts` |
| Preselection fallbacks | Yes | `BUNDLED_EPHEMERAL` for entries without browser |
| Save semantics | Yes | Unchanged choice closes; failure keeps mode with `library-error` |
| Background detection | Yes, recorded deviation | Enter before list answers "Detecting browsers…" |
| Architecture rules | Yes | `deps:check` green; no feature cross-imports |

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | Yes | "TDD cycle evidence" table in apply-progress.md |
| All tasks have tests | Yes | 26/26 behavior tasks map to test files (5.2, 6.x are non-behavioral) |
| RED confirmed (tests exist) | Yes | All referenced test files exist |
| GREEN confirmed (tests pass) | Yes | All referenced files pass in this run |
| Triangulation adequate | Yes | darwin/linux/win32, multiple denial points, two changes, fallback cases |
| Safety Net for modified files | Yes | Existing copy-profile/library-service/form suites kept green |

**TDD Compliance**: 6/6 checks passed (with admitted test-after deviations, WARNING 3).

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | ~206 (change-related) | 16 | vitest |
| Integration | ~60 (change-related) | 3 (`cli-replay-profile-access`, `node-profile-file-system-denied`, `create-app-services`) | vitest + memory fs / temp dir |
| E2E | 0 | 0 | not needed (headless only) |

### Changed File Coverage
Changed files absent from the text reporter are at 100%. Partially covered changed files:
| File | Line % | Branch % | Uncovered Lines | Rating |
|------|--------|----------|-----------------|--------|
| `src/tui/application/library-flow.ts` | 96.87 | 83.33 | 123, 151 | Excellent |
| `src/tui/domain/app-reducer.ts` | 100 | 80 | branches 111-116, 134 | Excellent |
| `src/tui/domain/browser-picker.ts` | 100 | 89.47 | branches 31-32 | Excellent |
| `src/tui/domain/keymap.ts` | 100 | 96.49 | branches 99, 142 | Excellent |
| `src/tui/render/wrap-text.ts` | 100 | 93.75 | branch 14 | Excellent |

### Assertion Quality
Empty-collection assertions (`fs.pathsUnder(SESSIONS)` -> `[]`, `changedBrowsers` -> `[]`, `writeLog` -> `[]`) all have companion non-empty tests with the same setup. No tautologies, ghost loops, or CSS-class assertions found.

**Assertion quality**: 0 CRITICAL, 0 WARNING

### Quality Metrics
**Linter**: No errors (`lint:strict`)
**Type Checker**: No errors (`typecheck`)

### Issues Found
**CRITICAL**: None

**WARNING**:
1. `tests/integration/composition/cli-replay-profile-access.test.ts:131` (cli "Changed browser used"): the recording is seeded with the new browser directly and replayed through `services.startReplay`, not through `changeBrowser` plus `runCli(['replay','demo'])`, and only a `managed` target is asserted (no `copy-of-real` profile). The chain is still covered piecewise (changeBrowser persistence tests plus replay reading `recording.browser`).
2. `tests/unit/tui/tui-controller.test.ts:761` (tui "Full Disk Access message"): the fake service injects the final message string; the EPERM -> `source-unreadable` -> platform message chain is proven in the CLI integration and unit tests, not through the TUI's composed services.
3. TDD deviations admitted in apply-progress: task 1.8 is a characterization test (passed at once), 2.3 passed after 2.1/2.2 wiring, and the `status-bar` compact-gap and `create-app-services` `changeBrowser` tests were test-after.
4. The orchestrator range `df543a7..1049936` omits commit `df543a7` (Phase 1, browser-profiles); the real branch base is `7d99658` (8 commits). Verification covered the full range.
5. Environment: pnpm warned "node_modules are out of sync with your lockfile"; gates still passed.

**SUGGESTION**:
1. Add a TUI-level test that composes the real launch planner over the memory fs with a denied `Local State`, to close WARNING 2 end to end.
2. Cover `library-flow.ts` lines 123 and 151 (error branches).

### Verdict
PASS WITH WARNINGS
All 28 tasks complete, all 21 scenarios covered by passing tests, quality/coverage/build green; warnings are test-indirection and process notes only.
