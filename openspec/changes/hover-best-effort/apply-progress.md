# Apply progress: hover-best-effort

Mode: Strict TDD. Delivery: single PR, commit groups. All 6 phases done (17/17 tasks).

## Reconciliation notes (design wins)

- Node-side coalescing (proposal bullet, spec "Coalescing" delta) is not implemented: the coalescer has no DOM ancestry in `Target`. Removed from the proposal and from the recording-capture delta spec in phase 1. Activation window is 400 ms.
- `openspec/specs/` main specs are updated at archive time only (task 5.2).
- Design/test detail: the capture fixture still reports rule 1 hovers (`#menu` before the first click, the dialog before the click inside it); the test asserts exactly those two and no `columnheader "Fecha"`, instead of the literal kinds `['click','click']` in the task text. The layout-driven `pointerover` does fire in headless Chromium, so no mouse-move fallback was needed.
- Hover step numbers are 1-based (`currentStep + 1`), matching `[15/18]`.

## TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | Triangulate | Refactor |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1-1.2 | n/a (docs) | n/a | `pnpm format:check` ok | n/a | n/a | n/a | n/a |
| 2.1 fixture | `tests/fixtures/site/modal-over-hover.html` | fixture | n/a (new) | used by 2.2/2.3 REDs | used by GREENs | 2 tests use it | n/a |
| 2.2 / 3.3 replay | `tests/integration/script-generation/generated-script.test.ts` | integration (headless) | 17 existing tests passing in the file | modal case and missing-target case: exit code `null` (killed after the 30 s hover timeout), no `::done` | 2 passed (3 s each, one `::warn` naming step 4, `::step 4` runs the click in the modal, `::done`) | missing target; CSS menu hover (no warn); skipped hover then strict `::error 4` | prettier, naming lint fix (`openModal`) |
| 2.3 / 4.2 capture | `tests/integration/recording-capture/hover-tracker.test.ts` | integration (headless) | 8 passing | received hover on `columnheader "Fecha"` (the owner's noise hover) | 11 passed | key-press regression, popover past window | none needed |
| 2.4 / 4.1 | `tests/unit/recording-capture/is-caused-by-activation.test.ts` | unit | n/a (new) | `Cannot find module` | 6 passed | null, 0, 399, 400, 5000, negative | none |
| 2.5 / 3.1 | `tests/unit/script-generation/hover-prelude.test.ts` | unit | n/a (new) | `Cannot find module` | 7 passed | steps 15, 1, null; multi-line error; missing target | none |
| 2.6 / 3.3 | `tests/unit/script-generation/render-step.test.ts` | unit | existing file passing | 2 failed (`.hover()` rendered) | passed | hover in a frame on page2; click rows unchanged | none |
| 3.2 | `generate-script.test.ts` goldens | unit | 5 goldens passing before | 5 failed after the prelude change | regenerated, 5 passed; diff is prelude block, `hovering` const, `hover:` member and the hover line only | 5 goldens | none |
| 2.7 regression | `hover-tracker.test.ts`, `generated-script.test.ts` | integration | n/a | passed immediately (regression) | n/a | proven by mutation (below) | none |
| 4.3 | n/a | refactor | `pnpm lint:strict`, `deps:check` ok | n/a | n/a | n/a | all functions under 40 lines, constants named, no boundary change |
| 5.1 | README | docs | `format:check` ok | n/a | n/a | n/a | n/a |
| 6.1 | gates | n/a | n/a | n/a | see below | n/a | n/a |

Mutation checks for the regressions that passed immediately:

- Window 400 -> 1000 ms: "popover opened after the activation window" fails (the test waits a literal 500 ms).
- Drop every hover emitted inside the window (a coalescing-style rule): "CSS menu hover right after a key press" and the modal test fail.
- Runtime hover always rejecting: "still performs the hover of a CSS menu without a warning" fails.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `pnpm vitest run tests/unit/script-generation tests/unit/recording-capture/is-caused-by-activation.test.ts tests/integration/script-generation tests/integration/recording-capture/hover-tracker.test.ts`: all passed |
| Runtime harness | headless `modal-over-hover.html` replay and capture: pass |
| Rollback boundary | commit `fix(script-generation)` (replay) and commit `fix(recording-capture)` (capture) are independent |

## Final gates

`pnpm quality` exit 0 (195 files passed, 2270 tests passed, 6 skipped), `pnpm test:coverage` passed (lines 98.38%), `pnpm build` exit 0, `pnpm audit` no known vulnerabilities. No headed browser, nothing under `recordings/` read or changed, no version bump, no new dependency.
