# Delta for recording-capture

## MODIFIED Requirements

### Requirement: Deterministic hover

Before a click on target T the system MUST emit `hover` only for (1) the outermost ancestor of T (excluding html/body) entered since the previous action, and (2) the last entered non-ancestor element during whose hover a DOM mutation occurred. A DOM mutation within the activation window (named constant, 300-500 ms) after a click or keyboard activation MUST be attributed to that action and MUST NOT count for rule 2. Rule 1 is unchanged.
(Previously: any DOM mutation while the pointer was on an element counted for rule 2, including mutations caused by the preceding click)

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

### Requirement: Coalescing

Consecutive fills on the same locator MUST merge into one event keeping the last value and the offset of the last input; consecutive selects likewise; consecutive `wait-for-url` events on the same page likewise, while a `goto` followed by its redirect `wait-for-url` keeps both. A `hover` recorded within the activation window after a click MUST be dropped when its target is not an ancestor of the next action's target.
(Previously: no rule for hovers recorded right after a click)

#### Scenario: Typing
- GIVEN the user types "h", "he", "hey" into one input
- WHEN capture finishes
- THEN one fill event with value `hey` and the offset of the last input exists

#### Scenario: Interleaved target
- GIVEN fill on input A, fill on input B, fill on input A
- WHEN capture finishes
- THEN three fill events exist

#### Scenario: Hover on the acted-on element
- GIVEN a hover on target T immediately followed by a click, dblclick, check, fill or select on T (the label of a control counts as the control)
- WHEN capture finishes
- THEN only the action is stored, no hover

#### Scenario: Post-click non-ancestor hover dropped
- GIVEN a click at offset 1000 and a hover on H at offset 1009, followed by a click on T where H is not an ancestor of T
- WHEN events are coalesced
- THEN the hover on H is dropped and both clicks remain

#### Scenario: Post-click ancestor hover kept
- GIVEN the same sequence but H is an ancestor of T
- WHEN events are coalesced
- THEN the hover on H is kept

#### Scenario: Hover outside the window kept
- GIVEN a hover on a non-ancestor H recorded after the activation window
- WHEN events are coalesced
- THEN the hover is kept
