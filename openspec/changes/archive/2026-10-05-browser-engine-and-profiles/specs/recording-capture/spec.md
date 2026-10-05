# Delta for recording-capture

## ADDED Requirements

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
