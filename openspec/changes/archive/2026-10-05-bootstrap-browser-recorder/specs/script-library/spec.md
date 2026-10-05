# Delta for script-library

## ADDED Requirements

### Requirement: Storage layout

Each recording MUST live at `recordings/<slug>/recording.json` (metadata and events) and `script.mjs`. `recordings/` MUST be gitignored.

#### Scenario: Create
- GIVEN name "Login Flow"
- WHEN a recording is created
- THEN directory `recordings/login-flow/` exists with `recording.json` containing name, optional start URL, createdAt

### Requirement: Slug generation

Slugs MUST be lowercase, ASCII, hyphen-separated, and safe as a single path segment on all OSes. Collisions MUST get a numeric suffix.

#### Scenario: Unsafe characters
- GIVEN name `../My Test: "A/B"`
- WHEN slugified
- THEN the slug is `my-test-a-b` with no separators or dots-only segments

#### Scenario: Collision
- GIVEN `login-flow` exists
- WHEN another "Login Flow" is created
- THEN the slug is `login-flow-2`

#### Scenario: Reserved name
- GIVEN name `CON` or an empty/symbol-only name
- WHEN slugified
- THEN a valid fallback slug is produced or validation rejects an empty name

### Requirement: Listing

The system MUST list recordings sorted by createdAt descending and skip invalid directories without failing.

#### Scenario: Corrupt entry
- GIVEN one directory has invalid JSON
- WHEN listing
- THEN valid recordings are returned and the corrupt one is reported as invalid

### Requirement: Rename

Rename MUST update the name and move the directory to the new slug atomically, and MUST refuse if the target slug exists.

#### Scenario: Collision
- GIVEN `a` and `b` exist
- WHEN `a` is renamed to "B"
- THEN rename fails with a conflict error and both remain unchanged

#### Scenario: Same slug
- GIVEN `my-test` is renamed to "My Test!"
- WHEN slugs match
- THEN only the display name changes

### Requirement: Delete

Delete MUST remove the whole directory only after explicit confirmation.

#### Scenario: Declined
- GIVEN the user is asked to confirm
- WHEN the user answers no or presses Esc
- THEN nothing is deleted

#### Scenario: Confirmed
- GIVEN confirmation is given
- WHEN delete runs
- THEN the directory no longer exists

### Requirement: Crash-safe writes

All JSON and script writes MUST use temp file plus rename, and leftover temp files MUST be ignored on listing.

#### Scenario: Orphan temp
- GIVEN `recording.json.tmp` exists beside a valid `recording.json`
- WHEN loading
- THEN the valid file is read unchanged

#### Scenario: Schema version
- GIVEN `recording.json` has an unsupported version
- WHEN loaded
- THEN a descriptive error is returned and the file is not modified
