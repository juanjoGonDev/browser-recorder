# Delta for repository-quality

## ADDED Requirements

### Requirement: Replay script alias

`package.json` MUST define a `replay` script that runs the CLI `replay` subcommand with the arguments passed to it. The change MUST NOT alter the package `version`.

#### Scenario: Alias
- GIVEN `pnpm replay demo -r`
- WHEN executed
- THEN it is equivalent to `browser-recorder replay demo -r`

#### Scenario: Version untouched
- GIVEN the change diff
- WHEN `package.json` is compared with main
- THEN `version` is unchanged

### Requirement: Dependency direction for CLI

`src/cli/` domain modules MUST NOT import adapters, `node:` I/O modules or `console`; output MUST go through a port. dependency-cruiser MUST enforce it, and the CLI MUST add no runtime dependency.

#### Scenario: Layer violation
- GIVEN a `src/cli/` domain module imports an adapter
- WHEN `deps:check` runs
- THEN it fails

#### Scenario: Console use
- GIVEN a `src/cli/` module calls `console.log`
- WHEN linted
- THEN an error is reported
