# Browser Profiles Specification

## Purpose

Provide tool-owned browser profile directories (managed, copy-of-real, ephemeral) without ever writing to a real browser profile.

## Requirements

### Requirement: Managed profile

Mode `managed` (default) MUST use one persistent directory per browser under the OS user data directory (`~/Library/Application Support/browser-recorder`, `%LOCALAPPDATA%\browser-recorder`, `$XDG_DATA_HOME/browser-recorder`, falling back to `~/.local/share`), created with 0700 permissions and reused across recordings and replays.

#### Scenario: First use
- GIVEN no managed directory for `brave`
- WHEN a managed profile is resolved
- THEN the directory is created with mode 0700

#### Scenario: Reuse
- GIVEN a managed directory with a prior login
- WHEN a second recording and its replay resolve the profile
- THEN the same directory is returned and its contents are untouched

#### Scenario: Per browser
- GIVEN managed profiles for `brave` and `chrome`
- WHEN resolved
- THEN the directories differ

### Requirement: Ephemeral profile

Mode `ephemeral` MUST use a fresh temporary directory deleted after the session, including when the session fails.

#### Scenario: Cleanup
- GIVEN an ephemeral session ends, normally or by error
- WHEN cleanup runs
- THEN the directory no longer exists

### Requirement: Real profile listing

The system MUST list profiles from the browser's `Local State` (`profile.info_cache`) with their directory name and display name.

#### Scenario: Multiple profiles
- GIVEN `Local State` lists `Default` and `Profile 2`
- WHEN listed
- THEN both are returned with display names, `Default` first

#### Scenario: Unreadable Local State
- GIVEN `Local State` is missing or invalid JSON
- WHEN listed
- THEN a descriptive error is returned and nothing is written

### Requirement: Copy of real profile

Mode `copy-of-real` MUST, before each launch, copy the chosen profile directory plus `Local State` into a tool-owned directory, skipping lock files (`SingletonLock`, `SingletonCookie`, `SingletonSocket`, `lockfile`) and caches (`Cache`, `Code Cache`, `GPUCache`). It MUST copy each SQLite `-wal`, `-shm` and `-journal` sibling together with its database and retry the copy of a file that changes or fails mid-read. The browser executable launched on the copy MUST be the same browser the profile came from.

#### Scenario: WAL sibling
- GIVEN `Cookies` and `Cookies-wal` exist
- WHEN copied
- THEN both exist in the copy with identical bytes

#### Scenario: Torn read
- GIVEN a file changes during the first read attempt
- WHEN copying
- THEN the copy is retried and the final bytes match the source

#### Scenario: Running browser
- GIVEN the real browser is running
- WHEN copying
- THEN the copy succeeds and a warning states the snapshot may be stale

#### Scenario: Skipped entries
- GIVEN the source holds `SingletonLock` and `Cache/`
- WHEN copied
- THEN neither exists in the copy

### Requirement: Read-only source

The system MUST NOT create, modify, lock or delete anything inside a real profile directory.

#### Scenario: Hash unchanged
- GIVEN a fixture profile hashed recursively before
- WHEN copy-of-real runs and the session ends
- THEN the recursive hash is identical

### Requirement: Lock detection

Before launching on a managed or copied directory the system MUST detect a lock held by another live process and fail with a clear error naming the browser and directory; it MUST NOT hang.

#### Scenario: Locked managed profile
- GIVEN another process holds the managed profile lock
- WHEN a recording starts
- THEN an error reports the profile is in use and no browser is launched

#### Scenario: Stale lock
- GIVEN a lock file whose owner process no longer exists
- WHEN launching
- THEN the lock is ignored and launch proceeds

### Requirement: Encryption failure reporting

When a copied profile cannot be decrypted by the browser (e.g. Windows app-bound encryption), the system SHOULD report that the session could not be reused instead of failing silently.

#### Scenario: Unreadable cookies
- GIVEN the browser rejects the copied cookie store
- WHEN detected after launch
- THEN a message states logins were not carried over
