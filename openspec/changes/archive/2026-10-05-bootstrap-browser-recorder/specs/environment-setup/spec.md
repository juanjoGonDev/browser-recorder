# Delta for environment-setup

## ADDED Requirements

### Requirement: Chromium detection

On startup the system MUST check that the Chromium executable exists.

#### Scenario: Present
- GIVEN the executable path exists
- WHEN startup runs
- THEN no install is attempted

#### Scenario: Missing
- GIVEN the executable path does not exist
- WHEN startup runs
- THEN the user is told Chromium is missing before install begins

### Requirement: Automatic install

When missing, the system MUST run the Playwright CLI install for Chromium, stream its output to the TUI, and re-check afterwards.

#### Scenario: Success
- GIVEN Chromium is missing
- WHEN the install exits 0 and the executable now exists
- THEN the app proceeds to the library

#### Scenario: Failure
- GIVEN the install exits non-zero or the executable is still absent
- WHEN reported
- THEN an error shows the exit code and a manual retry command, and recording is disabled

#### Scenario: Offline
- GIVEN no network
- WHEN install fails
- THEN the failure is shown without a crash, and the library remains usable for listing, renaming, deleting and viewing a timeline, while recording and replay stay disabled with the reason shown

### Requirement: Linux system dependencies

On Linux, when the browser fails to launch for missing libraries, the system MUST print the exact `sudo pnpm exec playwright install-deps chromium` command (and the `--with-deps` alternative) for the user to run, and MUST NOT run it or escalate privileges.

#### Scenario: Missing libs
- GIVEN a launch error naming missing shared libraries on Linux
- WHEN handled
- THEN the guidance includes the `sudo pnpm exec playwright install-deps chromium` command and nothing is executed

### Requirement: Cross-OS portability

Executable resolution and spawns MUST work on macOS, Windows and Linux, using Node >= 22.13 and failing clearly otherwise.

#### Scenario: Old Node
- GIVEN Node 20
- WHEN the app starts
- THEN it exits with a message stating the required minimum version

#### Scenario: Windows spawn
- GIVEN the platform is win32
- WHEN the install command is built
- THEN it resolves the CLI via a `node` invocation, not a shell-dependent `.cmd` shim
