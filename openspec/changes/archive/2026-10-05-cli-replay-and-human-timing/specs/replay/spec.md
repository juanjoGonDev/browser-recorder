# Delta for replay

## ADDED Requirements

### Requirement: Timing mode in replay request

A replay request MUST carry a timing mode (`recorded` default, or `human` with a delay range and optional seed). The spawned script MUST receive them as `BROWSER_RECORDER_TIMING`, `BROWSER_RECORDER_HUMAN_DELAY=<min>-<max>` and, when `BROWSER_RECORDER_SEED` is set in the parent environment, the same seed. Timing MUST NOT be persisted in the recording.

#### Scenario: Human env
- GIVEN a request with human timing `250-900`
- WHEN the spawn environment is built
- THEN timing is `human` and delay is `250-900`

#### Scenario: Default
- GIVEN no timing in the request
- WHEN built
- THEN timing is `recorded` and `recording.json` is unchanged after replay

#### Scenario: Seed forwarded
- GIVEN `BROWSER_RECORDER_SEED=42` in the parent environment
- WHEN built
- THEN the script receives seed `42`

## MODIFIED Requirements

### Requirement: Timing tolerance

In `recorded` mode each step MUST start within ±100 ms of its recorded offset when the page allows it. In `human` mode the tolerance MUST NOT apply and drift MUST NOT be reported.
(Previously: applied to every replay, no mode distinction)

#### Scenario: Timing check
- GIVEN a recording with steps at known offsets against a local fixture page, recorded mode
- WHEN replayed
- THEN each `::step` marker time minus script start is within ±100 ms of its offset

#### Scenario: No drift in human mode
- GIVEN the same recording in human mode
- WHEN replayed
- THEN no drift value is reported and the ±100 ms check is not applied
