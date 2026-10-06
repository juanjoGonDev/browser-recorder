# Delta for replay

## ADDED Requirements

### Requirement: Replay by spawning the script

The system MUST replay by spawning `node <recordings>/<slug>/script.mjs` with a path built via `node:path` (no hardcoded separators), and MUST NOT interpret recordings itself.

#### Scenario: Windows path
- GIVEN a slug and a Windows base directory `C:\Users\me\app\recordings`
- WHEN the spawn arguments are built
- THEN the script path uses backslashes, contains no mixed separators, and handles spaces

#### Scenario: Missing script
- GIVEN `script.mjs` does not exist
- WHEN replay starts
- THEN an error names the missing file and no process is spawned

### Requirement: Progress parsing

The system MUST parse the script's progress lines from stdout, tolerating chunk splits and CRLF, and ignore other lines: `::step <index> <elapsedMs>`, `::done <elapsedMs>` and `::error <index or -> <JSON string message>`.

#### Scenario: Split chunk
- GIVEN stdout arrives as `::ste` then `p 3 1200\r\n`
- WHEN parsed
- THEN one progress event for step 3 is emitted

#### Scenario: Noise
- GIVEN a line `::step abc` or ordinary output
- WHEN parsed
- THEN no progress event is emitted

### Requirement: Timing tolerance

In `recorded` mode each step MUST start within ±100 ms of its recorded offset when the page allows it. In `human` mode the tolerance MUST NOT apply and drift MUST NOT be reported.
(Previously: applied to every replay, no mode distinction)

#### Scenario: Timing check
- GIVEN a recording with steps at known offsets against a local fixture page, recorded mode
- WHEN replayed
- THEN each `::step` marker time minus script start is within ±100 ms of its offset

#### Scenario: No drift in human mode
- GIVEN the same recording in human mode
- WHEN replayed
- THEN no drift value is reported and the ±100 ms check is not applied
### Requirement: Exit handling

The system MUST report success on exit code 0 and failure details (code, last stderr lines) otherwise, and MUST terminate the child on user cancel. Success MUST be reported only after the script has settled. A navigation timeout MUST fail the replay with a message naming the step. A settle-cap warning on stderr MUST be surfaced (CLI prints it on stderr, TUI shows it among warnings) without changing the success result.
(Previously: success on exit 0 with no settle, navigation-timeout or warning semantics)

#### Scenario: Failing step
- GIVEN a locator no longer exists
- WHEN replay runs
- THEN the result is failed, includes the last step index and stderr tail

#### Scenario: Cancel
- GIVEN a replay is running
- WHEN the user cancels
- THEN the child process is killed and state returns to idle

#### Scenario: Navigation timeout
- GIVEN an action whose expected navigation never arrives
- WHEN replayed
- THEN the result is failed and the message names the step

#### Scenario: Success after settle
- GIVEN a last click with a delayed POST and same-URL reload
- WHEN replay reports success
- THEN the server had already recorded the POST

#### Scenario: Cap warning in CLI
- GIVEN the page never goes quiet
- WHEN replayed via `browser-recorder replay`
- THEN the result is success, exit code 0, and the warning appears on stderr

#### Scenario: Cap warning in TUI
- GIVEN the same page replayed from the TUI
- WHEN it finishes
- THEN the result is success and the warning is listed in the TUI warnings

#### Scenario: No settle on cancel
- GIVEN a replay is cancelled while requests are in flight
- WHEN the child is terminated
- THEN no quiet wait is performed
### Requirement: Replay with recorded browser and profile

Replay MUST run the script so it uses the browser and profile mode stored in the recording; recordings without them MUST replay with bundled Chromium and an ephemeral profile.

#### Scenario: Stored browser
- GIVEN a recording with `brave` and `managed`
- WHEN replayed
- THEN the same browser and managed directory are used

#### Scenario: Legacy recording
- GIVEN a recording without browser fields
- WHEN replayed
- THEN bundled Chromium with an ephemeral profile is used

### Requirement: Fallback reported

When the recorded browser is missing, replay MUST continue on bundled Chromium and report a visible warning.

#### Scenario: Missing browser
- GIVEN the recorded browser is not installed
- WHEN replayed
- THEN the warning is reported and the replay runs on bundled Chromium

### Requirement: Lock reported

A profile locked by another process MUST make replay fail promptly with the lock error rather than hang.

#### Scenario: Locked
- GIVEN the profile is in use
- WHEN replay starts
- THEN the result is failed with a message naming the profile, within a bounded time
### Requirement: Timing mode in replay request

A replay request MUST carry a timing mode (`recorded` default, or `human` with a delay range and optional seed). The spawned script MUST receive them as `BROWSER_RECORDER_TIMING`, `BROWSER_RECORDER_HUMAN_DELAY=<min>-<max>` and, when `BROWSER_RECORDER_SEED` is set in the parent environment, the same seed. Timing MUST NOT be persisted in the recording.

#### Scenario: Human env
- GIVEN a request with human timing `250-900`
- WHEN the spawn environment is built
- THEN timing is `human` and delay is `250-900`

#### Scenario: Default
- GIVEN no timing in the request
- WHEN built
- THEN timing is `recorded` and `recording.json` is unchanged after replay

#### Scenario: Seed forwarded
- GIVEN `BROWSER_RECORDER_SEED=42` in the parent environment
- WHEN built
- THEN the script receives seed `42`

