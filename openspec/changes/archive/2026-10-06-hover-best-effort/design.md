# Design: Best-effort hovers and click-caused mutation attribution

## Technical Approach

Two independent fixes: (1) replay renders hovers through a best-effort runtime helper that warns instead of failing; (2) capture stops blaming an action's own DOM changes on the element under a resting pointer. Replay is the safety net for any noise hover capture still lets through.

**How the header got into the trace** (from `hover-tracker.ts`): the click on the menu item emits `click`, and `afterEmit` clears `trace` (not `hovered`). The app then removes the menu, and Chromium fires layout-driven boundary events under the stationary cursor: `pointerover` on the header ~9 ms later, so it enters a fresh trace. The modal opening (more mutations) runs while the header is still in `hovered`, so `didMutate = true`. At the next pointerdown, rule 2 selects it as the last mutating non-ancestor. It is a `pointerover` caused by a DOM change, not a real re-entry; both paths are handled the same way below.

## Architecture Decisions

| Decision | Options / tradeoff | Choice |
|---|---|---|
| Where hover leniency lives | Patch `render-step` with `.hover({timeout}).catch()` (logic in every step, no warning) vs runtime helper | New `hover-prelude.ts` with `createHovering`; `script-prelude.ts` is at 291/300 lines, so only ~4 lines are added there |
| Hover timeout | 1 s (too short on slow pages) / 5 s (long stall per noise hover) | `HOVER_TIMEOUT_MS = 2000`, overridable via `options.hoverTimeoutMs` for tests |
| Warning reason | Full Patchright message (call log contains page DOM snippets) vs first line | First line of the error message only; the step is numbered 1-based (`currentStep + 1`), matching `[15/18]` and `failed at step 15` |
| Step reference | Pass the number from `render-step` vs read `currentStep` | Read `currentStep` (set by `rt.mark`), like `settlePrelude`'s `describeStep`; renders `await rt.hover(<locator>);` |
| Capture rule | (a) Ignore mutations inside a window after an activation; (b) also make entries entered inside the window ineligible for rule 2; (c) Node-side coalescing drop | (a) only. See below |
| Window length | 300 ms (misses a modal opened after one animation frame plus a short delay) / 500 ms (hides more genuine popovers) | `ACTIVATION_MUTATION_WINDOW_MS = 400` |
| What counts as activation | Every non-hover action (scroll emits continuously, fill emits on input) vs pointer and keyboard activations | Emitted payload kinds `click`, `dblclick`, `check`, `key` (`ACTIVATING_KINDS`) |

**Why (a) only.** (c) cannot be done faithfully: the coalescer sees `Target` locators, not DOM ancestry, so "not an ancestor of the next target" is impossible to evaluate in Node. A time-only drop would also delete legitimate rule-1 (CSS `:hover`) hovers entered right after a click. In-page selection already emits rule-2 hovers only for non-ancestors, so the in-page fix covers the same case. (b) would also hide a real JS popover entered quickly after a click and adds a second concept. The case (a) misses (a modal mutating more than 400 ms after the click while the pointer rests on a new element) is downgraded to a `::warn` by replay. This narrows the proposal's coalescing bullet: the apply notes and spec reconciliation must record that the coalescing rule is not implemented.

The time predicate is a pure domain function, so its boundaries get unit tests without a browser.

## Data Flow

    click/key emitted --afterEmit--> lastActivationAtMs = now
    MutationObserver --> isCausedByActivation(now, lastActivationAtMs)?
                          yes: skip | no: mark hovered trace entries didMutate
    pointerdown --> selectHoverTargets (unchanged) --> hover messages

    generated script: rt.mark(i) -> rt.hover(locator)
       -> locator.hover({ timeout: 2000 }) ok | catch -> '::warn "Skipped the hover of step N: <first line>"'
       -> parseProgressLine 'warning' -> replay-progress.warnings -> CLI stderr / TUI (already wired)

## File Changes

| File | Action | Description |
|---|---|---|
| `src/recording-capture/domain/is-caused-by-activation.ts` | Create | `ACTIVATION_MUTATION_WINDOW_MS`, pure predicate |
| `src/recording-capture/in-page/hover-tracker.ts` | Modify | `lastActivationAtMs`, `ACTIVATING_KINDS`, guard in `onMutation`, set in `afterEmit` |
| `src/script-generation/domain/hover-prelude.ts` | Create | `HOVER_TIMEOUT_MS`, `createHovering`, `describeSkippedHover` (no backticks, no dollar-brace) |
| `src/script-generation/domain/script-prelude.ts` | Modify | Include the prelude; `hover: hovering.hover` on the runtime |
| `src/script-generation/domain/render-step.ts` | Modify | `hover` renders `await rt.hover(<target>);` |
| `tests/unit/script-generation/goldens/*.mjs` | Modify | Regenerated: prelude and hover line |
| `tests/fixtures/site/modal-over-hover.html` | Create | Menu item over a table header; the click hides the menu and opens a full-page modal in the next frame with a `Confirmar` button |
| `src/replay/**`, `src/cli/**`, `src/tui/**` | None | `::warn` is already parsed and shown; the result stays success |

## Interfaces / Contracts

```ts
export const ACTIVATION_MUTATION_WINDOW_MS = 400;
export function isCausedByActivation(mutationAtMs: number, activationAtMs: number | null): boolean;
// true when activationAtMs !== null && 0 <= mutationAtMs - activationAtMs < WINDOW
```

```js
// hover-prelude (runtime string)
function createHovering({ timeoutMs, print, describeStep }) -> { hover(locator): Promise<void> }
```

`hover` never rejects. No recording format, port or `ReplayResult` change.

## Testing Strategy (RED first)

| Layer | What | Approach |
|---|---|---|
| Unit | `isCausedByActivation`: null, 0, 399, 400, negative delta | Pure |
| Unit | `hover-prelude`: success prints nothing; rejection prints one `::warn` with a 1-based step and first line only; never throws | `new Function` loader like `load-timing-prelude.ts`, fake locator |
| Unit | `render-step` hover renders `rt.hover`; goldens | Existing tests updated |
| Integration (replay) | `modal-over-hover.html`: click opens the modal, then a hover on the covered header, then click `Confirmar`; RED fails today, GREEN exits 0 with one `::warn` and `::done` | `generated-script.test.ts`, headless |
| Integration (capture) | Pointer on the menu item, click, then click `Confirmar`: kinds `['click','click']`, no hover. If headless Chromium does not fire layout boundary events, the test moves the mouse onto the header inside the window (same rule) | `hover-tracker.test.ts` |
| Regression | CSS menu hovered right after a click is still recorded (rule 1); JS popover hovered more than 400 ms after a click is still recorded (rule 2) | `hover-menu.html` |

## Threat Matrix

N/A: no routing, shell, subprocess, VCS/PR automation, executable-file classification or process-integration boundary changes. The warning carries only the first error line, never the Patchright call log.

## Migration / Rollout

No migration. Existing recordings regenerate scripts with `rt.hover`. No version bump (the branch already carries 0.1.1).

## Open Questions

- [ ] Whether headless Chromium fires layout-driven `pointerover`; the fallback test keeps the capture case deterministic either way.
