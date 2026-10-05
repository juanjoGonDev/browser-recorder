# Delta for tui

## ADDED Requirements

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
### Requirement: Library screen

The TUI MUST list recordings, navigable by arrow keys, with actions: new, replay, rename, delete, quit, and show key hints.

#### Scenario: Navigate
- GIVEN 3 recordings, selection on the first
- WHEN Down is pressed twice then Up once
- THEN the second is selected; selection does not wrap out of bounds

#### Scenario: Empty library
- GIVEN no recordings
- WHEN the screen renders
- THEN an empty-state message with the "new" hint is shown

### Requirement: Create flow

Creating MUST prompt for name (required), start URL (optional, validated as http/https), browser and profile mode, then start recording. The browser picker MUST list detected browsers (bundled last). Mode `copy-of-real` MUST additionally prompt for a profile from `Local State`. The default is the first detected browser with `managed`.
(Previously: name and URL only)

#### Scenario: Invalid URL
- GIVEN the user enters `ftp://x`
- WHEN confirming
- THEN an inline error is shown and recording does not start

#### Scenario: Empty URL
- GIVEN name "Demo" and empty URL
- WHEN confirmed
- THEN recording starts with a blank page

#### Scenario: Pickers
- GIVEN Brave and Chrome are detected
- WHEN the user picks Brave and `copy-of-real`, then `Profile 2`
- THEN recording starts with those values

#### Scenario: Only bundled
- GIVEN no other browser is detected
- WHEN the picker renders
- THEN only bundled Chromium is offered and preselected

### Requirement: Rename and delete UX

Rename MUST show collision errors inline; delete MUST require an explicit confirm prompt defaulting to "no".

#### Scenario: Enter on delete prompt
- GIVEN the confirm prompt is open
- WHEN the user presses Enter without choosing
- THEN nothing is deleted

### Requirement: Self-refresh and live timeline

The TUI MUST redraw on state change and on a timer, and MUST show a timeline of events with the current step highlighted during recording and replay.

#### Scenario: Live recording
- GIVEN recording is in progress
- WHEN a new event is captured
- THEN the timeline shows it within one refresh interval with its offset

#### Scenario: Replay highlight
- GIVEN replay emits `::step 2`
- WHEN the screen refreshes
- THEN step 2 is highlighted and earlier steps are marked done

#### Scenario: Resize
- GIVEN the terminal is resized
- WHEN the next frame renders
- THEN the layout fits the new size and long lists scroll with the selection visible

### Requirement: Pure rendering

Frame rendering MUST be a pure function of state and size, enabling snapshot tests without a TTY.

#### Scenario: Snapshot
- GIVEN fixed state and 80x24 size
- WHEN rendered twice
- THEN output strings are equal
### Requirement: Lock and fallback messages

The TUI MUST show the profile-lock error and the fallback warning in a visible message without crashing, and MUST warn when copying from a running browser.

#### Scenario: Locked profile
- GIVEN the profile is locked
- WHEN recording is started
- THEN an error message is shown and the library remains usable

#### Scenario: Fallback warning
- GIVEN a replay falls back to bundled Chromium
- WHEN the screen renders
- THEN the warning is visible with the missing browser name
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

