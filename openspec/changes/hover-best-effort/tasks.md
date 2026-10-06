# Tasks: Best-effort hovers and click-caused mutation attribution

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 450-650 (about 150 production, rest tests, goldens, docs) |
| 400-line budget risk | Medium (no review budget per AGENTS.md) |
| Chained PRs recommended | No |
| Suggested split | Single PR, commit groups per phase |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Docs reconciliation | PR 1 | `pnpm format:check` | N/A, docs only | Phase 1 commit |
| 2 | Replay best-effort hover | PR 1 | `pnpm vitest run tests/unit/script-generation tests/integration` | headless `modal-over-hover.html` replay | Phase 3 commits |
| 3 | Capture activation window | PR 1 | `pnpm vitest run tests/unit/recording-capture tests/integration` | headless capture on `modal-over-hover.html` | Phase 2 and 4 commits |

Order is sequential. Hard rules: headless only, no page main-world code, no Runtime.enable/Console.enable, no new dependency, no version bump (branch is 0.1.1).

## Phase 1: Spec reconciliation (design wins)

- [x] 1.1 In `specs/recording-capture/spec.md` remove the coalescing-drop sentence and scenarios "Post-click non-ancestor hover dropped", "Post-click ancestor hover kept", "Hover outside the window kept"; keep the Deterministic hover window rule and its scenarios.
- [x] 1.2 In `proposal.md` drop the Coalescing scope bullet and `coalesce-events.ts`, add a note: Node-side coalescing not implemented (no DOM ancestry in `Target`); window 400 ms.

## Phase 2: RED tests and fixture

- [ ] 2.1 Create `tests/fixtures/site/modal-over-hover.html`: menu item over a table header; click hides the menu, opens a full-page modal next frame with `Confirmar`.
- [ ] 2.2 RED replay integration (`generated-script.test.ts`): click, hover on covered header, click `Confirmar`; expect exit 0, one `::warn` naming step, `::done` (fails today with 30 s timeout).
- [ ] 2.3 RED capture integration (`hover-tracker.test.ts`): click item then `Confirmar`; expect kinds `['click','click']`, no hover (fallback: move mouse onto header inside the window).
- [ ] 2.4 RED unit `is-caused-by-activation`: null, 0, 399, 400, negative delta.
- [ ] 2.5 RED unit `hover-prelude` (`new Function` loader, fake locator): success prints nothing; rejection prints one `::warn` with 1-based step and first error line only; never throws; missing target warns.
- [ ] 2.6 RED unit `render-step`: hover renders `await rt.hover(<target>);`; click stays `.click()`.
- [ ] 2.7 Regression tests on `hover-menu.html`: CSS menu hover after a click is still recorded and still performed on replay (no warn); JS popover opened more than 400 ms after click still records its hover.

## Phase 3: Replay GREEN

- [ ] 3.1 Create `src/script-generation/domain/hover-prelude.ts`: `HOVER_TIMEOUT_MS = 2000`, `createHovering`, `describeSkippedHover` (no backticks or dollar-brace); overridable `options.hoverTimeoutMs`.
- [ ] 3.2 Modify `script-prelude.ts` (keep at most 300 lines): include prelude, add `hover: hovering.hover` to the runtime.
- [ ] 3.3 Modify `render-step.ts`: hover emits `await rt.hover(<target>);`. Make 2.5, 2.6, 2.2 and the replay half of 2.7 pass.
- [ ] 3.4 Regenerate `tests/unit/script-generation/goldens/*.mjs`; review the diff is only prelude plus hover line.

## Phase 4: Capture GREEN

- [ ] 4.1 Create `src/recording-capture/domain/is-caused-by-activation.ts`: `ACTIVATION_MUTATION_WINDOW_MS = 400`, pure predicate.
- [ ] 4.2 Modify `hover-tracker.ts`: `ACTIVATING_KINDS` (`click`, `dblclick`, `check`, `key`), set `lastActivationAtMs` in `afterEmit`, guard `onMutation`. Make 2.3, 2.4 and the capture half of 2.7 pass.
- [ ] 4.3 REFACTOR: confirm functions at most 40 lines, no magic numbers, dependency boundaries intact.

## Phase 5: Docs

- [ ] 5.1 Update `README.md` (replay hovers are best effort, `::warn`) and, if the security or hover wording appears, `SECURITY.md`.
- [ ] 5.2 Fix spec text left in `openspec/specs/` only at archive; record reconciliation in apply-progress notes.

## Phase 6: Final gates

- [ ] 6.1 `pnpm quality`, `pnpm test:coverage`, `pnpm build`; confirm no headed browser and no change under `recordings/`.
