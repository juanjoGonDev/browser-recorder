# Delta for script-generation

## MODIFIED Requirements

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
