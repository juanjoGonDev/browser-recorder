# Tasks: Replay settles after actions

Hard rules: headless only; no page code; no `Runtime.enable`/`Console.enable`; no new dependency. Sequential, one apply, no worktrees. Each task is RED -> GREEN -> REFACTOR.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 900-1300 (about 40% tests/goldens) |
| 400-line budget risk | High (no review budget per AGENTS.md) |
| Chained PRs recommended | No |
| Suggested split | Single PR, one commit group per task |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Tasks 1-5: generated-script behavior | PR 1 | `pnpm vitest run tests/unit/script-generation tests/integration/generated-script.test.ts` | headless fixture server | script-generation + fixtures |
| 2 | Tasks 6-7: `::warn` to CLI/TUI | PR 1 | `pnpm vitest run tests/unit/replay tests/unit/cli tests/unit/tui` | fakes | replay/cli/tui files |
| 3 | Tasks 8-10: goldens, docs, bump, gates | PR 1 | `pnpm quality` | `pnpm build` | goldens, docs, package.json |

## Tasks

- [x] 1. Fixture and RED proof. Create `tests/fixtures/site/confirm-modal.html` (modal "Confirmar": ~300 ms delay, POST `/__report?state=confirmed`, `location.reload()`; reload reports on load). Add to `tests/integration/generated-script.test.ts`: (a) server never records the POST before close today (RED); (b) probe that `framenavigated` fires on a same-URL reload in Patchright. Specs: Same-URL reload awaited, Success after settle.
- [x] 2. Pure refactor. Move isolated-world scroll functions from `src/script-generation/domain/script-prelude.ts` to new `scroll-prelude.ts`; tests and goldens unchanged and green. Spec: Scroll inside a shadow root.
- [x] 3. Settle prelude RED. Unit tests (prelude + `EventEmitter` fakes, short options): arm/match/consume, same-URL, older navigation ignored, cross-URL, immediate commit, timeout message naming the step; settle quiet, 500 ms window, cap, `data:`/`blob:` ignored, popup requests, no websockets. Specs: Earlier navigation never satisfies, Navigation armed before the action, Missing navigation, Pending request completes, Long-polling hits cap, WebSocket open.
- [ ] 4. Settle prelude GREEN. Create `settle-prelude.ts` (`createSettling`: `start`, `arm`, `waitForNavigation`, `settle`; constants `NAVIGATION_TIMEOUT_MS`, `QUIET_WINDOW_MS`, `SETTLE_CAP_MS`, `SETTLE_POLL_MS`; move `withTimeout`). Wire in `script-prelude.ts` (options, `rt.at` arms when not follow-up, `::warn` on cap with count only). Triangulate, then refactor to stay under lint limits.
- [ ] 5. Render step. RED in `tests/unit/script-generation/render-step.test.ts`: `wait-for-url` renders `await rt.waitForNavigation(pageN, "<origin+path>");`; `generate-script` emits `await rt.settle();` before `rt.done()`, never on the catch path. GREEN in `render-step.ts`, `generate-script.ts`. Add fire-and-forget and polling fixtures with integration tests (Task 1 turns GREEN; polling ends within cap + margin; human mode; failure skips settle; no page code/Runtime/Console; drift within 100 ms).
- [ ] 6. `::warn` protocol RED/GREEN. Tests then `parse-progress-line.ts` (`/^::warn (.*)$/` -> `{kind:'warning', message}`, JSON-decoded like `::error`) and `replay-progress.ts` (`warnings: readonly string[]` fold). Spec: Success after settle.
- [ ] 7. Surfacing. RED then GREEN: `RunView.warnings` printed via `formatWarning` to stderr after the run (`run-replay-command.ts`, `replay-command-services.ts`, `create-replay-command-services.ts`); `ReplayView.warnings` (`app-views.ts`, `replay-views.ts`, `replay-flow.ts`, `replay-screen.ts`). Specs: Cap warning in CLI, Cap warning in TUI, No settle on cancel. Run `pnpm deps:check`.
- [ ] 8. Goldens. Update `tests/unit/script-generation/goldens/*.mjs` (basic, brave-managed, legacy-emulated) byte-for-byte; review diff is limited to prelude text, `rt.settle()`, `waitForNavigation`.
- [ ] 9. Docs and version. Update README/SECURITY notes (settle, `::warn`, no page code); reconcile specs/design names if apply diverged; bump `package.json` 0.1.0 -> 0.1.1 per `scripts/release-impact-policy.ts`.
- [ ] 10. Final gates. `pnpm quality`, `pnpm test:coverage`, `pnpm build`; fix with `pnpm format`; no hook bypass.
