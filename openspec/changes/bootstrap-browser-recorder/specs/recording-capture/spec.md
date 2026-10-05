# Delta for recording-capture

## ADDED Requirements

### Requirement: Event coverage

The system MUST capture clicks (left/middle/right, modifiers), dblclick, check/uncheck, fill, select, key presses and modifier shortcuts, scroll, drag and drop, file inputs (file names), dialogs (accept/dismiss, prompt text), goto/waitForURL, reload, back, forward, new tab, page close.

#### Scenario: Modified right click
- GIVEN a recording session on a page with a button
- WHEN the user Shift+right-clicks the button
- THEN one click event is stored with button `right` and modifiers `["Shift"]`

#### Scenario: Checkbox state
- GIVEN an unchecked checkbox
- WHEN the user clicks it, then clicks it again
- THEN events `check` then `uncheck` are stored, not plain clicks

#### Scenario: Dialog
- GIVEN a page that opens a `prompt`
- WHEN the user types "abc" and accepts
- THEN a dialog event with action `accept` and text `abc` is stored

### Requirement: Navigation fidelity

The system MUST record reload, back and forward as distinct events and MUST NOT drop navigations to the same URL.

#### Scenario: Reload
- GIVEN the page is at `https://a.test/x`
- WHEN the user reloads it
- THEN a `reload` event is stored and no `goto` is emitted

#### Scenario: Back and forward
- GIVEN history `/a` then `/b`
- WHEN the user goes back then forward
- THEN events `back` then `forward` are stored, and no `waitForURL` duplicates them

#### Scenario: Action-triggered navigation
- GIVEN a click causes navigation within 2 s
- WHEN the main frame navigates
- THEN a `waitForURL` event follows the click; a navigation with no preceding action yields `goto`

### Requirement: Coalescing

Consecutive fills on the same locator MUST merge into one event keeping the first offset and the last value; consecutive selects likewise; consecutive goto/waitForURL likewise.

#### Scenario: Typing
- GIVEN the user types "h", "he", "hey" into one input
- WHEN capture finishes
- THEN one fill event with value `hey` and the offset of the first input exists

#### Scenario: Interleaved target
- GIVEN fill on input A, fill on input B, fill on input A
- WHEN capture finishes
- THEN three fill events exist

### Requirement: Locator selection

The system MUST choose the first unique locator in order: testid, role+name, label, placeholder, non-dynamic `#id`, exact text, stable CSS path. Uniqueness MUST be verified in-page at capture time.

#### Scenario: Duplicate id fallback
- GIVEN two elements share `id="x"` and one has a unique label
- WHEN the user clicks it
- THEN the label locator is stored, not `#x`

#### Scenario: Dynamic id
- GIVEN an element id matching a generated pattern (e.g. `:r1:`) and no other unique attribute
- WHEN clicked
- THEN a stable CSS path locator is stored

### Requirement: Monotonic offsets

Every event MUST carry `offsetMs` from session start, measured with a monotonic clock at Node receipt; offsets MUST be non-decreasing.

#### Scenario: Clock jump
- GIVEN the wall clock moves backward during recording
- WHEN events are stored
- THEN offsets remain non-decreasing

### Requirement: Deterministic hover

Before a click on target T the system MUST emit `hover` only for (1) the outermost ancestor of T (excluding html/body) entered since the previous action, and (2) the last entered non-ancestor element during whose hover a DOM mutation occurred.

#### Scenario: CSS menu
- GIVEN a hidden item inside a menu revealed by `:hover`
- WHEN the user hovers the menu then clicks the item
- THEN a hover on the menu is stored before the click

#### Scenario: No noise
- GIVEN the pointer crosses unrelated elements without DOM mutation
- WHEN the user clicks T
- THEN no hover is stored for them

### Requirement: Interrupted recording safety

The system MUST persist `recording.json` on Ctrl+C, browser or last-page close, and after every event via atomic write (temp file then rename).

#### Scenario: Ctrl+C
- GIVEN a recording with 5 events
- WHEN the user presses Ctrl+C
- THEN `recording.json` holds the 5 events and the process exits cleanly

#### Scenario: Browser closed
- GIVEN a recording in progress
- WHEN the user closes the browser window
- THEN the session ends, the file is saved and the library is shown

#### Scenario: Crash mid-write
- GIVEN a write fails between temp write and rename
- WHEN the file is read next
- THEN the previous valid `recording.json` is intact

### Requirement: Sensitive input flag

Password inputs MUST be flagged in the event; values are stored in plain text.

#### Scenario: Password
- GIVEN a `type=password` input
- WHEN the user fills it
- THEN the fill event has `sensitive: true`
