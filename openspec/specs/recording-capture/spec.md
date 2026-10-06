# Delta for recording-capture

## ADDED Requirements

### Requirement: Event coverage

The system MUST capture clicks (left/middle/right, modifiers), dblclick, check (with the resulting `checked` state, so unchecking is a `check` with `checked: false`), fill, select, key presses and modifier shortcuts, scroll, drag and drop, file inputs (file names), dialogs (accept/dismiss, prompt text), goto/wait-for-url, reload, go-back, go-forward, new tab, page close, in the main frame and in iframes, including cross-origin iframes that run in their own process.

#### Scenario: Modified right click
- GIVEN a recording session on a page with a button
- WHEN the user Shift+right-clicks the button
- THEN one click event is stored with button `right` and modifiers `["Shift"]`

#### Scenario: Checkbox state
- GIVEN an unchecked checkbox
- WHEN the user clicks it, then clicks it again
- THEN events `check` with `checked: true` then `check` with `checked: false` are stored, not plain clicks

#### Scenario: Dialog
- GIVEN a page that opens a `prompt`
- WHEN the user types "abc" and accepts
- THEN a dialog event with action `accept` and prompt text `abc` is stored

#### Scenario: Dialog answered in the browser window
- GIVEN a headed browser that shows its own native dialog next to the recorder's prompt
- WHEN the user answers it in the browser window instead of the recorder
- THEN the same dialog event (action, prompt text) is stored and the recorder's prompt closes

#### Scenario: Scroll inside a shadow root
- GIVEN a page whose scrollable box lives inside an open shadow root (also nested ones, roots attached after load, and shadow roots of an iframe)
- WHEN the user scrolls the box with the wheel
- THEN one scroll event is stored with the final `scrollLeft`/`scrollTop` and a locator that Playwright resolves across the shadow boundary (for example `#box`), and the page's main world is untouched

#### Scenario: Scroll inside a closed shadow root
- GIVEN a scrollable box inside a closed shadow root
- WHEN the user scrolls it
- THEN no scroll event is stored: a closed root is unreachable from the isolated world and Playwright locators do not pierce it (documented limitation)

#### Scenario: Cross-origin iframe
- GIVEN a page with an iframe from another site (it runs in its own process)
- WHEN the user clicks inside that iframe
- THEN a click event is stored whose target carries the iframe selector in its frame path

### Requirement: Navigation fidelity

The system MUST record reload, go-back and go-forward as distinct events and MUST NOT drop navigations to the same URL.

#### Scenario: Reload
- GIVEN the page is at `https://a.test/x`
- WHEN the user reloads it
- THEN a `reload` event is stored and no `goto` is emitted

#### Scenario: Back and forward
- GIVEN history `/a` then `/b`
- WHEN the user goes back then forward
- THEN events `go-back` then `go-forward` are stored, and no `wait-for-url` duplicates them

#### Scenario: Action-triggered navigation
- GIVEN a click causes navigation within 1000 ms (a redirect within 1500 ms of the previous navigation counts the same)
- WHEN the main frame navigates
- THEN a `wait-for-url` event follows the click; a navigation with no preceding action yields `goto`

### Requirement: Locator selection

The system MUST choose the first unique locator in order: testid, role+name, label, placeholder, non-dynamic `#id`, exact text, stable CSS path. Uniqueness MUST be verified in-page at capture time.

#### Scenario: Duplicate id fallback
- GIVEN two elements share `id="x"` and one has a unique label
- WHEN the user clicks it
- THEN a label-derived locator is stored, never `#x`: role+name when the element has an implicit role (it outranks label), otherwise the label locator

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

Before a click on target T the system MUST emit `hover` only for (1) the outermost ancestor of T (excluding html/body) entered since the previous action, and (2) the last entered non-ancestor element during whose hover a DOM mutation occurred. A DOM mutation within the activation window (named constant, 300-500 ms) after a click or keyboard activation MUST be attributed to that action and MUST NOT count for rule 2. Rule 1 is unchanged.

#### Scenario: CSS menu
- GIVEN a hidden item inside a menu revealed by `:hover`
- WHEN the user hovers the menu then clicks the item
- THEN a hover on the menu is stored before the click

#### Scenario: No noise
- GIVEN the pointer crosses unrelated elements without DOM mutation
- WHEN the user clicks T
- THEN no hover is stored for them

#### Scenario: Click opens a modal under a resting pointer
- GIVEN the pointer rests over element H and a click opens a modal within the activation window
- WHEN the user then clicks a control inside the modal
- THEN no hover on H is stored

#### Scenario: Keyboard activation opens a modal
- GIVEN the pointer rests over H and a key press (Enter) opens a modal within the window
- WHEN the user then clicks inside the modal
- THEN no hover on H is stored

#### Scenario: Legitimate popover outside the window
- GIVEN the user enters element P and a JS handler opens a popover after the activation window has elapsed
- WHEN the user clicks an item in the popover
- THEN a hover on P is stored before the click

#### Scenario: Rule 1 unchanged
- GIVEN the user enters a container C then clicks a descendant T of C within the activation window of a previous click
- WHEN capture finishes
- THEN a hover on C (outermost ancestor of T) is still stored

### Requirement: Interrupted recording safety

The system MUST persist `recording.json` on Ctrl+C, browser or last-page close, and shortly after each event (saves are debounced by 250 ms so a typing burst writes once) via atomic write (temp file then rename).

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
- THEN the fill event has `isSensitive: true`
### Requirement: Patchright persistent context

Recording MUST launch through Patchright `launchPersistentContext` using the resolved profile directory and browser executable, headed, with `viewport: null` and no custom user agent or headers.

#### Scenario: Stored browser
- GIVEN browser `brave` and mode `managed`
- WHEN recording starts
- THEN the context launches with Brave's executable and the managed directory

#### Scenario: Fallback
- GIVEN the requested browser is not installed
- WHEN recording starts
- THEN it launches the bundled Chromium and surfaces the fallback warning

### Requirement: No leaking CDP domains

Our CDP sessions MUST NOT send `Runtime.enable` or `Console.enable`; isolated-world capture MUST work without them, including in cross-origin iframes.

#### Scenario: Protocol trace
- GIVEN a headless session that records a click in a page and an iframe
- WHEN every CDP method sent by our sessions is traced
- THEN neither `Runtime.enable` nor `Console.enable` appears and the click events are stored

### Requirement: Recording stores browser and profile mode

The saved recording MUST include the browser id and profile mode, and MUST NOT include cookies or profile contents.

#### Scenario: Saved fields
- GIVEN a session with `chrome` and `copy-of-real`
- WHEN `recording.json` is saved
- THEN it holds browser `chrome` and mode `copy-of-real`

### Requirement: Locked profile at start

If the profile is locked, recording MUST NOT start and MUST report the lock error.

#### Scenario: Locked
- GIVEN the profile lock is held
- WHEN recording starts
- THEN no recording is created and the error is shown
