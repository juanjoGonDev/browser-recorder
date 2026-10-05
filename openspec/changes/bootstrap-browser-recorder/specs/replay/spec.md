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

The system MUST parse `::step <n>` lines from stdout, tolerating chunk splits and CRLF, and ignore other lines.

#### Scenario: Split chunk
- GIVEN stdout arrives as `::ste` then `p 3\r\n`
- WHEN parsed
- THEN one progress event for step 3 is emitted

#### Scenario: Noise
- GIVEN a line `::step abc` or ordinary output
- WHEN parsed
- THEN no progress event is emitted

### Requirement: Timing tolerance

Each step MUST start within ±100 ms of its recorded offset when the page allows it.

#### Scenario: Timing check
- GIVEN a recording with steps at known offsets against a local fixture page
- WHEN replayed
- THEN each `::step` marker time minus script start is within ±100 ms of its offset

### Requirement: Exit handling

The system MUST report success on exit code 0 and failure details (code, last stderr lines) otherwise, and MUST terminate the child on user cancel.

#### Scenario: Failing step
- GIVEN a locator no longer exists
- WHEN replay runs
- THEN the result is failed, includes the last step index and stderr tail

#### Scenario: Cancel
- GIVEN a replay is running
- WHEN the user cancels
- THEN the child process is killed and state returns to idle
