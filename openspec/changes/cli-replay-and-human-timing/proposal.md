# Proposal: CLI replay and human timing

## Intent

Replaying a recording today requires the interactive TUI, so it cannot run from scripts, CI-like shells or a quick terminal command. Replay is also robotically exact. Users need `browser-recorder replay <name>` with clear success/failure output, plus an opt-in human-like timing mode (CLI and TUI) that does not change the recording.

## Scope

### In Scope
- `browser-recorder replay <name|slug>` subcommand (existing `bin`) and `pnpm replay` alias; no subcommand keeps the TUI.
- Flags via `node:util` `parseArgs`: `-r/--random`, `-d/--delay <min-max>` (default `250-900`, 0 <= min <= max <= 60000), `--headless`, `-h/--help`, `-v/--version`. Usage errors exit 2.
- Lookup: exact slug, then case-insensitive name; ambiguity exits 2 listing candidates.
- Output: one line per step on stdout, warnings on stderr, `✔`/`✖` summary, exits 0/1/130, NO_COLOR and non-TTY aware.
- Generated script reads `BROWSER_RECORDER_TIMING`, `BROWSER_RECORDER_HUMAN_DELAY`, `BROWSER_RECORDER_SEED`; human mode uses relative random waits and per-key typing ending in the exact value.
- TUI timing toggle before replay; replay view shows the mode.
- Minor version bump (feature).

### Out of Scope
- Batch replay, JSON output, recording from the CLI.
- Persisting timing preference in a recording.
- Browser install from the CLI (reports the manual command instead).
- Drift reporting in human mode.

## Capabilities

### New Capabilities
- `cli`: command parsing, recording lookup, output format, exit codes, cancellation.

### Modified Capabilities
- `replay`: timing mode passed to the spawned script; ±100 ms tolerance applies to recorded mode only; drift omitted in human mode.
- `script-generation`: absolute-offset scheduling becomes the `recorded` mode; new `human` mode and timing env contract.
- `tui`: timing toggle and mode display; TTY requirement applies only without a subcommand.
- `repository-quality`: `pnpm replay` script; new `src/cli/` boundary enforced by dependency-cruiser.

## Approach

New `src/cli/` feature (pure domain: args, lookup, formatting; application use case on ports). Wiring lives in `src/main.ts`/`src/composition/`, reusing the existing replay services and launch plan. Output goes through a port (no `console`). Timing is a replay request field mapped to env vars; the prelude's `at()` branches on mode with a seeded PRNG.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/cli/` | New | Args, lookup, output, use case |
| `src/main.ts`, `src/composition/` | Modified | Subcommand dispatch, wiring |
| `src/replay/` | Modified | Timing in request/env |
| `src/script-generation/domain/script-prelude.ts` | Modified | Human timing runtime |
| `src/tui/` | Modified | Toggle and mode display |
| `package.json`, `.dependency-cruiser.json` | Modified | Script, version, boundary |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Randomness makes tests flaky | Med | `BROWSER_RECORDER_SEED`; assert ranges |
| Per-key typing breaks fills | Low | Final value asserted equal to recorded |
| Old scripts lack timing env | Low | Script regenerated before every replay |

## Rollback Plan

Revert the change commits; recordings are untouched (timing is never persisted), and scripts regenerate on next replay.

## Dependencies

- None new; Patchright stays the only runtime dependency.

## Success Criteria

- [ ] `pnpm replay <name>` replays headless in tests with exit 0/1/2/130 as specified.
- [ ] Seeded human mode is deterministic and waits within range.
- [ ] TUI toggle switches mode; `pnpm quality` passes.

## Proposal question round

Auto mode: not asked. Assumptions for owner review:
1. CLI never installs browsers.
2. Human delay applies between steps, not before step 0.
3. TUI toggle is per replay, not remembered.
