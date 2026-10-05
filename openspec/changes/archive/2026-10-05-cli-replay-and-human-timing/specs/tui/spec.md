# Delta for tui

## ADDED Requirements

### Requirement: Replay timing toggle

Before starting a replay the TUI MUST offer a key that toggles timing between recorded and human. The default MUST be recorded on every replay (the choice is not remembered). The replay view MUST show the active mode, and key hints MUST list the toggle.

#### Scenario: Toggle
- GIVEN the replay is about to start in recorded mode
- WHEN the toggle key is pressed
- THEN human mode is shown, and pressing again returns to recorded

#### Scenario: Not remembered
- GIVEN a replay was run in human mode
- WHEN the next replay is prepared
- THEN the mode is recorded again

#### Scenario: Mode display
- GIVEN a replay running in human mode
- WHEN the frame renders
- THEN it shows the human mode label

## MODIFIED Requirements

### Requirement: Terminal lifecycle

The TUI MUST use the alternate screen and hidden cursor, and MUST restore the terminal on exit, Ctrl+C, or uncaught error. An interactive TTY MUST be required only when no subcommand is given; the `replay` subcommand MUST work without a TTY.
(Previously: a TTY was required for any start)

#### Scenario: Exit restore
- GIVEN the TUI is running
- WHEN the user quits
- THEN raw mode is off, cursor visible, primary screen restored

#### Scenario: Non-TTY
- GIVEN stdin is not a TTY and no subcommand is given
- WHEN the app starts
- THEN it exits with a message that an interactive terminal is required

#### Scenario: Non-TTY replay
- GIVEN stdin and stdout are not TTYs
- WHEN `replay <name>` runs
- THEN no TTY error occurs and the replay proceeds
