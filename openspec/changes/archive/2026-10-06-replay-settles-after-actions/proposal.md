# Proposal: Replay settles after actions

## Intent

A replayed script can close the browser before the last action takes effect.
Real case (see `explore.md`): the final click on "Confirmar" triggers a POST and
a reload of the SAME URL; the `wait-for-url` follow-up resolves at once because
`waitForURL` matches the current URL, `close()` runs, and the confirmation is
lost. Replays must not report success for work the site never received.

## Scope

### In Scope
- `wait-for-url` follow-up waits for a NEW main-frame navigation armed before the
  triggering action (same-URL navigations included), matched on origin+pathname,
  default timeout, clear failure message.
- Before `::done`/close on success: wait for network quiet (no in-flight
  requests for a short window), capped by a maximum, tracked in Node from
  `request`/`requestfinished`/`requestfailed` (no page code, no
  `Runtime.enable`/`Console.enable`). Recorded and human timing.
- Local fixture reproducing the bug (modal, delayed POST, same-URL reload).
- Patch bump `0.1.0` -> `0.1.1` (release-impacting fix).

### Out of Scope
- Quiet waits between steps or after navigation follow-ups (explore decision 3).
- Recording/capture changes; migration (scripts regenerate before every replay).
- User-configurable quiet window or cap.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `script-generation`: Event-to-code mapping for `wait-for-url` (new navigation,
  not current URL); new settle-before-close requirement in the runtime.
- `replay`: success is reported only after the script settles; failure on a
  navigation timeout names the step.

## Approach

- Runtime tracks main-frame `framenavigated` per page with a sequence counter;
  each action step snapshots it, so the `wait-for-url` step awaits a navigation
  newer than the snapshot. Avoids generator look-ahead and keeps `renderStep` pure.
- `rt.settle()` (quiet window + cap, named constants) runs before `rt.done()`;
  skipped on failure and abort. Cap exhaustion is not a failure.
- Strict TDD: RED fixture test where the server never records the POST.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/script-generation/domain/render-step.ts` | Modified | `wait-for-url` rendering |
| `src/script-generation/domain/script-prelude.ts` | Modified | navigation tracker, settle |
| `src/script-generation/domain/generate-script.ts` | Modified | settle before `rt.done()` |
| `tests/` fixtures | New | modal + delayed POST fixture |
| `package.json` | Modified | patch version |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Long-polling/websockets never go quiet | Med | Hard cap; websockets are not `request` events; ignore long-lived requests after the cap |
| Same-URL navigation missed or a stale one matched | Med | Snapshot armed before the action; fixture covers same-URL reload |
| Human timing: settle adds delay or interacts with pacing | Low | Settle is independent of pacing; no drift check in human mode |
| Recorded-mode ±100 ms drift | Low | Settle runs only after the last step |
| Prelude grows past lint limits | Low | Split into its own prelude module |

## Rollback Plan

Revert the single squash-merged PR; scripts regenerate before each replay, so no
data or migration cleanup is needed.

## Success Criteria

- [ ] Fixture: the POST from the last click is recorded by the server before close.
- [ ] A same-URL action navigation is awaited; a missing one fails with a clear message.
- [ ] A never-quiet page finishes within the cap.
- [ ] `pnpm quality`, coverage and build pass.

## Proposal question round (assumptions for owner review)

1. Quiet window ~500 ms, cap ~5 s: acceptable defaults?
2. Should hitting the cap be silent success or a warning line?
3. Should a missing action navigation fail the replay (assumed yes) or only warn?
