# Exploration: cli-replay-and-human-timing

## User request (2026-10-05)

1. Run one saved recording from a command, without entering the TUI (e.g.
   `pnpm replay <name>`), printing its output and a clear success message, or
   the failing output and the error.
2. Optionally replay with randomised, human-like waits within a range instead
   of the exact recorded timing, selectable in that command with a long and a
   short flag (like `--version` / `-v`), and in the TUI.

## Current state (verified in code)

- Replay = spawn `node recordings/<slug>/script.mjs` with launch env; the
  script schedules each step at its absolute recorded offset (`rt.at`) and
  prints `::step <i> <ms>` / `::done <ms>` / `::error <i|-> <json>`
  (src/replay, src/script-generation/domain/script-prelude.ts).
- `script.mjs` is regenerated before every replay; the launch plan
  (browser/profile, fallback warnings) lives in src/composition.
- `src/main.ts` refuses to run without a TTY.

## Decisions

1. CLI entry: `browser-recorder replay <name|slug> [options]` (package `bin`)
   and the script alias `pnpm replay <name|slug>`. Running `browser-recorder`
   with no subcommand keeps opening the TUI (TTY required only there).
   Argument parsing with `node:util` `parseArgs` (no new dependency).
2. Options: `-r, --random` human timing; `-d, --delay <min-max>` range in ms
   (default `250-900`, validated: integers, 0 <= min <= max <= 60000);
   `--headless`; `-h, --help`; `-v, --version`. Unknown flags, a missing
   recording or an invalid range exit with code 2 and a usage message.
3. Output: one human-readable line per step (index, kind, target, elapsed)
   on stdout, warnings (browser fallback, etc.) on stderr; success prints
   `✔ <name> replayed in <s>` and exits 0; failure prints `✖ <name> failed at
   step <i> (<kind>): <message>` plus the stderr tail to stderr and exits 1;
   Ctrl+C aborts the replay cleanly and exits 130. NO_COLOR respected; no
   ANSI when stdout is not a TTY.
4. Recording lookup: exact slug first, then case-insensitive display name;
   ambiguous name -> exit 2 listing the candidates.
5. Human timing is a replay-time choice, not baked into the recording: the
   generated script reads `BROWSER_RECORDER_TIMING=recorded|human` and
   `BROWSER_RECORDER_HUMAN_DELAY=<min>-<max>` (plus optional
   `BROWSER_RECORDER_SEED` for deterministic tests). In human mode each step
   waits a uniform random delay in range after the previous step finishes
   (instead of the absolute offset); fills are typed per character with a
   random per-key delay derived from the same range (scaled down), so a fill
   still ends with the exact recorded value. Patchright auto-waiting keeps
   reliability. Drift is not reported in human mode.
6. TUI: in the library/replay flow a key toggles timing (recorded/human)
   before starting; the replay view shows the active mode.
7. Same safety rules: no main-world code, tests headless, no new runtime
   dependency, strict TDD.
