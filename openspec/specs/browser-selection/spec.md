# Browser Selection Specification

## Purpose

Catalogue and detect Chromium-based browsers per OS, and fall back to the bundled Chromium when a recorded browser is unavailable.

## Requirements

### Requirement: Browser catalogue

The system MUST know Brave, Chrome, Edge, Chromium, Vivaldi and Opera, each with an id, display name and per-OS executable and user-data paths for macOS, Windows and Linux, plus the bundled Patchright Chromium (id `bundled`). Detection MUST be pure over an injected file-system port.

#### Scenario: macOS Brave
- GIVEN platform darwin and `/Applications/Brave Browser.app/Contents/MacOS/Brave Browser` exists
- WHEN detection runs
- THEN `brave` is listed with that executable

#### Scenario: Windows paths
- GIVEN platform win32, `%PROGRAMFILES%` and `%LOCALAPPDATA%` set, Chrome under `Program Files`
- WHEN detection runs
- THEN `chrome` is listed with a `node:path` win32 path and handles spaces

#### Scenario: Linux paths
- GIVEN platform linux and `/usr/bin/brave-browser` exists
- WHEN detection runs
- THEN `brave` is listed; browsers whose paths are absent are not

### Requirement: Always-available bundled option

The detected list MUST always include `bundled` and MUST list it last.

#### Scenario: Nothing installed
- GIVEN no catalogued browser exists on disk
- WHEN detection runs
- THEN the list is exactly `[bundled]`

### Requirement: Fallback with warning

When the requested browser id is not installed, resolution MUST fall back to `bundled` and return a warning naming the missing browser; it MUST NOT fail.

#### Scenario: Recorded Brave missing
- GIVEN a recording stored `brave` and Brave is not installed
- WHEN the browser is resolved
- THEN `bundled` is returned with a warning that mentions `brave`

#### Scenario: Installed browser
- GIVEN the requested browser exists
- WHEN resolved
- THEN its executable is returned and no warning is produced

### Requirement: Unknown id

An id absent from the catalogue MUST resolve like a missing browser (fallback plus warning).

#### Scenario: Unknown id
- GIVEN a stored id `netscape`
- WHEN resolved
- THEN `bundled` is returned with a warning
