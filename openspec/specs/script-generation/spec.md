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

In `recorded` mode each step MUST wait until its recorded `offsetMs` from script start before executing, so step duration is absorbed rather than accumulated. A step already late MUST run immediately.
(Previously: the only scheduling behavior, with no mode)

#### Scenario: Offset wait
- GIVEN steps at 0, 1000 and 1500 ms
- WHEN the script runs in recorded mode with a step 1 taking 400 ms
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
### Requirement: Timing environment contract

The generated script MUST read `BROWSER_RECORDER_TIMING` (`recorded` default; any other value MUST be treated as `recorded`), `BROWSER_RECORDER_HUMAN_DELAY` (`<min>-<max>`, default `250-900`) and optional `BROWSER_RECORDER_SEED`. Output MUST stay byte-identical for the same `recording.json` regardless of these variables.

#### Scenario: Unknown mode
- GIVEN `BROWSER_RECORDER_TIMING=banana`
- WHEN the script runs
- THEN it behaves as recorded mode

### Requirement: Human timing mode

In `human` mode the script MUST wait a uniform random delay within the range after the previous step finishes, MUST NOT wait before the first step, and MUST NOT use absolute offsets. A recorded fill MUST be typed key by key with a per-key random delay scaled from the range, and the field MUST end with the exact recorded value. Sensitive values MUST NOT appear in any marker or output. With a seed, the delay sequence MUST be deterministic; without one it MAY vary.

#### Scenario: Range respected
- GIVEN range `250-900` and a 4-step recording
- WHEN run in human mode
- THEN each of the 3 inter-step waits is between 250 and 900 ms

#### Scenario: First step
- GIVEN human mode
- WHEN the script starts
- THEN step 0 begins without an inter-step delay

#### Scenario: Typed fill
- GIVEN a fill with value `a"b\n€`
- WHEN replayed in human mode
- THEN keys are typed one by one and the field value equals the recorded value exactly

#### Scenario: Sensitive value
- GIVEN a fill marked sensitive
- WHEN replayed in human mode
- THEN the value appears in no stdout or stderr line

#### Scenario: Seeded determinism
- GIVEN `BROWSER_RECORDER_SEED=7`
- WHEN the script runs twice
- THEN both runs compute the same delay sequence

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
