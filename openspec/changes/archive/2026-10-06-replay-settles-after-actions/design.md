# Design: Replay settles after actions

## Technical Approach

Two runtime behaviors in the generated script, both Node-side Patchright events:

1. **Navigation tracker**: every page gets a main-frame `framenavigated` log
   `{ seq, url }`. Each action step arms a per-page snapshot; a `wait-for-url`
   follow-up awaits the first logged navigation newer than the snapshot whose
   origin+pathname matches, then consumes it.
2. **Network settle**: context-level `request`/`requestfinished`/`requestfailed`
   keep an in-flight set; `await rt.settle()` runs once before `rt.done()`.

`renderStep` stays pure with no look-ahead.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|---|---|---|---|
| Navigation signal | `page.on('framenavigated')`, `frame === page.mainFrame()` | `waitForURL` (resolves on the current URL: the bug); `waitForEvent` armed before the action (generator look-ahead); deprecated `waitForNavigation` | Patchright (Playwright core) emits `framenavigated` on every committed main-frame navigation, reloads to the same URL included; the fixture confirms it RED/GREEN |
| Where to arm | End of `rt.at(offset)` when `isFollowUp` is false (after the sleep, right before the action) | Arm in `mark` with implicit state; generator passes the trigger index | `at` already knows `isFollowUp`; no golden change for `at`/`mark` lines |
| Matching | First navigation with `seq > armed` and origin+pathname equal; consumed on match; then `waitForLoadState('load')` | Latest navigation only | Handles a navigation that finished before the follow-up ran, chains of redirects, and keeps parity with `waitForURL`'s load wait |
| Navigation timeout | `NAVIGATION_TIMEOUT_MS = 30000` (Patchright default kept) | `DEFAULT_WAIT_MS` | Proposal: keep the existing default |
| Settle rule | Quiet when the in-flight set is empty and no request activity for `QUIET_WINDOW_MS = 500`, measured from `max(lastActivity, settleStart)`; cap `SETTLE_CAP_MS = 5000`; poll every `SETTLE_POLL_MS = 50` via injected `sleep` | Return at once when idle | A click often fires its request after a short client delay; always waiting one window catches it |
| Ignored requests | URLs starting with `data:` or `blob:`; websockets never emit `request` | Per-resource-type filters | Minimal, matches the proposal |
| Settle scope | Only on success, after the last step; skipped on failure (`catch`) and abort (`process.exit`) | Between steps | Explore decision 3; no recorded-mode drift impact |
| Cap reached | Success plus `::warn <json-string>` on stdout | Plain stderr | Stderr is shown only as the failure tail and carries Patchright noise, so a success-time stderr line would be invisible. Stdout is the parsed progress channel; the CLI then writes it to its own stderr as `! ...` |
| Warning content | Count only: `Stopped waiting for the network after 5 s; N requests were still in flight` | URLs | URLs may carry tokens; recordings are sensitive |
| File placement | New `settle-prelude.ts` (trackers, constants, moved `withTimeout`); scroll page functions move to `scroll-prelude.ts` | Grow `script-prelude.ts` | It already has 293 non-blank lines (limit 300) |

## Data Flow

    context 'page' ─→ navigation tracker (per page log) ←─ rt.at() arms
    context request events ─→ in-flight set
    steps … wait-for-url ─→ rt.waitForNavigation(page, originPath) ─┐ timeout → ::error i "…"
    last step ok ─→ rt.settle() ─→ [cap] ::warn "…" ─→ rt.done() ─→ ::done
    stdout ─→ parseProgressLine {kind:'warning'} ─→ ReplayProgress.warnings
           ─→ RunView.warnings (CLI: "! …" on stderr) / ReplayView.warnings (TUI warning lines)

## File Changes

| File | Action | Description |
|---|---|---|
| `src/script-generation/domain/settle-prelude.ts` | Create | `createSettling(context, options)`: `start()`, `arm()`, `waitForNavigation(page, expected)`, `settle()` |
| `src/script-generation/domain/scroll-prelude.ts` | Create | Moved isolated-world scroll functions (pure refactor) |
| `src/script-generation/domain/script-prelude.ts` | Modify | Concatenate new modules; wire `createSettling`; options `navigationTimeoutMs`, `quietWindowMs`, `settleCapMs` |
| `src/script-generation/domain/render-step.ts` | Modify | `wait-for-url` → `await rt.waitForNavigation(pageN, "<origin+path>");` |
| `src/script-generation/domain/generate-script.ts` | Modify | `await rt.settle();` before `rt.done();` |
| `src/replay/domain/parse-progress-line.ts` | Modify | `::warn` marker → `{ kind: 'warning', message }` |
| `src/replay/domain/replay-progress.ts` | Modify | `warnings: readonly string[]` |
| `src/cli/application/ports/replay-command-services.ts`, `src/composition/create-replay-command-services.ts`, `src/cli/application/run-replay-command.ts` | Modify | `RunView.warnings`; printed with `formatWarning` to stderr after the run |
| `src/tui/domain/app-views.ts`, `src/composition/replay-views.ts`, `src/tui/application/replay-flow.ts`, `src/tui/render/screens/replay-screen.ts` | Modify | `ReplayView.warnings` rendered with launch warnings |
| `tests/unit/script-generation/goldens/*.mjs` | Modify | Prelude text, `rt.settle()`, `waitForNavigation` (basic, brave-managed, legacy-emulated) |
| `tests/fixtures/site/confirm-modal.html` | Create | Modal "Confirmar": after ~300 ms client delay, POST `/__report?state=confirmed`, then `location.reload()` |
| `tests/fixtures/site/fire-and-forget.html`, `polling.html` | Create | Delayed fetch without navigation; endless 100 ms polling |
| `package.json` | Modify | `0.1.0` → `0.1.1` |

## Interfaces / Contracts

```js
// generated script
await rt.waitForNavigation(page1, "https://host/path");
await rt.settle();            // resolves { isQuiet, pendingCount }; never throws
```
Wire: `::warn <JSON string>`, regex `/^::warn (.*)$/`, decoded like `::error`.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | Arm/match/consume, same-URL navigation, older navigation ignored, timeout message, settle quiet/cap/ignored schemes, popup requests | `script-prelude` style: prelude + `EventEmitter` fakes, short option overrides |
| Unit | `::warn` parsing, `warnings` fold, CLI and TUI rendering | Pure domain tests and fakes |
| Unit | Render and goldens | `render-step.test.ts`, byte-for-byte goldens |
| Integration | RED: fixture POST never reported before the fix; same-URL reload awaited (reload counted via a `/__report` on load); fire-and-forget request reported; polling page finishes within cap + margin with `::warn` | `generated-script.test.ts`, headless, fixture server. Missing navigation stays unit-level (30 s default timeout) |

## Threat Matrix

| Boundary | Applicability |
|---|---|
| Documentation-like paths | N/A: no file classification |
| Git repository selection | N/A: no Git |
| Commit state | N/A: no Git |
| Push state | N/A: no Git |
| PR commands | N/A: no PR automation |

The only process boundary touched is the existing child stdout protocol; warning text is runtime-authored and sanitized by `formatWarning`/`warningLines`.

## Migration / Rollout

No migration required: scripts regenerate before every replay. Patch bump.

## Open Questions

- None blocking. Same-document navigations (hash, `pushState`) also emit `framenavigated`; an earlier same-path one could satisfy the wait. Accepted.

## Reconciliation (apply)

- `createSettling` also takes `settlePollMs`, `sleep`, `print` and a
  `describeStep` callback (the runtime passes them), so the timeout message can
  name the step: `Timed out waiting for the navigation of step N to <url>`.
- `rt.at` now delegates pacing to an internal `pace` helper and arms after it
  when the step is not a follow-up.
- `::warn` text for a cap shorter than a whole number of seconds keeps the
  fraction (`0.3 s`); the default renders `5 s`.
- The golden scripts were regenerated in the same commits that changed the
  generator (so every commit stays green); their diff against the base is
  limited to the prelude text, `rt.waitForNavigation` and `rt.settle()`.
- A cancelled replay is covered at runtime level: a signal during a pending
  settle exits 130 with no `::warn` and no `::done`.
