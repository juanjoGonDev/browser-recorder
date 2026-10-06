# Delta for script-generation

## ADDED Requirements

### Requirement: Best-effort hover

A `hover` event MUST render as a call to a runtime helper that tries the hover with a timeout of 2 s (named constant). If the hover cannot be performed (target missing, not visible, obscured, detached, timeout) the helper MUST print `::warn <JSON string>` on stdout naming the step index and the reason, and MUST continue. A skipped hover MUST NOT fail the script, including when it is the last step. Click, dblclick, check, fill, select and drag MUST keep strict behavior (default Patchright timeout, failure stops the script). Output stays deterministic and no code runs in the page.

#### Scenario: Hover obscured by a modal
- GIVEN a hover step on an element covered by an open modal
- WHEN replayed
- THEN a `::warn` naming that step is printed within about 2 s, the next step runs and the script ends with `::done`

#### Scenario: Hover target missing
- GIVEN a hover step whose locator matches nothing
- WHEN replayed
- THEN a `::warn` naming that step is printed and the script continues

#### Scenario: Hover that works
- GIVEN a hover step on a visible, unobstructed element
- WHEN replayed
- THEN the hover is performed and no `::warn` is printed

#### Scenario: CSS menu hover still performed
- GIVEN a hover on a `:hover` menu followed by a click on a revealed item
- WHEN replayed
- THEN the hover is performed and the click succeeds

#### Scenario: Skipped hover as last step
- GIVEN a skipped hover is the final step
- WHEN replayed
- THEN exit code is 0 after `::warn` and `::done`

#### Scenario: Click strictness unchanged
- GIVEN a click on an obscured or missing element
- WHEN replayed
- THEN the script fails with `::error` naming the step, as before
