# Delta for repository-quality

## MODIFIED Requirements

### Requirement: Dependency hygiene

All dependencies MUST use exact versions; Patchright (pinned `1.63.0`) MUST be the only runtime dependency and `playwright` MUST NOT appear; `pnpm audit` MUST report zero findings; `.npmrc` MUST enable save-exact, minimum-release-age, engine-strict and frozen lockfile.
(Previously: Playwright was the only runtime dependency)

#### Scenario: Audit
- GIVEN a fresh install
- WHEN `pnpm audit` runs
- THEN it exits 0 with no vulnerabilities

#### Scenario: Range detected
- GIVEN a dependency declared as `^1.0.0`
- WHEN the quality check runs
- THEN it fails

#### Scenario: Playwright reintroduced
- GIVEN `playwright` is imported or declared
- WHEN the quality check runs
- THEN it fails

## ADDED Requirements

### Requirement: CDP leak lint

Lint MUST fail on any `Runtime.enable` or `Console.enable` call in source.

#### Scenario: Forbidden call
- GIVEN a session sends `Runtime.enable`
- WHEN linted
- THEN an error is reported

### Requirement: Opt-in real-browser tests

The default test suite MUST be headless and MUST NOT read a real profile; real-browser tests MUST run only with `BROWSER_RECORDER_REAL_BROWSER_TESTS=1` and copy from a fixture profile.

#### Scenario: Default run
- GIVEN the variable is unset
- WHEN tests run
- THEN real-browser tests are skipped and no real profile path is read

### Requirement: Dependency direction for new modules

`src/browser-selection/` and `src/browser-profiles/` domains MUST NOT import adapters; dependency-cruiser MUST enforce it.

#### Scenario: Layer violation
- GIVEN a browser-profiles domain module imports an adapter
- WHEN `deps:check` runs
- THEN it fails
