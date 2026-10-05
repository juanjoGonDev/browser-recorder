# Delta for script-generation

## ADDED Requirements

### Requirement: Plain Playwright ESM output

The system MUST generate `recordings/<slug>/script.mjs` from `recording.json`, runnable with `node` only, importing `playwright` and nothing project-specific.

#### Scenario: Runnable
- GIVEN a valid recording
- WHEN the script is generated
- THEN the file parses as ESM and contains no import other than `playwright` and `node:` builtins

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

The script MUST print `::step <index>` before each step, 0-based, to stdout.

#### Scenario: Markers
- GIVEN a 3-event recording
- WHEN the script runs
- THEN stdout contains `::step 0`, `::step 1`, `::step 2` in order

### Requirement: Event-to-code mapping

Every event type MUST map to a Playwright call: reload to `page.reload`, back/forward to `goBack`/`goForward`, new tab to a new page variable, dialog to a registered handler, file input to `setInputFiles`, drag to `dragTo`.

#### Scenario: Multi-tab
- GIVEN events on `page` and `page2`
- WHEN generated
- THEN steps for `page2` use the `page2` variable created at its new-tab event

#### Scenario: Unknown event type
- GIVEN a recording contains an unsupported event type
- WHEN generation runs
- THEN it fails with an error naming the type and index, and no file is written

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
