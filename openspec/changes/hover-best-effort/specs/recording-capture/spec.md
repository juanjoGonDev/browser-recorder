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
