# Apply progress: replay-settles-after-actions

Mode: Strict TDD. All 10 tasks complete. Branch `fix/replay-settles-after-last-step`, single PR, one commit group per task. Version 0.1.0 -> 0.1.1.

## Task 1 finding

Under Patchright 1.63.0 headless, `framenavigated` DOES fire on a same-URL `page.reload()` (probe test green: `['<url>']`). The fixture test (POST of the last click recorded before close) was RED with the old `waitForURL` (`expected ['loaded'] to include 'confirmed'`) and is GREEN since task 5. Tasks 3-5 were built on that signal.

## TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | Triangulate | Refactor |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1 | tests/integration/script-generation/generated-script.test.ts | Integration | 9/9 existing | POST test failed (`'loaded'` only); probe passed | RED kept for task 5 | probe + POST are two independent behaviors | n/a (fixture only) |
| 2 | tests/unit/script-generation (goldens, prelude), scroll-runtime integration | Unit + Integration | 205/205 | n/a pure refactor (existing tests are the guard) | 205/205 + 9/9 scroll, goldens byte-identical | n/a: structural move, single output | Prettier pass |
| 3 | tests/unit/script-generation/settle-prelude.test.ts | Unit (prelude + EventEmitter fakes) | 205/205 | 16/16 failed (`rt.waitForNavigation`/`rt.settle` missing) | n/a (next task) | 8 navigation + 8 settle cases | n/a |
| 4 | settle-prelude.test.ts, script-prelude*.test.ts | Unit | 205/205 | task 3 tests | 16/16; goldens red until regenerated | same-URL/cross-URL/older/immediate/consumed/re-arm/child frame/existing pages; quiet/pending/failed/cap/plural/ignored/popup/websocket | split into tracker functions (<40 lines) |
| 5 | render-step.test.ts, generate-script.test.ts, generated-script.test.ts | Unit + Integration | 85/85 | 4 unit failed; integration fire-and-forget and polling failed with settle removed | 224/224 unit, 16/16 integration | two pages, empty recording, success path only, human mode, failure skips settle, no page code | goldens regenerated; diff reviewed |
| 6 | parse-progress-line.test.ts, replay-progress.test.ts | Unit | 25/25 | 4 failed | 72/72 | JSON, raw fallback, bare marker, order, success keeps warnings | n/a |
| 7 | run-replay-command, timeline-replay-screens, create-*-services, script-prelude-signals | Unit + Integration | 214/214 | 8 failed | 1884 unit + 61 composition green; typecheck clean | one/two warnings, ordering, sanitizing, small-height TUI, cancel at runtime | `allWarnings` helper |
| 8 | goldens in generate-script.test.ts | Unit | 5 goldens | red after task 5 generator change | regenerated with task 5; diff = prelude text, `rt.settle()`, `waitForNavigation` | 3 requested + hostile + multi-tab | n/a |
| 9 | docs/version | Docs | n/a | n/a | quality green | n/a: no behavior | n/a |
| 10 | gates | All | n/a | n/a | `pnpm quality`, `test:coverage`, `build`, `audit` green | n/a | n/a |

## Work Unit Evidence

| Unit | Focused command | Runtime harness | Rollback boundary |
|------|-----------------|-----------------|-------------------|
| 1 (tasks 1-5) | `pnpm vitest run tests/unit/script-generation tests/integration/script-generation` green | headless fixture server (confirm-modal, fire-and-forget, polling) | script-generation + fixtures + goldens |
| 2 (tasks 6-7) | `pnpm vitest run tests/unit tests/integration/composition tests/integration/tui` green | fakes | replay/cli/tui/composition |
| 3 (tasks 8-10) | `pnpm quality` green | `pnpm build` ok | goldens, docs, package.json |

## Deviations (reconciled in design.md)

Goldens regenerated with the generator changes (tasks 4-5) so every commit stays green; extra options `settlePollMs`/`describeStep`; fractional seconds in the cap warning.

## Verify remediation

| Task | Test file | Layer | Safety net | RED | GREEN | Triangulate | Refactor |
|---|---|---|---|---|---|---|---|
| R.1 | tests/integration/script-generation/generated-script.test.ts | Integration | 16/16 | Mutation: old `waitForURL` rendering restored → `expected [ 'loaded' ] to have a length of 2 but got 1` | 17/17 with `rt.waitForNavigation` | late reload (1500 ms) vs existing early reload (0 ms) | n/a |
