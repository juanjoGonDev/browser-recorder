# Delta for cli

## ADDED Requirements

### Requirement: Profile permission error output

When a replay fails with `source-unreadable`, the CLI MUST print the platform-aware permission message to stderr, nothing to stdout, and exit 1. The message MUST NOT contain paths.

#### Scenario: macOS denied
- GIVEN macOS and a `copy-of-real` recording whose `Local State` read gives EPERM
- WHEN `replay demo` runs
- THEN stderr names Full Disk Access and restarting the terminal, stdout is empty and the exit code is 1

#### Scenario: Missing stays distinct
- GIVEN `Local State` is missing
- WHEN `replay demo` runs
- THEN stderr says the profile could not be found

#### Scenario: Changed browser used
- GIVEN a recording whose browser was changed in the TUI
- WHEN `replay demo` runs
- THEN the replay launches the new browser and profile
