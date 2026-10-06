```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:1351497c59f36ec740f4a8b0bb785e489e67e05556bd7128b47ae1def253dbf8
verdict: fail
blockers: 2
critical_findings: 2
requirements: 0/3
scenarios: 10/16
test_command: pnpm quality
test_exit_code: 0
test_output_hash: sha256:3a1ad95a2ae1934b8c8aa89cd394afb885db37a8620b685cfd75d92618098e8e
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:c4d75131da97269c68b9852dcda9cec4cb8f38a1845842387d952c1899f01e13
```

> Validator unavailable (gentle-ai 3.7.0); persisted by orchestrator override (gentle-ai#4699). `gentle-ai sdd-verify-validate` was not run.

## Verification Report

**Change**: hover-best-effort
**Version**: N/A (branch `fix/replay-settles-after-last-step` at HEAD `b053b00`, package 0.1.1)
**Mode**: Strict TDD

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 17 |
| Tasks complete | 17 |
| Tasks incomplete | 0 |

### Build & Tests Execution
**Build**: Passed (`pnpm build` exit 0)

**Tests**: 2270 passed / 0 failed / 6 skipped (`pnpm quality` exit 0: typecheck, lint:strict, format:check, deadcode, deps:check, test; 195 files passed, 1 skipped). No flake observed, so no isolation or `main` worktree comparison was needed.

**Coverage**: `pnpm test:coverage` exit 0. Lines 98.38%, statements 97.49%, branches 93.16%, functions 97.79%; above configured thresholds.

**Audit**: `pnpm audit` exit 0, no known vulnerabilities.

**Runtime probe** (headless, generated script in `.test-scratch`, removed afterwards; not part of the suite):
- Hover as last step, covered by the modal: `::warn "Skipped the hover of step 4: locator.hover: Timeout 2000ms exceeded."`, `::done 2653`, exit 0 (~2.9 s).
- Hover on a missing target then click on a missing element: one `::warn` for the hover after ~2 s, then the click keeps waiting with the default Patchright timeout (no warn, no skip) until the harness killed it at 20 s: clicks remain strict.

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| recording-capture: Deterministic hover | CSS menu | `hover-tracker.test.ts > records the hover on a CSS menu before the click on its hidden item`; `> still records the CSS menu hover right after a key press` | COMPLIANT |
| recording-capture: Deterministic hover | No noise | `hover-tracker.test.ts > records no hover for elements crossed without a DOM change` | COMPLIANT |
| recording-capture: Deterministic hover | Click opens a modal under a resting pointer | `hover-tracker.test.ts > records no hover for the element a click uncovers while the modal that click opens appears` | COMPLIANT |
| recording-capture: Deterministic hover | Keyboard activation opens a modal | (none found) | UNTESTED |
| recording-capture: Deterministic hover | Legitimate popover outside the window | `hover-tracker.test.ts > still records a popover that a hover opens after the activation window` | COMPLIANT |
| recording-capture: Deterministic hover | Rule 1 unchanged | `hover-tracker.test.ts` modal test (rule-1 hover on the dialog stored inside the click window) | COMPLIANT |
| replay: Hover warning surfaced | Modal covers a hovered header in CLI | `generated-script.test.ts > skips a hover that a modal covers...` (script level) + generic `run-replay-command.test.ts > prints the warnings of the script on stderr and still succeeds` | PARTIAL |
| replay: Hover warning surfaced | Same replay in the TUI | generic `timeline-replay-screens.test.ts > lists the warnings of the run after the launch warnings` | PARTIAL |
| replay: Hover warning surfaced | Working hover | `generated-script.test.ts > still performs the hover of a CSS menu without a warning` | COMPLIANT |
| replay: Hover warning surfaced | Later strict failure still fails | `generated-script.test.ts > keeps a later strict failure fatal while the skipped hover stays reported` (strict failure is a `set-input-files`, not a click) | PARTIAL |
| script-generation: Best-effort hover | Hover obscured by a modal | `generated-script.test.ts > skips a hover that a modal covers, warns once and runs the click inside the modal` | COMPLIANT |
| script-generation: Best-effort hover | Hover target missing | `generated-script.test.ts > warns and continues when the hover target does not exist`; `hover-prelude.test.ts > never throws, even for a missing target` | COMPLIANT |
| script-generation: Best-effort hover | Hover that works | `hover-prelude.test.ts > prints nothing when the hover works...`; `generated-script.test.ts > still performs the hover of a CSS menu without a warning` | COMPLIANT |
| script-generation: Best-effort hover | CSS menu hover still performed | `generated-script.test.ts > still performs the hover of a CSS menu without a warning` | COMPLIANT |
| script-generation: Best-effort hover | Skipped hover as last step | (none found; runtime probe passes) | UNTESTED |
| script-generation: Best-effort hover | Click strictness unchanged | `render-step.test.ts` click rows unchanged (static render only); no runtime test of an obscured/missing click | PARTIAL |

**Compliance summary**: 10/16 scenarios compliant, 4 partial, 2 untested; 0/3 requirements fully compliant.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Best-effort hover (2 s, one `::warn`, 1-based step, never fail) | Implemented | `hover-prelude.ts`: `HOVER_TIMEOUT_MS = 2000`, overridable `hoverTimeoutMs`; catch prints `::warn` with `step + 1` and first error line only; `render-step.ts` hover -> `await rt.hover(...)`; click/dblclick/check/fill/select/drag renderers untouched |
| Activation window (400 ms, click/dblclick/check/key, rule 1 unchanged) | Implemented | `is-caused-by-activation.ts` pure predicate `0 <= delta < 400`; `hover-tracker.ts` sets `lastActivationAtMs` in `afterEmit` for `ACTIVATING_KINDS` and skips `didMutate` in `onMutation`; `selectHoverTargets` untouched |
| Hover warning surfaced | Implemented (no code change) | Reuses existing `::warn` -> `parse-progress-line` -> CLI stderr / TUI warnings; `src/replay`, `src/cli`, `src/tui` not modified by this change |
| Coalescing rejection reconciled | Done | Spec delta removes the `Coalescing` requirement and the three post-click scenarios (commit 144461a); proposal has a Reconciliation note and no coalescing bullet; apply-progress records it |
| Constraints | Met | No main-world code (hover prelude is Node-side; tracker runs in the existing CDP isolated world); no `Runtime.enable`/`Console.enable`/`evaluate` added; no dependency or lockfile change; `package.json` untouched by this change (0.1.1 came from the earlier replay-settle commit 59b995b); nothing under `recordings/` touched |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Leniency in `hover-prelude.ts` runtime helper | Yes | `script-prelude.ts` now 299/300 lines |
| `HOVER_TIMEOUT_MS = 2000`, overridable | Yes | |
| First error line only, 1-based step from `currentStep` | Yes | |
| Capture rule (a) only, no Node coalescing | Yes | |
| `ACTIVATION_MUTATION_WINDOW_MS = 400` | Yes | |
| Activating kinds click/dblclick/check/key | Yes | key branch has no covering test (see CRITICAL 1) |
| Capture test asserts `['click','click']` | Deviated (documented) | Test asserts the two rule-1 hovers and no `columnheader "Fecha"`; recorded in apply-progress |

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | Yes | Table in apply-progress.md |
| All tasks have tests | Yes | Behavior tasks 2.x/3.x/4.x map to test files; 1.x/5.x docs |
| RED confirmed (tests exist) | Yes | All listed test files exist |
| GREEN confirmed (tests pass) | Yes | All listed tests pass in `pnpm quality` and `pnpm test:coverage` |
| Triangulation adequate | Partial | "key-press regression" does not exercise the key branch of the window: removing `key` from `ACTIVATING_KINDS` would leave every test green (rule-1 hover is recorded regardless) |
| Safety Net for modified files | Yes | Modified test files report prior passing counts |

**TDD Compliance**: 5/6 checks passed

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 15 (new/changed) | 3 (+5 goldens) | vitest |
| Integration (headless Chromium) | 7 (new) | 2 | vitest + patchright |
| E2E | 0 | 0 | |
| **Total** | **22** | **5** | |

### Changed File Coverage
| File | Line % | Branch % | Uncovered Lines | Rating |
|------|--------|----------|-----------------|--------|
| `src/recording-capture/domain/is-caused-by-activation.ts` | 100 | 100 | none | Excellent |
| `src/script-generation/domain/hover-prelude.ts` | 100 | 100 | none | Excellent |
| `src/script-generation/domain/script-prelude.ts` | 100 | 100 | none | Excellent |
| `src/script-generation/domain/render-step.ts` | 97.67 | 100 | L52 (pre-existing) | Excellent |
| `src/recording-capture/in-page/hover-tracker.ts` | excluded | excluded | runs in Chromium; covered by integration | N/A |

### Assertion Quality
**Assertion quality**: All assertions verify real behavior (no tautologies, no ghost loops; `toStrictEqual([])` in hover-prelude has non-empty companions).

### Quality Metrics
**Linter**: No errors (`lint:strict`, max-warnings 0)
**Type Checker**: No errors (node, in-page, tests)

### Issues Found
**CRITICAL**:
1. recording-capture scenario "Keyboard activation opens a modal" is UNTESTED. No test presses a key that opens a modal under a resting pointer; the existing key-press test only proves rule 1 still records a CSS menu hover, which passes with or without `key` in `ACTIVATING_KINDS`.
2. script-generation scenario "Skipped hover as last step" is UNTESTED in the suite. A headless runtime probe confirms the behavior (`::warn`, `::done`, exit 0), but no regression test covers it.

**WARNING**:
1. replay "Modal covers a hovered header in CLI" and "Same replay in the TUI" are PARTIAL: covered by the script-level replay test plus generic warning-surfacing tests, not by a hover warning through CLI/TUI, and no assertion that the hover's CLI step line is unchanged.
2. replay "Later strict failure still fails" is PARTIAL: the strict failure after the skipped hover is a `set-input-files`, not a click on a missing element as the scenario says.
3. script-generation "Click strictness unchanged" is PARTIAL: only render-level evidence; no runtime test that an obscured or missing click still fails with `::error`.
4. Task 2.7 says "CSS menu hover after a click"; the test uses a key press. Harmless but the task text and test diverge.

**SUGGESTION**:
1. `script-prelude.ts` is at 299/300 lines; the next runtime addition must move code out first.
2. The wire protocol mixes bases: `::step`/`::error` carry 0-based indexes while the hover `::warn` text is 1-based (intentional for human display); a one-line comment in `hover-prelude.ts` would prevent a future "fix".
3. For the CLI scenario, a `run-replay-command` test with a hover-shaped warning plus a step-line assertion would close WARNING 1 cheaply.

### Owner bug check
- Replay: the owner's sequence (click opens modal, hover on covered header at +9 ms, click inside modal) is reproduced by `modal-over-hover.html` and now exits 0 in ~3 s with one `::warn` naming step 4 and `::done`, instead of a 30 s timeout failure.
- Capture: the same fixture no longer records the `columnheader "Fecha"` noise hover after the click.

### Verdict
FAIL
Implementation is correct and all gates pass, but two spec scenarios (keyboard activation window, skipped hover as last step) have no covering test; adding two tests should make this PASS WITH WARNINGS.
