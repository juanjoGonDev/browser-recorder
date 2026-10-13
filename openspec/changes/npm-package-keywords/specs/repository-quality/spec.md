# Delta for repository-quality

## ADDED Requirements

### Requirement: npm discoverability metadata

The public npm package MUST declare a lowercase `keywords` array that describes
the browser automation, recording, testing, Patchright, and CLI use cases. The
array MUST contain the exact keyword `cli`.

#### Scenario: CLI discovery

- GIVEN the published package manifest
- WHEN npm indexes its keywords
- THEN the exact keyword `cli` MUST be present
