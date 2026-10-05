# Apply progress: cli-replay-and-human-timing

Mode: Strict TDD (Vitest). Delivery: single PR, `size:exception` accepted, chain strategy none.
Status: 26/26 tasks complete (WP1 to WP4, sequential, no worktrees).

## Commits

| Commit | Scope |
|--------|-------|
| `feat(replay): add the human timing contract and script runtime` | WP1 (1.0 to 1.8) |
| `feat(tui): choose human or recorded timing before a replay` | WP2 (2.1 to 2.5) |
| `feat(cli): replay a saved recording from the command line` | WP3 (3.1 to 3.8) |
| `test(cli): cover the replay command end to end` | WP3 (3.8 to 3.10) |
| `docs: document the replay command and human timing` | WP4 (4.1) |

## TDD Cycle Evidence

RED means the test was written first and observed failing (module not found or assertion) before production code. "Retro" means the RED was confirmed by temporarily reverting the production line after the fact.

| Task | Test file | Layer | Safety net | RED | GREEN | Triangulate | Refactor |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.0 | scratchpad spike (not committed) | Spike | N/A | N/A (probe) | SIGINT and SIGTERM closed the browser, removed the temp profile, exit 130 | SIGINT and SIGTERM | N/A |
| 1.1 | `tests/unit/shared/replay-timing.test.ts`, `terminal-text.test.ts` | Unit | 1894 passing baseline | module not found | 8/8 | 5 + 3 cases, moved TUI tests | TUI imports updated, 334 TUI tests green |
| 1.2 | `tests/unit/replay/timing-environment.test.ts` | Unit | N/A (new) | module not found | 10/10 | human, custom, recorded, seed valid/invalid | none needed |
| 1.3 | `tests/unit/replay/replay-progress.test.ts`, `replay-runner.test.ts` | Unit | 59 passing | 8 failing | 67/67 | tracked, untracked, env override, seed | `reachStep` reduced to 3 params |
| 1.4 | `tests/unit/script-generation/timing-prelude.test.ts` (+ `tests/support/load-timing-prelude.ts`) | Unit | N/A (new) | module not found | 26/26 | range, point range, seeds, follow-up, invalid inputs | follow-up semantics tightened (leading follow-up) |
| 1.5 | `script-prelude.test.ts`, `generate-script.test.ts` | Unit | 146 passing | 5 failing | 46 + 48 passing | recorded vs human, follow-up, unknown mode, seed | goldens regenerated once after 1.7 |
| 1.6 | `script-prelude-fill.test.ts`, `render-step.test.ts` | Unit | 29 passing | 6 failing + 2 (retro for render-step) | 6/6, 31/31 | recorded, `a"b\n€`, astral, reconcile, unreadable, sensitive | none needed |
| 1.7 | `script-prelude-signals.test.ts`, `script-prelude.test.ts`, `generate-script.test.ts` | Unit | 43 passing | 4 failing | 46/46 | SIGINT, SIGTERM, no signal, env-independent output | lint fixes (naming, `this`) |
| 1.8 | `pnpm quality` | Gate | N/A | lint failures found | quality green | N/A | `script-prelude.ts` stays under 300 lines |
| 2.1 | `launch-replay.test.ts`, `create-app-services.test.ts` | Unit + Integration | 43 passing | module not found + 1 failing | 8/8, 44/44 | success, human+seed, no drift, warnings, release, release failure, missing Chromium, other failure | `ReplayDeps` moved to `launch-replay.ts` |
| 2.2 | `resolve-paths.test.ts`, `package-version.test.ts` | Unit | 9 passing | missing export / module | 4/4, 10/10 | two versions, repo manifest, no version | none needed |
| 2.3 | `keymap.test.ts`, `app-reducer.test.ts` | Unit | 300 TUI tests | 16 failing (with 2.4) | green | toggle, other screens, not remembered | none needed |
| 2.4 | `tui-controller-timing.test.ts`, `library-screen.test.ts`, `timeline-replay-screens.test.ts`, `format.test.ts`, `render-app.test.ts` | Unit | 300 TUI tests | 16 failing | 300/300 + new | label, hint, human mode label, no drift column, snapshots | tests split to stay under 800 lines |
| 2.5 | `pnpm quality` | Gate | N/A | 2 lint errors | green | N/A | fixed |
| 3.1 | `tests/unit/cli/parse-delay-range.test.ts` | Unit | N/A (new) | module not found | 15/15 | 4 valid, 9 malformed, min>max, max too large | none needed |
| 3.2 | `interpret-arguments.test.ts`, `usage-text.test.ts`, `tokenize-argv.test.ts` | Unit | N/A (new) | module not found | 14 + 10 + 11 | help, version, unknown command, flag, missing arg, extra arg | none needed |
| 3.3 | `find-recording.test.ts` | Unit | N/A (new) | module not found | 6/6 | slug wins, case, ambiguous, unreadable, not found | none needed |
| 3.4 | `describe-step.test.ts`, `format-step-line.test.ts`, `format-result.test.ts`, `exit-code.test.ts` | Unit | N/A (new) | module not found | 23 + 8 + 7 + 2 | every kind, secrets never printed, color on/off, about:blank | `placeOf` rewritten after an e2e defect |
| 3.5 | `run-replay-command.test.ts`, `run-cli.test.ts` | Unit (fakes) | N/A (new) | module not found | 16 + 8 | success, failure, warnings, launch failure, awaits release, SIGINT 130, SIGTERM 143, signal before start | `tick()` helper for async ordering |
| 3.6 | `stream-output.test.ts`, `process-interrupt-signals.test.ts` | Unit | N/A (new) | 3 files failing | 9 + 3 | EPIPE, flush, color per stream, win32 SIGBREAK | none needed |
| 3.7 | `create-replay-command-services.test.ts`, `run-cli-app.test.ts`, `run-tui-app.test.ts`, `production-services.test.ts` | Integration + Unit | 3 + 9 passing | module not found (production test: RED by missing export, not run separately) | 9 + 11 + 5 + 3 | lazy services, old Node, non-TTY, colors, save on SIGINT | coverage per file at or above 85 % |
| 3.8 | `depcruise-rules.test.ts`, `eslint-rules.test.ts`, `replay-script.test.ts` | Unit | 40 passing | script test failing | 3/3 | layer, `node:util`, ports, cross-feature, `console` | N/A. The depcruise and eslint cases are characterization tests of the generic rules and passed on the first run by design |
| 3.9 | `tests/e2e/cli-replay.test.ts` | E2E (headless, temp package root) | N/A (new) | 1 failing (`about:blank` rendered as `nullblank`) | 13/13 | exit 0 recorded and human, 1, 2 (five cases), 130, help/version, no TTY, real `recordings/` untouched | complexity lint fix |
| 3.10 | `pnpm quality`, `pnpm test:coverage` | Gate | N/A | lint (complexity) | green | N/A | fixed |
| 4.1 | `tests/unit/repository/cli-docs.test.ts` | Unit | 263 repository tests | heading missing | 263/263 | AGENTS, README sections | prettier |
| 4.2 | final gates | Gate | N/A | N/A | `pnpm install --frozen-lockfile`, `pnpm quality`, `pnpm test:coverage`, `pnpm build`, `pnpm audit` all exit 0; `git diff 9a3b8af -- package.json` adds only the `replay` script (version `0.1.0` unchanged) | N/A | N/A |

### Test Summary
- Baseline: 1894 passing, 6 skipped. Final: 2180 passing, 6 skipped (186 files). Coverage: statements 97.48 %, branches 93.18 %, functions 97.77 %, lines 98.36 %; every file at or above the 85 % per-file floor.
- Layers: Unit (most), Integration (composition), E2E (13, headless, temp package root).
- Approval tests: the existing generate-script goldens were regenerated on purpose (rt.at follow-up flag, rt.fill, signals, timing prelude).

## Work Unit Evidence

| Unit | Focused test command and result | Runtime harness | Rollback boundary |
|------|---------------------------------|-----------------|-------------------|
| WP1 | `pnpm vitest run tests/unit/script-generation tests/unit/replay tests/unit/shared` green | Spike 1.0 (headless persistent context, SIGINT/SIGTERM) plus node-run prelude tests | `src/shared`, `src/replay`, `src/script-generation`, goldens |
| WP2 | `pnpm vitest run tests/unit/tui tests/unit/composition tests/integration/composition` green | N/A (fakes) | `src/composition`, `src/tui` |
| WP3 | `pnpm vitest run tests/unit/cli --project e2e tests/e2e/cli-replay.test.ts` green | `node dist/main.js replay` from a temp package root, headless | `src/cli`, `src/main.ts`, `package.json` script |
| WP4 | `pnpm vitest run tests/unit/repository` green | N/A | `AGENTS.md`, `README.md` |

## Deviations from the design and notes

- Step numbers in the output are one-based (`[3/12]`, `failed at step 3`); the script markers stay zero-based.
- The library key hint is `h mode` (not `h timing`): the longer label clipped the 80 column hint bar.
- `ReplayProgress` gained an `isDriftTracked` field so `applyMessage` can leave drift null; `createReplayProgress(offsets, { isDriftTracked })` matches the design.
- `StartReplayDeps` and `ReplayDeps` gained an optional `parentEnv` (used only to forward the test seed).
- The first page's `page-opened` renders as a follow-up, so the first real action (goto) is the "first step" in human mode.
- CLI step lines show only where a URL points (no query, fragment or credentials).
- `src/main.ts` stays excluded from coverage; its two bodies live in `run-tui-app.ts` and `run-cli-app.ts`, both covered.
- The "Version untouched" scenario is verified with `git diff main -- package.json` (task 4.2), not with a committed test, so the owner can still bump the version.
- Spike 1.0 ran on macOS only; Windows stays CI-verified (SIGINT tests are skipped on win32).

## Workload

Mode: single PR, `size:exception`. Boundary: from the archived bootstrap and browser engine changes to the five commits above. Rollback: revert the commits; recordings are untouched.

## Final gates and smokes

- `pnpm install --frozen-lockfile`: ok. `pnpm quality`: exit 0. `pnpm test:coverage`: exit 0. `pnpm build`: exit 0. `pnpm audit`: no known vulnerabilities.
- `node dist/main.js --version` prints `0.1.0` (exit 0); `--help` exit 0; `replay` exit 2 with usage; `replay does-not-exist` exit 2; `node dist/main.js < /dev/null` prints the interactive-terminal message, exit 1.
- `pnpm replay does-not-exist -r -d 10-20` forwards its arguments (exit 2).
- `main` has no `package.json` (the bootstrap lives on this branch), so the version check compares against the branch base `9a3b8af`.
