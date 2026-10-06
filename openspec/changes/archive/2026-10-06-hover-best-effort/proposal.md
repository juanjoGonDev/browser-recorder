# Proposal: Best-effort hovers and click-caused mutation attribution

## Intent

A real replay dies at step 15: a `hover` on a table header recorded 9 ms after the click that opened a modal. On replay the modal covers the header, Patchright retries for 30 s (the up/down scrolling the owner saw) and the whole replay fails. Two defects: capture records a noise hover (the click's DOM change is blamed on the element under the pointer), and replay treats a hover as essential. See `explore.md` for evidence and decisions.

## Scope

### In Scope
- Replay: hovers render as `rt.hover(locator)`, tried with a short timeout (~2 s); on failure print `::warn` naming the step and continue.
- Capture: DOM mutations within a short window (300–500 ms) after a click or keyboard activation are attributed to that action, so hover rule 2 does not fire for them.
- Fixtures reproducing both defects (RED first).

### Out of Scope
- Clicks, fills, checks, selects, drags: strict behavior unchanged.
- Hover rule 1 (outermost ancestor of the next target) unchanged.
- Rewriting existing recordings; changing recorded/human timing.
- Version bump: the branch already bumps 0.1.0 -> 0.1.1 for this unreleased PR (overrides explore decision 5).

## Reconciliation note

Node-side coalescing is not implemented: the coalescer sees `Target` locators, not DOM ancestry, so "not an ancestor of the next target" cannot be evaluated there (see `design.md`). The in-page activation window (400 ms) covers the same case.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `recording-capture`: "Deterministic hover" rule 2 ignores mutations caused by an action.
- `script-generation`: hover steps render through a best-effort runtime helper that emits `::warn` instead of failing.
- `replay`: a hover warning is surfaced (CLI stderr, TUI warnings) without changing the success result.

## Approach

- `hover-tracker.ts`: record the last activation time; `onMutation` skips `didMutate` inside the window.
- `script-prelude.ts`: `hover` helper on the runtime, reusing the existing `::warn` channel; `render-step.ts` emits `await rt.hover(...)`.
- Replay already parses `::warn`; extend only if the message needs a step reference.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/recording-capture/in-page/hover-tracker.ts` | Modified | Activation window |
| `src/script-generation/domain/{render-step,script-prelude}.ts` | Modified | `rt.hover` |
| `src/replay/` | Possibly modified | Warning surfacing |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A hover that matters (CSS `:hover` menu) is skipped | Low | Skip only when the hover cannot be performed; then the next click fails with its own clear error |
| Window hides a genuine JS popover hovered right after a click | Low | Short window; rule 2 still applies outside it |
| 2 s timeout too short for slow pages | Med | Named constant; warning makes it visible |

## Rollback Plan

Revert the change's commits: `render-step` returns to `locator.hover()`, the tracker loses the window rule. No data migration; recordings are unchanged.

## Dependencies

- None beyond Patchright.

## Success Criteria

- [ ] Modal fixture: replay passes with one `::warn` for the hover (fails today).
- [ ] Capture fixture: no hover recorded when a click opens a modal under a resting pointer.
- [ ] CSS-menu scenario still records and replays its hover.
- [ ] `pnpm quality`, coverage and build pass.

## Proposal question round

Mode auto; assumptions for owner review:
1. Hover timeout ~2 s, window 300–500 ms (exact values fixed in design).
2. A skipped hover never fails the replay, even when followed by nothing.
3. Should a skipped hover appear in the CLI step line or only as a stderr warning? Assumed: warning only.
