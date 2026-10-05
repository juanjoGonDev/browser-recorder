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

#### Scenario: Windows file locks on cleanup
- GIVEN a browser that has just exited still holds a file of its session directory (for example `chrome_debug.log`), so deleting it fails with EBUSY or EPERM for a moment
- WHEN cleanup runs
- THEN the deletion is retried (up to 10 retries, 100 ms linear backoff) and the directory no longer exists once the lock is gone
- AND a directory that stays locked never makes the session fail: it is left for the startup sweep

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

Mode `copy-of-real` MUST, before each launch, copy the chosen profile directory plus `Local State` into a tool-owned directory, skipping lock files (`SingletonLock`, `SingletonCookie`, `SingletonSocket`, `lockfile`) and caches (`Cache`, `Code Cache`, `GPUCache`). It MUST copy each SQLite `-wal` and `-journal` sibling together with its database and retry the copy of a file that changes or fails mid-read. The browser executable launched on the copy MUST be the same browser the profile came from.

It MUST NOT copy `-shm` files: they are a rebuildable shared-memory index of the WAL, SQLite recreates them from the `-wal` file on first open, and a `-shm` captured from a live database can disagree with the copied `-wal` and corrupt the copy.

#### Scenario: WAL sibling
- GIVEN `Cookies` and `Cookies-wal` exist
- WHEN copied
- THEN both exist in the copy with identical bytes

#### Scenario: Shared-memory sibling
- GIVEN `Cookies`, `Cookies-wal` and `Cookies-shm` exist
- WHEN copied
- THEN `Cookies` and `Cookies-wal` exist in the copy and `Cookies-shm` does not

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

When a copied profile is likely to be undecryptable by the browser (Windows app-bound encryption, flagged in `Local State`), the system SHOULD warn before launch that the copy will probably not be logged in, instead of failing silently. Detecting rejected cookies after launch is out of scope: it would require reading the source cookie database (no SQLite dependency exists) and a zero count is also legitimate (session-only or expired cookies), so a post-launch check would give false alarms.

#### Scenario: Unreadable cookies
- GIVEN the profile source is a Windows browser whose `Local State` reports app-bound encryption
- WHEN a copy of it is prepared
- THEN a warning states the copy will probably not be logged in
