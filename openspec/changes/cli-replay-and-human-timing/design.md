# Design: CLI replay and human timing

## Technical Approach

New hexagonal feature `src/cli/`. The CLI reaches replay only through a port that composition implements. Composition reuses the launch plan, `regenerateScript`, `startReplay` and the profile release that the TUI already uses. Timing is a field on the replay request: the runner maps it to environment variables, and the generated script carries a small seeded timing runtime. `package.json` `version` stays unchanged (the owner decides).

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|---|---|---|---|
| Argument parsing | `src/cli/adapters/tokenize-argv.ts` wraps `node:util` `parseArgs` (`strict`, `allowPositionals`); the pure `domain/interpret-arguments.ts` turns raw tokens into a `CliCommand` | `parseArgs` in domain | `domain-pure` forbids Node core in domain |
| Shared timing type | `src/shared/domain/replay-timing.ts`: `ReplayTiming`, `DelayRange`, `DEFAULT_HUMAN_DELAY` (250-900) | One copy per feature | CLI, TUI and replay need the same contract, and only shared may be imported by all three |
| Launch reuse | Extract `src/composition/launch-replay.ts` from `Composition.startReplay`. It returns `{ recording, live, warnings, released }` and checks bundled Chromium (manual command, no install) | Second composition for the CLI | One launch path. The CLI awaits `released` before exit, so profile copies are deleted |
| Output | `CommandOutput` port (`out`, `err`, `flush`); the adapter writes `process.stdout`/`stderr` and ignores EPIPE | `console` | `no-console`. `flush` before `process.exit` keeps piped output intact |
| Color and sanitizing | Move `isColorEnabled` and `sanitize` to `src/shared/domain/terminal-text.ts` and update the TUI imports | Duplicate them in `cli` | One NO_COLOR rule and one control-character rule. Color is on only when stdout is a TTY |
| Human scheduling | `rt.at(offset)` delegates to a timing object. Recorded mode keeps absolute offsets. Human mode waits for no step 0, then waits a uniform delay in range before each action step. Follow-up steps (`wait-for-url`, `dialog`, `set-input-files`, `page-opened` caused by an action) render `rt.at(offset, { isFollowUp: true })` and do not wait | Delay before every step | A follow-up only observes a consequence. Delaying it adds no realism |
| PRNG | Inline mulberry32 in a new `script-generation/domain/timing-prelude.ts`. The seed comes from `BROWSER_RECORDER_SEED` (`^\d{1,10}$`) or from `crypto.getRandomValues` | `Math.random` | Seeded tests are deterministic. `script-prelude.ts` is already near the 300-line limit |
| Human fill | Every fill renders `await rt.fill(<locator>, <value>)`. Recorded mode calls `locator.fill(value)`. Human mode calls `fill('')`, types each character with `pressSequentially(ch)` and a key pause, then runs `fill(value)` when `inputValue()` differs or throws | `keyboard.type` | `pressSequentially` targets the locator. The reconcile step guarantees the exact value, including for contenteditable, date and masked fields |
| Key pause | Draw from the delay range divided by `KEY_DELAY_DIVISOR = 10` | Separate flag | No new user setting |
| Cancellation | Parent: `InterruptSignals` port (SIGINT, SIGTERM, SIGBREAK on win32). The first signal calls `live.cancel()` (abort, then kill after 3 s); exit 130, or 143 for SIGTERM. Script: launch with `handleSIGINT/handleSIGTERM: false`; SIGINT/SIGTERM run the existing `onAbort` | Patchright handlers | Without raw mode, Ctrl+C reaches the child too, on POSIX and Windows. Both paths close the browser and remove the temporary profile |
| Drift | `createReplayProgress(offsets, { isDriftTracked })`. Drift is `null` in human mode | Compute and hide | Same snapshot shape, and nothing misleading is stored |
| Dispatch | `main.ts`: with no argv, it runs the TUI (TTY check unchanged). With any argv, it runs `runCliApp(argv)` (Node check only). Both bodies move into covered `src/composition/run-*-app.ts` files | Separate binary | Same `bin`. `--help` and `--version` need no Patchright paths, so the services are created lazily after parsing |
| depcruise | No new rule: `no-cross-feature`, `domain-pure` and `application-no-io` already match `src/cli/`. Add cases to `depcruise-rules.test.ts` | Bespoke rule | Generic rules already enforce the boundary (OCP) |

Exit codes: 0 ok; 1 replay or launch failure, or an invalid recording; 2 usage error, not found or ambiguous; 130 or 143 on interrupt (an interrupt wins over the child status).

## Data Flow

    argv ─→ tokenize-argv ─→ interpret-arguments ─→ CliCommand
                                                     │ replay
    runReplayCommand ─→ find-recording(list) ─→ services.startReplay(slug, timing)
          │                                            │ composition/launch-replay
          │                                            ├─ regenerateScript, planner.forReplay
          │                                            └─ startReplay(env: launch + timing + headless)
          ├─ subscribe ─→ format-step-line ─→ out
          ├─ signals ─→ live.cancel()
          └─ finished + released ─→ format-result ─→ out/err ─→ exit code

## File Changes

| File | Action | Description |
|---|---|---|
| `src/cli/domain/{interpret-arguments,parse-delay-range,find-recording,describe-step,format-step-line,format-result,usage-text,exit-code}.ts` | Create | Pure rules. `describe-step` prints kind and target only, never a value |
| `src/cli/application/{run-cli,run-replay-command}.ts`, `ports/{replay-command-services,command-output,interrupt-signals}.ts` | Create | Use cases and ports |
| `src/cli/adapters/{tokenize-argv,stream-output,process-interrupt-signals}.ts` | Create | Node IO |
| `src/composition/{launch-replay,create-replay-command-services,run-cli-app,run-tui-app,package-version}.ts` | Create | Wiring |
| `src/composition/create-app-services.ts`, `replay-views.ts`, `resolve-paths.ts` | Modify | Use `launch-replay`, `replay.start(slug, timing)`, export `findPackageRoot` |
| `src/main.ts` | Modify | Dispatch only |
| `src/shared/domain/{replay-timing,terminal-text}.ts` | Create | Shared kernel |
| `src/replay/domain/{timing-environment,replay-progress}.ts`, `application/replay-runner.ts` | Create/Modify | Env contract and drift flag |
| `src/script-generation/domain/{timing-prelude,launch-prelude,script-prelude,generate-script,render-step}.ts` | Create/Modify | Timing runtime, signals, `rt.fill`, follow-up flag |
| `src/tui/domain/{app-state,intent,keymap,app-action,app-reducer,reduce-library}.ts`, `application/{replay-flow,tui-controller,ports/app-services}.ts`, `render/screens/{library,replay}-screen.ts`, `render/{layout,ansi}.ts` | Modify | `h` toggles `LibraryScreen.timing` (reset on open). `ReplayScreen.timing` is shown, with no drift column in human mode |
| `package.json` | Modify | `"replay": "pnpm run --silent build && node dist/main.js replay"`; no version change |
| `AGENTS.md`, `README.md` | Modify | `cli` feature and usage |

## Interfaces / Contracts

```ts
export type ReplayTiming =
  | { readonly kind: 'recorded' }
  | { readonly kind: 'human'; readonly delay: DelayRange };
// Always set by the runner, overriding inherited values:
// BROWSER_RECORDER_TIMING=recorded|human, BROWSER_RECORDER_HUMAN_DELAY=<min>-<max>|''
// BROWSER_RECORDER_SEED is only inherited (tests); the script re-validates every value.
```

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | Parsing, range bounds (0 <= min <= max <= 60000), lookup and ambiguity, formatting, exit codes, interrupt to cancel, env mapping, drift flag, reducer and keymap | Fakes for every port |
| Unit | Timing prelude | Evaluate it with an injected sleep. The same seed gives the same sequence, and every value is inside the range |
| Integration | `create-replay-command-services`, `run-cli-app` | `composition-fakes`, with coverage >= 85 % per file |
| E2E | `node dist/main.js replay <slug>` | Temporary package root (copied `dist`, `package.json`, linked `node_modules`, fixture recording). Assert exit codes 0, 1, 2 and 130 (SIGINT on POSIX). Human mode with a seed asserts each step gap >= min and the exact final value of the fill. Headless only |

## Threat Matrix

| Boundary | Applicability |
|---|---|
| Documentation-like paths | N/A: no file classification |
| Git repository selection | N/A |
| Commit state | N/A |
| Push state | N/A |
| PR commands | N/A |

Process note: the spawn stays argv-only (`shell: false`). User input never becomes a path, because lookup matches listed slugs only. Every env value is validated in both the parent and the script.

## Migration / Rollout

No migration. Scripts are regenerated before every replay.

## Work Packages

WP1: shared timing contract, replay env, timing prelude, `rt.fill`, signals. WP2: `launch-replay` refactor and the TUI toggle. WP3: CLI feature, dispatch, `pnpm replay` and e2e. WP4: docs. Run them sequentially in one apply. Parallel worktrees do not pay off here: WP2 and WP3 both edit composition, and the contracts must land first.

## Open Questions

- [ ] Version bump is deferred to the owner, and `release-impact-policy` may flag the change.
- [ ] A spike must confirm that `handleSIGINT: false` with a persistent context closes cleanly on Windows.
