# CLI Specification

## Purpose

Run one saved recording from a command (`browser-recorder replay <name|slug>`, alias `pnpm replay`) with clear output and exit codes, optionally with human-like timing. No subcommand opens the TUI.

## Requirements

### Requirement: Command dispatch

The system MUST open the TUI when no subcommand is given and MUST run a replay for `replay <name|slug>`. An unknown subcommand MUST exit 2 with usage on stderr. `-h`/`--help` and `-v`/`--version` MUST print to stdout and exit 0 (the version equals `package.json`).

#### Scenario: No subcommand
- GIVEN no arguments
- WHEN the binary starts
- THEN the TUI flow starts, not the CLI

#### Scenario: Help and version
- GIVEN `--help`, `-h`, `--version` or `-v`
- WHEN run
- THEN usage or the version is printed to stdout and the exit code is 0, with no replay started

#### Scenario: Unknown subcommand
- GIVEN `browser-recorder foo`
- WHEN run
- THEN usage goes to stderr and the exit code is 2

### Requirement: Argument validation

Parsing MUST use `node:util` `parseArgs` with `-r/--random`, `-d/--delay <min-max>`, `--headless`. Usage errors MUST print the reason plus usage to stderr and exit 2 before anything is spawned.

#### Scenario: Unknown flag
- GIVEN `replay demo --nope`
- WHEN run
- THEN exit 2, stderr names `--nope`, nothing is spawned

#### Scenario: Missing argument
- GIVEN `replay` with no name, or `-d` with no value
- WHEN run
- THEN exit 2 and stderr names the missing argument

### Requirement: Delay range

`--delay` MUST be `<min>-<max>` with base-10 integers, `0 <= min <= max <= 60000`. The default is `250-900`. `-r` without `-d` MUST use the default. `-d` without `-r` MUST imply human timing. Neither flag means recorded timing.

#### Scenario: Valid ranges
- GIVEN `-d 100-100`, `-d 0-60000`
- WHEN parsed
- THEN both are accepted with human timing

#### Scenario: Invalid ranges
- GIVEN `-d abc`, `-d 1.5-3`, `-d 900-250`, `-d 0-60001`, `-d -5-10`, `-d 500`
- WHEN parsed
- THEN each exits 2 with a message naming the rule broken

#### Scenario: Defaults
- GIVEN `-r` alone
- WHEN run
- THEN the script receives timing `human` and delay `250-900`
- AND given `-d 10-20` alone THEN timing is `human` with `10-20`
- AND given neither THEN timing is `recorded`

### Requirement: Recording lookup

The system MUST resolve the argument by exact slug first, then by case-insensitive display name. No match MUST exit 2 naming the argument. More than one name match MUST exit 2 listing every candidate slug. A slug match MUST win over a name match.

#### Scenario: Slug vs display name
- GIVEN recording A has slug `demo` and recording B has display name `Demo`
- WHEN `replay demo` runs
- THEN A is replayed

#### Scenario: Case-insensitive name
- GIVEN one recording named `My Flow`
- WHEN `replay "my flow"` runs
- THEN it is replayed

#### Scenario: Ambiguous
- GIVEN two recordings named `Login` and `login`, neither with slug equal to the input
- WHEN `replay LOGIN` runs
- THEN exit 2 and stderr lists both slugs

#### Scenario: Not found
- GIVEN no match
- WHEN run
- THEN exit 2 and nothing is spawned

### Requirement: Output streams

Each step MUST print one line (index, kind, target, elapsed) to stdout. Warnings, including the browser-fallback warning, errors and usage MUST go to stderr. The summary line MUST be `✔ <name> replayed in <s>` on success, or `✖ <name> failed at step <i> (<kind>): <message>` followed by the stderr tail on failure. `--headless` MUST run without a visible window. The CLI MUST NOT install browsers; when one is missing it MUST report the manual install command on stderr.

#### Scenario: Success
- GIVEN a passing recording
- WHEN replayed
- THEN stdout has one line per step then the `✔` line, stderr is empty, exit 0

#### Scenario: Failure
- GIVEN a step whose locator is gone
- WHEN replayed
- THEN the `✖` line names the step index and kind, stderr tail is printed, exit 1

#### Scenario: Fallback warning
- GIVEN the recorded browser is missing
- WHEN replayed
- THEN the warning is on stderr (not stdout) and the replay still runs on bundled Chromium

### Requirement: Color handling

Output MUST contain no ANSI escapes when `NO_COLOR` is set (non-empty) or stdout is not a TTY.

#### Scenario: Plain output
- GIVEN stdout is a pipe, or `NO_COLOR=1` on a TTY
- WHEN replayed
- THEN the output matches no `\x1b[` sequence

### Requirement: Exit codes and cancellation

Exit codes MUST be 0 success, 1 replay failure, 2 usage error, 130 cancel. SIGINT MUST kill the child, print a cancel notice to stderr and exit 130.

#### Scenario: Ctrl+C
- GIVEN a replay is running
- WHEN SIGINT arrives
- THEN the child is terminated and the exit code is 130
