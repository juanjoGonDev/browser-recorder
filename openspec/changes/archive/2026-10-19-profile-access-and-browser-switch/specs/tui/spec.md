# Delta for tui

## ADDED Requirements

### Requirement: Change browser action

The library screen MUST bind key `b` to change the selected recording's browser. It MUST open the same browser and profile fields as the create form, preselected on the recording's current choice (first option if the current browser is no longer detected). Enter MUST save through `changeBrowser`; Esc MUST cancel without changes. Key hints MUST list `b`. With an empty library `b` MUST do nothing.

#### Scenario: Preselected and saved
- GIVEN a recording on `chrome` and `brave` detected
- WHEN `b` is pressed, `brave` is picked and Enter is pressed
- THEN the recording is saved with `brave` and the library shows it

#### Scenario: Cancel
- GIVEN the change form is open
- WHEN Esc is pressed
- THEN the recording is unchanged

#### Scenario: Current browser missing
- GIVEN a recording on a browser no longer detected
- WHEN `b` is pressed
- THEN the first detected option is preselected

#### Scenario: Copy-of-real profile
- GIVEN `copy-of-real` is chosen
- WHEN the form is shown
- THEN a profile picker from `Local State` appears, preselected on the current profile when present

#### Scenario: Empty library
- GIVEN no recordings
- WHEN `b` is pressed
- THEN nothing happens

### Requirement: Profile permission message

When a replay or recording fails with `source-unreadable`, the TUI MUST show the platform-aware permission message in a visible message without crashing, and the library MUST remain usable.

#### Scenario: Full Disk Access message
- GIVEN macOS and a `copy-of-real` replay denied by EPERM
- WHEN the replay starts
- THEN the visible message names Full Disk Access and restarting the terminal, not "could not be found"
