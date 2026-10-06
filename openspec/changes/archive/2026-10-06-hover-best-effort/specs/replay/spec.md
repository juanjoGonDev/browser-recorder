# Delta for replay

## ADDED Requirements

### Requirement: Hover warning surfaced

A `::warn` line produced by a skipped hover MUST be surfaced like any script warning (CLI writes it to stderr, TUI lists it among warnings) without changing the success result. The CLI step line for the hover MUST stay as before; the warning is the only extra output.

#### Scenario: Modal covers a hovered header in CLI
- GIVEN a recording whose hover target is covered by a modal opened by the previous click
- WHEN replayed via `browser-recorder replay`
- THEN the result is success, exit code 0, stderr holds one warning naming the hover step, and the hover's step line is unchanged

#### Scenario: Same replay in the TUI
- GIVEN the same recording replayed from the TUI
- WHEN it finishes
- THEN the result is success and the warning is listed in the TUI warnings

#### Scenario: Working hover
- GIVEN a recording whose hovers all succeed
- WHEN replayed
- THEN no hover warning appears

#### Scenario: Later strict failure still fails
- GIVEN a skipped hover followed by a click on a missing element
- WHEN replayed
- THEN the result is failed naming the click step, and the hover warning is still reported
