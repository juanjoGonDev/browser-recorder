# Delta for environment-setup

## MODIFIED Requirements

### Requirement: Chromium detection

On startup the system MUST detect installed Chromium-based browsers and check that the bundled Patchright Chromium executable exists.
(Previously: only the Playwright Chromium executable was checked)

#### Scenario: Present
- GIVEN the bundled executable path exists
- WHEN startup runs
- THEN no install is attempted

#### Scenario: Missing
- GIVEN the bundled executable path does not exist
- WHEN startup runs
- THEN the user is told Chromium is missing before install begins

#### Scenario: System browser only
- GIVEN Brave is installed and bundled Chromium is missing
- WHEN startup runs
- THEN Brave is listed as selectable and the bundled install is still offered

### Requirement: Automatic install

When bundled Chromium is missing, the system MUST run `patchright install chromium`, stream its output to the TUI, and re-check afterwards.
(Previously: ran the Playwright CLI install)

#### Scenario: Success
- GIVEN Chromium is missing
- WHEN the install exits 0 and the executable now exists
- THEN the app proceeds to the library

#### Scenario: Failure
- GIVEN the install exits non-zero or the executable is still absent
- WHEN reported
- THEN an error shows the exit code and a manual retry command, and recording with bundled Chromium is disabled

#### Scenario: Offline
- GIVEN no network
- WHEN install fails
- THEN the failure is shown without a crash and the library stays usable; recording and replay stay disabled unless another browser is installed

### Requirement: Linux system dependencies

On Linux, when the browser fails to launch for missing libraries, the system MUST print the exact `sudo pnpm exec patchright install-deps chromium` command for the user to run, and MUST NOT run it or escalate privileges.
(Previously: `playwright install-deps`)

#### Scenario: Missing libs
- GIVEN a launch error naming missing shared libraries on Linux
- WHEN handled
- THEN the guidance includes the `patchright install-deps chromium` command and nothing is executed
