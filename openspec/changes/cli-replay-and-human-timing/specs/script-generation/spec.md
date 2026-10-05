# Delta for script-generation

## ADDED Requirements

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

## MODIFIED Requirements

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
