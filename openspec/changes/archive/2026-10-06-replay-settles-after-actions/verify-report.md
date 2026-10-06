> Validator unavailable (gentle-ai 3.7.0); persisted by orchestrator override (gentle-ai#4699). `gentle-ai sdd-verify-validate` was not called.

```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:c8084edf9e0d9ed5d1600c68e451b31a146c07cec05795dc91b9e4f79ddc40f1
verdict: pass
blockers: 0
critical_findings: 0
requirements: 3/3
scenarios: 21/22
test_command: pnpm test:coverage
test_exit_code: 0
test_output_hash: sha256:3d97e21781c3c3f7995f490d14c72f1fa99540fb117f9f44c2fea05ed2d7a2f2
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:7e117fe8d7e05c326be5952f8a63eb983defb3ceb1b1f03be8fd6c1a31f46150
```

## Verification Report

**Change**: replay-settles-after-actions
**Branch / HEAD**: `fix/replay-settles-after-last-step` @ `8d26c73` (11 commits over `main`; `evidence_revision` = SHA-256 of `git diff main...HEAD`)
**Version**: 0.1.0 -> 0.1.1
**Mode**: Strict TDD

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 10 |
| Tasks complete | 10 |
| Tasks incomplete | 0 |

### Build & Tests Execution

| Command | Exit | Result |
|---------|------|--------|
| `pnpm quality` | 1 | typecheck, lint:strict, format:check, deadcode (knip), deps:check all green; `vitest run` 2247 passed, 1 failed, 6 skipped. Failure: `tests/unit/script-generation/script-prelude.test.ts > prints step, done markers with elapsed milliseconds` (`::done 220` vs `/^::done 1[2-9]\d$/`) at load average ~29. Log sha256:6635eeefd34de96b309d5d179be0f43f8c7973b7a3647594d9e37e536fad5356 |
| `pnpm vitest run tests/unit/script-generation/script-prelude.test.ts` (branch, isolated) x3 | 0 | 43/43 each run |
| same file on a temporary `main` worktree (479d9df) x3 | 0 | 43/43 each run |
| `pnpm test:coverage` (full suite again) | 0 | 193 files passed, 1 skipped; 2248 passed, 6 skipped, 0 failed |
| `pnpm build` | 0 | built |
| `pnpm audit` | 0 | No known vulnerabilities found |

Flake classification: the failing test file is unchanged by this branch, asserts a 120 ms sleep lands below 200 ms, passes in isolation on both the branch and `main`, and passes in the following full-suite run. Classified as a pre-existing load-sensitive timing flake (same family the orchestrator observed on `main`), not a regression.

**Coverage**: All files 97.48% statements / 93.15% branches / 97.79% functions / 98.38% lines. Changed TypeScript files are fully covered except pre-existing lines (`render-step.ts:52` invalid-URL fallback from d0f796c; `replay-flow.ts:54,67` untouched by this change). The prelude modules are runtime text (string constants) and are covered behaviorally by `settle-prelude.test.ts`, `script-prelude*.test.ts` and the headless integration tests, not by line coverage.

### Independent RED / fix-isolation evidence

| Probe (scratch worktree, removed afterwards) | Result |
|---|---|
| RED commit `eeef630`, `records the POST of the last click before the browser closes` | FAILED: `expected [ 'loaded' ] to include 'confirmed'` (right reason: POST lost); same-URL `framenavigated` probe PASSED |
| HEAD with `await rt.settle();` removed + extra assertion "two `loaded` reports" (reload awaited) | PASSED (confirm + human mode): the navigation fix alone awaits the same-URL reload and saves the POST |
| HEAD with `wait-for-url` reverted to `waitForURL` (settle kept) | PASSED: the committed confirm-modal integration tests do not discriminate the navigation fix (see W1) |

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| replay: Exit handling | Failing step | `run-replay-command.test.ts > names the failing step on stderr...`; `e2e/cli-replay.test.ts > reports a failing step on stderr and exits 1` | ✅ COMPLIANT |
| replay: Exit handling | Cancel | `run-replay-command.test.ts > cancels once on Ctrl+C...`; `create-replay-command-services.test.ts > asks the script to abort when cancelled`; TUI `cancels a running replay with c` | ✅ COMPLIANT |
| replay: Exit handling | Navigation timeout | `settle-prelude.test.ts > never lets a navigation older than the action satisfy the wait` (message `Timed out waiting for the navigation of step 4 to ...`); failure path via existing `rt.fail` -> `::error <step>` | ✅ COMPLIANT (unit; integration omitted by design, 30 s default) |
| replay: Exit handling | Success after settle | `generated-script.test.ts > records the POST of the last click before the browser closes` | ✅ COMPLIANT |
| replay: Exit handling | Cap warning in CLI | `run-replay-command.test.ts > prints the warnings of the script on stderr and still succeeds`, `> prints each script warning once, in order...`; `create-replay-command-services.test.ts > carries the warnings the script printed into the view`; `generated-script.test.ts > finishes a page that never goes quiet at the cap, with a warning` | ✅ COMPLIANT (layered) |
| replay: Exit handling | Cap warning in TUI | `timeline-replay-screens.test.ts > lists the warnings of the run after the launch warnings`; `create-app-services.test.ts` succeeded run carries `warnings: ['Stopped waiting']` | ✅ COMPLIANT |
| replay: Exit handling | No settle on cancel | `script-prelude-signals.test.ts > stops at once on a signal without waiting for the network to settle` | ✅ COMPLIANT |
| script-generation: Event-to-code mapping | Multi-tab | `render-step.test.ts > targets the variable of the page...`; `multi-tab` golden | ✅ COMPLIANT |
| script-generation: Event-to-code mapping | Unknown event type | `render-step.test.ts > throws naming the unsupported kind and index` | ✅ COMPLIANT |
| script-generation: Event-to-code mapping | Scroll inside a shadow root | `generated-script.test.ts > scrolling > inside shadow trees` (2) | ✅ COMPLIANT |
| script-generation: Event-to-code mapping | Same-URL reload awaited | `settle-prelude.test.ts > resolves for a reload of the same URL committed after the action`; `generated-script.test.ts > records the POST...` | ⚠️ PARTIAL (integration test does not assert the follow-up waited for the reload; see W1) |
| script-generation: Event-to-code mapping | Cross-URL navigation awaited | `settle-prelude.test.ts > resolves for a navigation to another path and ignores other paths` | ✅ COMPLIANT |
| script-generation: Event-to-code mapping | Earlier navigation never satisfies | `settle-prelude.test.ts > never lets a navigation older than the action satisfy the wait` | ✅ COMPLIANT |
| script-generation: Event-to-code mapping | Navigation armed before the action | `settle-prelude.test.ts > does not miss a navigation that commits right after the action` | ✅ COMPLIANT |
| script-generation: Event-to-code mapping | Missing navigation | `settle-prelude.test.ts` timeout message naming the step (tests at L76, L99) | ✅ COMPLIANT |
| script-generation: Settle before close | Pending request completes | `settle-prelude.test.ts > waits for a pending request plus the quiet window`; `generated-script.test.ts > reports the request of a last click that never navigates` | ✅ COMPLIANT |
| script-generation: Settle before close | Long-polling hits cap | `settle-prelude.test.ts > stops at the cap with a count-only warning...`; `generated-script.test.ts > finishes a page that never goes quiet at the cap` (exit 0, `::done` in [5000, 9000) ms, `::warn`) | ✅ COMPLIANT |
| script-generation: Settle before close | WebSocket open | `settle-prelude.test.ts > does not wait for websockets` | ✅ COMPLIANT (fake only; see S2) |
| script-generation: Settle before close | Failure skips settle | `generated-script.test.ts > does not settle when a step fails` (polling page: no `::warn`, no `::done`, exit 1); `generate-script.test.ts > settles ... only on the success path` | ✅ COMPLIANT |
| script-generation: Settle before close | Human mode | `generated-script.test.ts > settles after the same click in human timing too`; existing human-delay tests | ✅ COMPLIANT |
| script-generation: Settle before close | No page instrumentation | `generated-script.test.ts > keeps the settle and navigation runtime out of the page`; scrolling `runs nothing in the main world` (2) | ✅ COMPLIANT |
| script-generation: Settle before close | Drift unaffected | `generated-script.test.ts > absorbs a slow step...`; `script-prelude.test.ts` offset tests (green in isolation and in the coverage run) | ✅ COMPLIANT |

**Compliance summary**: 21/22 scenarios compliant, 1 partial.

### Correctness (Static Evidence) — owner checklist
| Check | Status | Evidence |
|-------|--------|----------|
| (1) Action-caused navigation armed before the action; same-URL reload awaited | ✅ | `rt.at()` calls `settling.arm()` after pacing when `!isFollowUp`; `wait-for-url` renders `await rt.waitForNavigation(pageN, "<origin+path>")`; tracker matches `seq > armedSeq`, unconsumed, same page, origin+pathname, then `waitForLoadState('load')`. RED reproduced at `eeef630`; GREEN at HEAD; fix-isolation probe shows the reload is awaited (two `loaded` reports) |
| (2) Network settle on success only (500 ms / 5 s, `::warn` -> CLI stderr / TUI) | ✅ | `QUIET_WINDOW_MS = 500`, `SETTLE_CAP_MS = 5000`, `SETTLE_POLL_MS = 50`; `await rt.settle();` emitted once before `rt.done()` inside the `try`, never in `catch`; abort path `process.exit(130)` bypasses it; cap prints `::warn <JSON>` with count only; `parseProgressLine` -> `ReplayProgress.warnings` -> `RunView.warnings` (`formatWarning` on stderr) and `ReplayView.warnings` (`warningLines`, sanitized) |
| (3) No main-world code, no `Runtime.enable`/`Console.enable`, no new dependency | ✅ | Settle/navigation use only `framenavigated`, `request`, `requestfinished`, `requestfailed` in Node; grep shows no `evaluate`/`addInitScript`/`exposeFunction`/`Runtime.enable`/`Console.enable` (only pre-existing isolated-world `Runtime.callFunctionOn` for scroll); `pnpm-lock.yaml` and dependencies unchanged; `pnpm audit` clean |
| (4) Version 0.1.1 | ✅ | `package.json` 0.1.0 -> 0.1.1; change touches `src/` (release-impacting per `scripts/release-impact-policy.ts` `RELEASE_PREFIXES`) |
| (5) Docs | ✅ | README (stderr warning, `::warn`, 500 ms / 5 s, new-navigation wait, no page code); SECURITY (Node-side tracking, no Runtime/Console, count-only warning); design.md reconciliation section |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| `framenavigated` main-frame signal | ✅ Yes | child frames ignored (tested) |
| Arm at end of `rt.at` when not follow-up | ✅ Yes | via new `pace` helper |
| Per-page snapshot | ⚠️ Deviation | single global `armedSeq` over a global log; matching is filtered by page so behavior is equivalent for the generated step order (S1) |
| Match first newer + consume + `waitForLoadState('load')` | ✅ Yes | consume and re-arm tested |
| `NAVIGATION_TIMEOUT_MS = 30000` | ✅ Yes | |
| Settle rule from `max(lastActivity, settleStart)` | ✅ Yes | |
| Ignore `data:`/`blob:`; websockets emit no request | ✅ Yes | |
| Settle only on success | ✅ Yes | |
| `::warn` on stdout, CLI re-emits on stderr | ✅ Yes | |
| Count-only warning text | ✅ Yes | |
| `settle-prelude.ts` + `scroll-prelude.ts` split | ✅ Yes | lint limits respected (`lint:strict` green) |
| Testing strategy: reload counted via `/__report` on load | ⚠️ Not asserted | W1 |

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | Table in apply-progress.md (10 rows) |
| All tasks have tests | ✅ | 8/8 behavior tasks; tasks 9-10 are docs/gates |
| RED confirmed (tests exist) | ✅ | All listed test files exist; task 1 RED independently reproduced at `eeef630` |
| GREEN confirmed (tests pass) | ✅ | All listed files pass in the coverage run |
| Triangulation adequate | ✅ | settle-prelude 8+8 cases; warnings one/two/order/sanitize; parse JSON/raw/bare |
| Safety Net for modified files | ✅ | Reported for every modified-file task |

**TDD Compliance**: 6/6 checks passed

### Test Layer Distribution (tests added or changed by this change)
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | ~45 | 13 | Vitest, Node child process + EventEmitter fakes |
| Integration | 9 | 3 | Vitest, headless Patchright fixture server, composition fakes |
| E2E | 0 new | 0 | existing `e2e/cli-replay.test.ts` still green |

### Changed File Coverage
| File | Line % | Uncovered | Rating |
|------|--------|-----------|--------|
| `src/script-generation/domain/render-step.ts` | 97.67% | L52 (pre-existing) | ✅ Excellent |
| `src/tui/application/replay-flow.ts` | 90.47% | L54, L67 (pre-existing, not in diff) | ⚠️ Acceptable |
| Other changed `.ts` files | 100% | — | ✅ Excellent |

### Assertion Quality
| File | Line | Assertion | Issue | Severity |
|------|------|-----------|-------|----------|
| `tests/unit/script-generation/settle-prelude.test.ts` | 246-252 | `does not wait for websockets` emits a `websocket` event the tracker never subscribes to | Weak discriminator: it would pass for any tracker that ignores unknown events; real WebSocket semantics are not exercised | SUGGESTION |
| `tests/integration/script-generation/generated-script.test.ts` | 243-255 | `toContain('confirmed')` | Passes with the settle alone; does not prove the same-URL reload was awaited | WARNING (W1) |

**Assertion quality**: 0 CRITICAL, 1 WARNING

### Quality Metrics
**Linter**: ✅ No errors (`eslint . --max-warnings 0`)
**Type Checker**: ✅ No errors (node, in-page, tests)
**Format / deadcode / deps**: ✅ prettier, knip, dependency-cruiser green

### Issues Found
**CRITICAL**: None

**WARNING**:
- W1: The integration evidence for "Same-URL reload awaited" does not discriminate the navigation fix. Reverting `wait-for-url` to the old `waitForURL` keeps both confirm-modal integration tests green because the 500 ms settle also catches the 300 ms-delayed POST. The design's testing strategy says the reload is counted via `/__report` on load, but no assertion checks two `loaded` reports. The regression is still caught by `render-step.test.ts`, the goldens and the `settle-prelude.test.ts` same-URL unit test. Adding `expect(server.reports().filter((r) => r === 'loaded')).toHaveLength(2)` was verified to pass with the navigation fix alone (HEAD minus `rt.settle()`).
- W2: `pnpm quality` exited 1 on one load-sensitive timing test (`script-prelude.test.ts > prints step, done markers with elapsed milliseconds`, `::done 220`). The file is unchanged and passes in isolation on the branch (3/3) and on `main` (3/3), and the next full-suite run (`pnpm test:coverage`) passed 2248/2248. Classified as a pre-existing flake; re-run `pnpm quality` on a quieter machine before merge.

**SUGGESTION**:
- S1: Record in design.md that arming is a single global sequence rather than a per-page snapshot (equivalent because matches filter by page and follow-ups never re-arm).
- S2: The WebSocket scenario is only covered by a fake event; consider a headless fixture with a real WebSocket to pin Patchright's "no `request` event for WebSockets" assumption.
- S3: Consider one e2e (`node dist/main.js replay` on the polling fixture) to assert exit 0 plus `!` warning on stderr end to end; today the CLI cap warning is proved in layers.

### Verdict
PASS WITH WARNINGS
All 10 tasks done, 3/3 requirements implemented, 21/22 scenarios compliant (1 partial), owner checklist (1)-(5) satisfied, gates green except one pre-existing timing flake.
