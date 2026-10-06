# Delta for script-generation

## MODIFIED Requirements

### Requirement: Event-to-code mapping

Every event type MUST map to a Patchright call: reload to `page.reload`, back/forward to `goBack`/`goForward`, new tab to a new page variable, dialog to a registered handler, file input to `setInputFiles`, drag to `dragTo`. A `wait-for-url` follow-up MUST await a NEW main-frame navigation armed before the triggering action, matched on origin and pathname, not the current URL.
(Previously: `wait-for-url` could resolve against the already-current URL)

#### Scenario: Multi-tab
- GIVEN events on `page` and `page2`
- WHEN generated
- THEN steps for `page2` use the `page2` variable created at its new-tab event

#### Scenario: Unknown event type
- GIVEN a recording contains an unsupported event type
- WHEN generation runs
- THEN it fails with an error naming the type and index, and no file is written

#### Scenario: Scroll inside a shadow root
- GIVEN a recorded scroll whose locator resolves inside an open shadow root (nested roots and iframe hosts included)
- WHEN the script is replayed
- THEN the element ends at exactly the recorded scroll position, and no code runs in the page's main world (no page API call, no new global or property)

#### Scenario: Same-URL reload awaited
- GIVEN a click that triggers a delayed POST then a reload of the same URL, followed by `wait-for-url`
- WHEN replayed
- THEN the follow-up resolves only after that reload, and the POST was received by the server

#### Scenario: Cross-URL navigation awaited
- GIVEN a click navigating to a different path, followed by `wait-for-url`
- WHEN replayed
- THEN the follow-up resolves once that navigation commits

#### Scenario: Earlier navigation never satisfies
- GIVEN a navigation to the target path happened before the triggering action
- WHEN the action runs and triggers no navigation
- THEN the follow-up does not resolve from the earlier navigation

#### Scenario: Navigation armed before the action
- GIVEN an action whose navigation commits immediately
- WHEN replayed
- THEN the navigation is not missed and the follow-up resolves

#### Scenario: Missing navigation
- GIVEN the expected action navigation never arrives within the default wait
- WHEN replayed
- THEN the replay fails with an error naming the step

## ADDED Requirements

### Requirement: Settle before close

On success the script MUST wait for network quiet (no in-flight requests for 500 ms) before `::done` and closing the browser, capped at 5 s. Reaching the cap MUST NOT fail the replay and MUST report a warning: the script prints `::warn <JSON string>` on stdout, and the replay surfaces it (the CLI writes it to stderr). The wait MUST NOT run on failure, abort or cancel, MUST apply in `recorded` and `human` modes, and MUST NOT delay any step (recorded-timing drift unaffected). Tracking MUST happen in Node from request events: no page code, no `Runtime.enable`/`Console.enable`. WebSockets MUST NOT block quiet.

#### Scenario: Pending request completes
- GIVEN the last click starts a request finishing after 800 ms
- WHEN the last step ends
- THEN `::done` is printed only after the request finished plus a 500 ms quiet window

#### Scenario: Long-polling hits cap
- GIVEN a request that never completes
- WHEN the last step ends
- THEN `::done` follows at about 5 s, exit code is 0 and a `::warn` line is printed

#### Scenario: WebSocket open
- GIVEN an open WebSocket and no other traffic
- WHEN the last step ends
- THEN the script finishes after the quiet window, without a cap warning

#### Scenario: Failure skips settle
- GIVEN a step fails while a request is in flight
- WHEN the script exits
- THEN `::error` is printed without waiting for quiet

#### Scenario: Human mode
- GIVEN human timing and the same recording
- WHEN replayed
- THEN settle behaves identically and inter-step delays are unchanged

#### Scenario: No page instrumentation
- GIVEN the generated script
- WHEN inspected and replayed
- THEN it evaluates no code in the page and enables neither `Runtime` nor `Console`

#### Scenario: Drift unaffected
- GIVEN recorded mode
- WHEN replayed
- THEN every step still starts within ±100 ms of its offset
