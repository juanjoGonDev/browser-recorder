# Delta for browser-profiles

## ADDED Requirements

### Requirement: Permission-denied source reporting

When reading `Local State` or reading/copying the chosen profile fails with a permission error (EPERM or EACCES), the system MUST fail with a `ProfileCopyError` of code `source-unreadable`, distinct from the missing-source error. Any other error MUST be rethrown unchanged. The user-facing message MUST NOT contain filesystem paths. On macOS it MUST name Full Disk Access for the terminal app (System Settings > Privacy & Security) and say to restart the terminal; on other platforms it MUST give a generic permission hint.

#### Scenario: macOS permission denied
- GIVEN platform macOS and reading `Local State` fails with EPERM
- WHEN a `copy-of-real` launch is prepared
- THEN the error code is `source-unreadable` and the message names Full Disk Access and restarting the terminal
- AND the message contains no path

#### Scenario: Profile directory denied on another OS
- GIVEN platform Linux and copying the profile fails with EACCES
- WHEN the copy runs
- THEN the error code is `source-unreadable` with a generic permission hint

#### Scenario: Missing is still missing
- GIVEN `Local State` does not exist (ENOENT)
- WHEN a copy is prepared
- THEN the message says the profile could not be found, not permission denied

#### Scenario: Unknown error
- GIVEN reading fails with an unrelated errno (for example EIO)
- WHEN a copy is prepared
- THEN the original error propagates unchanged

## MODIFIED Requirements

### Requirement: Real profile listing

The system MUST list profiles from the browser's `Local State` (`profile.info_cache`) with their directory name and display name. A `Local State` that is missing or permission-denied MUST yield no listed profiles (no copy options) rather than an error.
(Previously: unreadable Local State returned a descriptive error; permission denial was not distinguished from missing)

#### Scenario: Multiple profiles
- GIVEN `Local State` lists `Default` and `Profile 2`
- WHEN listed
- THEN both are returned with display names, `Default` first

#### Scenario: Unreadable Local State
- GIVEN `Local State` is missing or invalid JSON
- WHEN listed
- THEN no profiles are returned, nothing is written and nothing throws
- AND preparing a `copy-of-real` launch still reports the missing-source error

#### Scenario: Permission-denied listing
- GIVEN reading `Local State` fails with EPERM
- WHEN profiles are listed for the picker
- THEN no profiles are returned, nothing is written and nothing throws
