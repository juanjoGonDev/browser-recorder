```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:b7362c6af740c3a8b7cc5705e2a1bf21a7fc5bfe14061cdc7674faea2d6fd3b2
verdict: pass
blockers: 0
critical_findings: 0
requirements: 1/3
scenarios: 14/16
test_command: pnpm quality
test_exit_code: 0
test_output_hash: sha256:910031d8c41c5c5c23e95901f494840a330572be19b8a25bf59d7fa43cf6440e
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:7e117fe8d7e05c326be5952f8a63eb983defb3ceb1b1f03be8fd6c1a31f46150
```

> Validator unavailable (gentle-ai 3.7.0); persisted by orchestrator override (gentle-ai#4699). `gentle-ai sdd-verify-validate` was not run.

## Verification Report (re-verify after remediation R.1-R.5)

**Change**: hover-best-effort
**Version**: N/A (branch `fix/replay-settles-after-last-step` at HEAD `72dee97`, package 0.1.1)
**Mode**: Strict TDD

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 22 (17 original + 5 remediation) |
| Tasks complete | 22 |
| Tasks incomplete | 0 |

### Build & Tests Execution
Gates run sequentially on HEAD `72dee97`.

**Tests**: `pnpm quality` exit 0 (typecheck, lint:strict, format:check, deadcode, deps:check, test). 195 files passed, 1 skipped; 2275 passed, 6 skipped (was 2270; +5 remediation tests). No flake.

**Coverage**: `pnpm test:coverage` exit 0. Lines 98.38%, statements 97.49%, branches 93.16%, functions 97.79%.

**Build**: `pnpm build` exit 0.

**Audit**: `pnpm audit` exit 0, no known vulnerabilities.

**Independent mutation probes** (detached worktree, removed afterwards; main checkout untouched):
- R.1: `'key'` removed from `ACTIVATING_KINDS` -> exactly 1 of 12 hover-tracker tests fails (the new key-press test, received `columnheader "Fecha"`). Apply claim confirmed.
- R.4 mutant A, click swallows errors with the default timeout (`.click(opts).catch(() => {})`): the R.4 test still PASSES (killed at 20 s either way).
- R.4 mutant B, click made best-effort like a hover (`.click({ timeout: 2000 }).catch(() => {})`): the R.4 test FAILS (5.4 s, `::done` printed).

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| recording-capture: Deterministic hover | CSS menu | `hover-tracker.test.ts > records the hover on a CSS menu before the click on its hidden item` | COMPLIANT |
| recording-capture: Deterministic hover | No noise | `hover-tracker.test.ts > records no hover for elements crossed without a DOM change` | COMPLIANT |
| recording-capture: Deterministic hover | Click opens a modal under a resting pointer | `hover-tracker.test.ts > records no hover for the element a click uncovers while the modal that click opens appears` | COMPLIANT |
| recording-capture: Deterministic hover | Keyboard activation opens a modal | `hover-tracker.test.ts > records no hover for the element a key press uncovers while the modal that key opens appears` (fixture `key-opens-modal.html`; mutation-proven) | COMPLIANT |
| recording-capture: Deterministic hover | Legitimate popover outside the window | `hover-tracker.test.ts > still records a popover that a hover opens after the activation window` | COMPLIANT |
| recording-capture: Deterministic hover | Rule 1 unchanged | modal tests (rule-1 hover on the dialog stored inside the click/key window); `> still records the CSS menu hover right after a key press` | COMPLIANT |
| replay: Hover warning surfaced | Modal covers a hovered header in CLI | `generated-script.test.ts > skips a hover that a modal covers...` (real `::warn`) + `run-replay-command.test.ts > prints the warning of a skipped hover on stderr and keeps the step line` (stderr exactly one line, nothing on stdout, success line, exit 0) | COMPLIANT |
| replay: Hover warning surfaced | Same replay in the TUI | `timeline-replay-screens.test.ts > lists the warning of a skipped hover while the replay succeeds` | COMPLIANT |
| replay: Hover warning surfaced | Working hover | `generated-script.test.ts > still performs the hover of a CSS menu without a warning` | COMPLIANT |
| replay: Hover warning surfaced | Later strict failure still fails | `generated-script.test.ts > keeps a click on a missing element strict after a skipped hover` (warning reported, no `::done`, non-zero exit) + `> keeps a later strict failure fatal while the skipped hover stays reported` (`::error 4` naming the step, but a `set-input-files`) | PARTIAL |
| script-generation: Best-effort hover | Hover obscured by a modal | `generated-script.test.ts > skips a hover that a modal covers, warns once and runs the click inside the modal` | COMPLIANT |
| script-generation: Best-effort hover | Hover target missing | `generated-script.test.ts > warns and continues when the hover target does not exist`; `hover-prelude.test.ts > never throws, even for a missing target` | COMPLIANT |
| script-generation: Best-effort hover | Hover that works | `hover-prelude.test.ts > prints nothing when the hover works...`; CSS menu replay test | COMPLIANT |
| script-generation: Best-effort hover | CSS menu hover still performed | `generated-script.test.ts > still performs the hover of a CSS menu without a warning` | COMPLIANT |
| script-generation: Best-effort hover | Skipped hover as last step | `generated-script.test.ts > warns about a skipped hover that is the last step, then finishes` (`::warn` before `::done`, no `::error`, exit 0) | COMPLIANT |
| script-generation: Best-effort hover | Click strictness unchanged | `generated-script.test.ts > keeps a click on a missing element strict after a skipped hover`; `render-step.test.ts` click rows | PARTIAL |

**Compliance summary**: 14/16 scenarios compliant, 2 partial, 0 untested, 0 failing; 1/3 requirements fully compliant (recording-capture).

### R.4 assessment (critical judgment requested)
The test is not tautological: it calls the real generated runtime and kills the realistic regression (routing clicks through a best-effort, short-timeout path), proven by mutant B. It is weak evidence for the scenario as written ("fails with `::error` naming the step"):
- It never observes `::error`; a SIGKILL gives `exitCode === null`, which `not.toBe(0)` accepts. Any hang after the hover would also pass.
- Mutant A (click swallows its error after the default 30 s timeout) survives, so "failure stops the script" is not proven for clicks.
- It spends 20 s of suite time and depends on the default Patchright timeout staying above the 20 s harness kill; it would silently keep passing if that default changed.
Classification: PARTIAL / WARNING. The `::error` path of the runtime is proven by the pre-existing `set-input-files` tests and click renderers are unchanged by this change, so it is not a CRITICAL gap.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Best-effort hover | Implemented | `hover-prelude.ts` (`HOVER_TIMEOUT_MS = 2000`, first error line, 1-based step, never rejects); `render-step.ts` hover -> `rt.hover`; other renderers unchanged |
| Activation window | Implemented | `is-caused-by-activation.ts` (`ACTIVATION_MUTATION_WINDOW_MS = 400`); `hover-tracker.ts` `ACTIVATING_KINDS` click/dblclick/check/key |
| Hover warning surfaced | Implemented (no code change) | Existing `::warn` path to CLI stderr / TUI warnings |
| Constraints | Met | No page main-world code; no `Runtime.enable`/`Console.enable`/`evaluate`/`addInitScript` in the change diff; `package.json` and lockfile untouched since `a9caeb1`; `script-prelude.ts` 299/300; R.5 comment outside the generated string (goldens unchanged); nothing under `recordings/` touched |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Leniency in `hover-prelude.ts` helper | Yes | |
| `HOVER_TIMEOUT_MS = 2000`, overridable | Yes | |
| First error line, 1-based step | Yes | R.5 comment documents 1-based vs 0-based markers |
| Capture rule (a) only, no Node coalescing | Yes | Reconciled in phase 1 |
| `ACTIVATION_MUTATION_WINDOW_MS = 400` | Yes | |
| Activating kinds incl. `key` | Yes | Now covered (R.1) |
| Capture test asserts `['click','click']` | Deviated (documented) | Asserts rule-1 hovers only, no `columnheader "Fecha"` |

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | Yes | apply-progress.md, incl. remediation table |
| All tasks have tests | Yes | R.1-R.4 add tests; R.5 is a comment |
| RED confirmed (tests exist) | Yes | All listed files exist |
| GREEN confirmed (tests pass) | Yes | All pass in `pnpm quality` and `pnpm test:coverage` |
| Triangulation adequate | Yes | Key branch now mutation-proven; click-strictness test only kills short-timeout leniency |
| Safety Net for modified files | Yes | |

**TDD Compliance**: 6/6. Note: R.2-R.4 are regression tests over behavior that already existed, so no RED was observable; only R.1 was proven by mutation (independently reproduced here).

### Test Layer Distribution (change total)
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 17 | 5 (+5 goldens) | vitest |
| Integration (headless Chromium) | 10 | 2 | vitest + patchright |
| E2E | 0 | 0 | |
| **Total** | **27** | **7** | |

### Changed File Coverage
| File | Line % | Branch % | Uncovered Lines | Rating |
|------|--------|----------|-----------------|--------|
| `src/recording-capture/domain/is-caused-by-activation.ts` | 100 | 100 | none | Excellent |
| `src/script-generation/domain/hover-prelude.ts` | 100 | 100 | none | Excellent |
| `src/script-generation/domain/script-prelude.ts` | 100 | 100 | none | Excellent |
| `src/script-generation/domain/render-step.ts` | 97.67 | 100 | L52 (pre-existing) | Excellent |
| `src/recording-capture/in-page/hover-tracker.ts` | excluded | excluded | in-page; covered by integration | N/A |

### Assertion Quality
No tautologies, ghost loops or orphan empty checks. One weak assertion:
| File | Line | Assertion | Issue | Severity |
|------|------|-----------|-------|----------|
| `tests/integration/script-generation/generated-script.test.ts` | 631 | `expect(run.exitCode).not.toBe(0)` | Satisfied by `null` from the 20 s SIGKILL; the test never observes the click failing, only that the script did not finish | WARNING |

**Assertion quality**: 0 CRITICAL, 1 WARNING

### Quality Metrics
**Linter**: No errors (`lint:strict`)
**Type Checker**: No errors

### Issues Found
**CRITICAL**: None. Both previous CRITICALs (Keyboard activation opens a modal; Skipped hover as last step) are closed by passing tests; the key test is mutation-proven.

**WARNING**:
1. script-generation "Click strictness unchanged" is PARTIAL: the R.4 test relies on the harness kill at 20 s, never sees `::error`, accepts `exitCode === null`, and lets an error-swallowing click with the default timeout survive (mutant A). It does kill a short-timeout lenient click (mutant B).
2. replay "Later strict failure still fails" is PARTIAL: no test shows a click failure naming the click step after a skipped hover; the `::error` naming the step is only shown for a `set-input-files`.

**SUGGESTION**:
1. Close both warnings cheaply with a test-only action timeout (for example an env variable read by the runtime that sets `context.setDefaultTimeout`, used only by tests), then assert `::error <step>` and `exitCode === 1` in about 2 s. This also removes 20 s from the suite. It adds product surface, so it is a tradeoff, not a requirement.
2. Task 2.7 text says "CSS menu hover after a click"; the test uses a key press. Rule-1 after a click is covered by the modal test (dialog hover), so this is wording only.
3. `script-prelude.ts` is at 299/300 lines; the next runtime addition must move code out first.

### Verdict
PASS WITH WARNINGS
All 22 tasks are done and every gate passes. No CRITICAL is left, and the two PARTIAL scenarios are about click-failure evidence for code this change did not touch.
