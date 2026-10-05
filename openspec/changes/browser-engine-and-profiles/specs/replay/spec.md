# Delta for replay

## ADDED Requirements

### Requirement: Replay with recorded browser and profile

Replay MUST run the script so it uses the browser and profile mode stored in the recording; recordings without them MUST replay with bundled Chromium and an ephemeral profile.

#### Scenario: Stored browser
- GIVEN a recording with `brave` and `managed`
- WHEN replayed
- THEN the same browser and managed directory are used

#### Scenario: Legacy recording
- GIVEN a recording without browser fields
- WHEN replayed
- THEN bundled Chromium with an ephemeral profile is used

### Requirement: Fallback reported

When the recorded browser is missing, replay MUST continue on bundled Chromium and report a visible warning.

#### Scenario: Missing browser
- GIVEN the recorded browser is not installed
- WHEN replayed
- THEN the warning is reported and the replay runs on bundled Chromium

### Requirement: Lock reported

A profile locked by another process MUST make replay fail promptly with the lock error rather than hang.

#### Scenario: Locked
- GIVEN the profile is in use
- WHEN replay starts
- THEN the result is failed with a message naming the profile, within a bounded time
