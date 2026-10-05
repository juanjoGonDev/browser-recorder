# Delta for script-library

## ADDED Requirements

### Requirement: Browser fields in recording schema

`recording.json` MUST carry a browser id and a profile mode (`managed`, `copy-of-real` or `ephemeral`), plus the chosen real-profile directory name for `copy-of-real`. The schema version MUST be bumped or the fields MUST be optional so existing files stay valid.

#### Scenario: Round trip
- GIVEN a recording with `brave`, `copy-of-real`, profile `Profile 2`
- WHEN saved and loaded
- THEN all three values are preserved

### Requirement: Old recordings

A recording lacking browser fields MUST load as browser `bundled` and mode `ephemeral`, without modifying the file.

#### Scenario: Legacy file
- GIVEN a version-1 `recording.json` with no browser fields
- WHEN loaded
- THEN it is valid, reads as `bundled` + `ephemeral`, and the file bytes are unchanged

### Requirement: Invalid browser fields

An unknown profile mode MUST be reported as an invalid recording without failing listing.

#### Scenario: Bad mode
- GIVEN mode `shared`
- WHEN listing
- THEN that entry is reported invalid and valid ones are returned

### Requirement: Browser immutable

The browser and profile mode of an existing recording MUST NOT change through rename.

#### Scenario: Rename
- GIVEN a recording with `chrome`
- WHEN renamed
- THEN the browser and mode are unchanged
