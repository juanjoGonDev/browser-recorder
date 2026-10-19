# Delta for script-library

## ADDED Requirements

### Requirement: Change browser

The library service MUST offer `changeBrowser(slug, choice)` that sets a recording's browser id, profile mode and (for `copy-of-real`) profile directory. It MUST rewrite `recording.json` and regenerate `script.mjs` with temp file plus rename, serialized per slug. Name, slug, start URL, createdAt and events MUST remain unchanged. A missing slug MUST fail without writing.

#### Scenario: Change applied
- GIVEN recording `demo` with `chrome` + `managed`
- WHEN changed to `brave` + `copy-of-real` + `Profile 2`
- THEN a reload returns those three values and identical name, slug and events
- AND `script.mjs` reflects the new browser

#### Scenario: Concurrent change and rename
- GIVEN a change and a rename on the same slug start together
- WHEN both finish
- THEN they ran one after the other and the recording is valid

#### Scenario: Unknown slug
- GIVEN no recording `ghost`
- WHEN `changeBrowser("ghost", choice)` runs
- THEN it fails and nothing is written

## MODIFIED Requirements

### Requirement: Browser immutable

The browser and profile mode of an existing recording MUST NOT change through rename or any other operation except an explicit change-browser action.
(Previously: the browser and profile mode MUST NOT change through rename, with no way to change them)

#### Scenario: Rename
- GIVEN a recording with `chrome`
- WHEN renamed
- THEN the browser and mode are unchanged

#### Scenario: Explicit change
- GIVEN a recording with `chrome`
- WHEN the change-browser action selects `brave`
- THEN the browser is `brave`
- AND a later rename leaves it `brave`
