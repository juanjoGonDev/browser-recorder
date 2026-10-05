# Tasks: CLI replay and human timing

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 2200-3000 (about 55 % tests) |
| 400-line budget risk | High |
| Chained PRs recommended | No (maintainer accepted `size:exception`) |
| Suggested split | Single PR, 4 sequential work packages in one apply |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| WP1 | Timing contract, env, prelude, `rt.fill`, signals | PR 1 | `pnpm test tests/unit/script-generation tests/unit/replay` | Spike script under scratchpad, headless | `src/shared`, `src/replay`, `src/script-generation` |
| WP2 | `launch-replay` refactor, TUI toggle | PR 1 | `pnpm test tests/unit/tui tests/unit/composition` | N/A (fakes) | `src/composition`, `src/tui` |
| WP3 | `src/cli`, dispatch, `pnpm replay`, e2e | PR 1 | `pnpm test tests/unit/cli tests/e2e` | e2e on temp package root | `src/cli`, `src/main.ts`, `package.json` script |
| WP4 | Docs | PR 1 | `pnpm quality` | N/A | `AGENTS.md`, `README.md` |

HARD RULES (all tasks): headless tests only; no main-world code; no `Runtime.enable`/`Console.enable`; no new runtime dependency; NO `package.json` version bump; e2e only in a temp package root, never the real `recordings/`. Each task is RED (failing test) then GREEN then REFACTOR (`pnpm test` green, files <300 lines).

## WP1: Contracts and script runtime

- [x] 1.0 Spike: headless persistent context, `handleSIGINT/handleSIGTERM:false`, send SIGINT, confirm browser closes and temp profile removed. Record result in design Open Questions; Windows is CI-verified.
- [x] 1.1 RED/GREEN `src/shared/domain/replay-timing.ts` (`ReplayTiming`, `DEFAULT_HUMAN_DELAY`) and `terminal-text.ts` (move `isColorEnabled`, `sanitize`; fix TUI imports). Test: `tests/unit/shared/`.
- [x] 1.2 RED/GREEN `src/replay/domain/timing-environment.ts`: scenarios Human env, Default, Seed forwarded; env always overrides inherited. Test: `tests/unit/replay/`.
- [x] 1.3 RED/GREEN `replay-progress.ts` `{ isDriftTracked }` and `replay-runner.ts` timing field: No drift in human mode; recorded Timing check unchanged.
- [x] 1.4 RED/GREEN `src/script-generation/domain/timing-prelude.ts` (mulberry32, seed `^\d{1,10}$`, range parse, unknown mode = recorded): Unknown mode, Range respected, First step, Seeded determinism, with injected sleep.
- [x] 1.5 RED/GREEN `rt.at(offset, { isFollowUp })` in `script-prelude.ts`, `render-step.ts`: Offset wait, Late step; follow-ups never wait.
- [x] 1.6 RED/GREEN `rt.fill` (fill(''), `pressSequentially`, key pause = range/10, reconcile with `fill(value)`): Typed fill `a"b\n€`, Sensitive value.
- [x] 1.7 RED/GREEN `launch-prelude.ts` signals (SIGINT/SIGTERM run `onAbort`); `generate-script.ts` stays byte-identical regardless of env.
- [x] 1.8 REFACTOR: keep `script-prelude.ts` under 300 lines; `pnpm quality`.

## WP2: Launch reuse and TUI

- [x] 2.1 RED/GREEN `src/composition/launch-replay.ts` extracted from `Composition.startReplay`, returning `{ recording, live, warnings, released }`; update `create-app-services.ts`, `replay-views.ts`. Test: `tests/unit/composition/`, fakes.
- [x] 2.2 RED/GREEN `resolve-paths.ts` export `findPackageRoot`; `package-version.ts` equals `package.json`.
- [x] 2.3 RED/GREEN TUI domain (`app-state`, `intent`, `keymap`, `app-action`, `app-reducer`, `reduce-library`): `h` toggles; Toggle, Not remembered.
- [x] 2.4 RED/GREEN `replay-flow`, `tui-controller`, `app-services` (`replay.start(slug, timing)`), `library-screen`, `replay-screen`, `layout`, `ansi`: Mode display, key hint, no drift column in human mode.
- [x] 2.5 REFACTOR; `pnpm test`.

## WP3: CLI feature

- [x] 3.1 RED/GREEN `src/cli/domain/parse-delay-range.ts`: Valid/Invalid ranges, Defaults.
- [x] 3.2 RED/GREEN `interpret-arguments.ts`, `usage-text.ts`, `adapters/tokenize-argv.ts`: Help and version, Unknown subcommand, Unknown flag, Missing argument.
- [x] 3.3 RED/GREEN `find-recording.ts`: Slug vs display name, Case-insensitive, Ambiguous, Not found.
- [x] 3.4 RED/GREEN `describe-step.ts` (never values), `format-step-line.ts`, `format-result.ts`, `exit-code.ts`: Success, Failure, Plain output.
- [x] 3.5 RED/GREEN ports and `run-replay-command.ts`, `run-cli.ts` with fakes: Fallback warning, missing browser prints manual command, awaits `released`, Ctrl+C maps to `live.cancel()` (130/143).
- [x] 3.6 RED/GREEN adapters `stream-output.ts` (EPIPE, flush), `process-interrupt-signals.ts`.
- [x] 3.7 RED/GREEN `create-replay-command-services.ts`, `run-cli-app.ts`, `run-tui-app.ts`, `main.ts` dispatch (lazy services; Non-TTY replay, No subcommand), coverage >= 85 % per file.
- [x] 3.8 RED/GREEN `depcruise-rules.test.ts` cases (Layer violation, Console use); `package.json` `replay` script, version unchanged (Alias, Version untouched).
- [x] 3.9 E2E `tests/e2e/`: temp package root, fixture recording, `node dist/main.js replay`; exit 0, 1, 2, 130 (SIGINT, POSIX); seeded human gaps >= min, exact fill value; real `recordings/` untouched.
- [x] 3.10 REFACTOR; `pnpm quality`.

## WP4: Docs

- [x] 4.1 Update `AGENTS.md` (`cli` feature) and `README.md` (usage, flags, exit codes, timing, Windows note).
- [ ] 4.2 Final `pnpm quality`; confirm `git diff main -- package.json` has no version change.
