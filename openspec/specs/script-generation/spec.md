# Delta for script-generation

## ADDED Requirements

### Requirement: Plain Patchright ESM output

The system MUST generate `recordings/<slug>/script.mjs` from `recording.json`, runnable with `node` only, importing `patchright` and nothing project-specific.
(Previously: imported `playwright`)

#### Scenario: Runnable
- GIVEN a valid recording
- WHEN the script is generated
- THEN the file parses as ESM and contains no import other than `patchright` and `node:` builtins

#### Scenario: Deterministic
- GIVEN the same `recording.json`
- WHEN generated twice
- THEN the outputs are byte-identical

### Requirement: Absolute-offset scheduling

Each step MUST wait until its recorded `offsetMs` from script start before executing, so step duration is absorbed rather than accumulated. A step already late MUST run immediately.

#### Scenario: Offset wait
- GIVEN steps at 0, 1000 and 1500 ms
- WHEN the script runs with a step 1 taking 400 ms
- THEN step 2 starts at about 1000 ms and step 3 at about 1500 ms (±100 ms)

#### Scenario: Late step
- GIVEN a step takes longer than the next offset
- WHEN it completes
- THEN the next step runs without extra delay

### Requirement: Progress markers

The script MUST print `::step <index> <elapsedMs>` before each step, 0-based, to stdout, `::done <elapsedMs>` at the end, and `::error <index or -> <JSON string message>` on failure.

#### Scenario: Markers
- GIVEN a 3-event recording
- WHEN the script runs
- THEN stdout contains `::step 0`, `::step 1`, `::step 2` in order

### Requirement: Event-to-code mapping

Every event type MUST map to a Patchright call: reload to `page.reload`, back/forward to `goBack`/`goForward`, new tab to a new page variable, dialog to a registered handler, file input to `setInputFiles`, drag to `dragTo`.
(Previously: Playwright call)

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

### Requirement: Safe literals

Values and locators MUST be emitted as escaped string literals.

#### Scenario: Injection
- GIVEN a fill value `"); process.exit(1); ("`
- WHEN generated
- THEN the script treats it as data and fills it verbatim

### Requirement: Atomic generation

The script MUST be written via temp file then rename.

#### Scenario: Write failure
- GIVEN the rename fails
- WHEN generation ends
- THEN any previous `script.mjs` remains unchanged

## ADDED Requirements

### Requirement: Launch recorded browser and profile

The script MUST launch with `launchPersistentContext` using the recorded browser and profile mode, `viewport: null`, headed, and MUST fall back to the bundled Chromium with a printed warning when the browser is not installed. It MUST NOT write to a real profile: `copy-of-real` launches on a tool-owned copy.

#### Scenario: Managed Brave
- GIVEN a recording with `brave` and `managed`
- WHEN generated
- THEN the script launches Brave's executable on the managed directory

#### Scenario: Ephemeral
- GIVEN mode `ephemeral`
- WHEN the script runs
- THEN a temp profile is used and removed at the end

#### Scenario: Copy of real
- GIVEN mode `copy-of-real`
- WHEN the script runs
- THEN the real profile directory is not an argument of the launch

### Requirement: Old recordings

A recording without browser fields MUST generate a script using the bundled Chromium and an ephemeral profile.

#### Scenario: Legacy recording
- GIVEN `recording.json` has no browser or profile mode
- WHEN generated
- THEN the script launches bundled Chromium with an ephemeral profile
