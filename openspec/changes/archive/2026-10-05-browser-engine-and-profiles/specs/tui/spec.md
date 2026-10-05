# Delta for tui

## MODIFIED Requirements

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

## ADDED Requirements

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
