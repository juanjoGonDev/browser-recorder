# Delta for replay

## MODIFIED Requirements

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
