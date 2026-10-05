# Delta for repository-quality

## ADDED Requirements

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

### Requirement: Static analysis

ESLint MUST enforce function size limits, unicorn `filename-case` (kebab-case), and naming-convention for functions and types; knip and dependency-cruiser MUST pass and enforce domain/adapter direction.

#### Scenario: Long function
- GIVEN a function exceeding the line limit
- WHEN linted
- THEN an error is reported

#### Scenario: Bad filename
- GIVEN `MyFile.ts`
- WHEN linted
- THEN `filename-case` fails

#### Scenario: Layer violation
- GIVEN a domain module imports an adapter
- WHEN `deps:check` runs
- THEN it fails

### Requirement: Git hooks

lefthook MUST run prettier, eslint, typecheck and build on pre-commit; commitlint on commit-msg; tests, knip, deps:check and audit on pre-push.

#### Scenario: Bad commit message
- GIVEN message `fixed stuff`
- WHEN committing
- THEN commitlint rejects it

#### Scenario: Hooks installed
- GIVEN `pnpm install`
- WHEN postinstall completes
- THEN lefthook hooks exist in `.git/hooks`

### Requirement: CI and automation

Workflows adapted from devbar (CI, CodeQL, Dependabot auto-merge/recreate, cache delete, required-QA auto-merge, release-impact label, version bump, auto-release) and `dependabot.yml` MUST exist, keep the original secret/PAT names, and produce no Electron artifacts.

#### Scenario: Secret contract
- GIVEN the workflows
- WHEN secret references are listed
- THEN names equal those in devbar

#### Scenario: Release
- GIVEN a release workflow
- WHEN inspected
- THEN it creates a GitHub release with generated notes and no binaries

### Requirement: Agent documentation

`AGENTS.md` MUST state: SDD always, no budget, single PR, autonomous, strict TDD, clean code/SOLID, RAM-sized parallel worktrees merged then removed, never push. `CLAUDE.md` MUST import it.

#### Scenario: Import
- GIVEN `CLAUDE.md`
- WHEN read
- THEN it contains `@AGENTS.md`

### Requirement: Gitignore and local-only

`recordings/` MUST be gitignored; no workflow or script MUST push.

#### Scenario: Ignored
- GIVEN `recordings/x/script.mjs` exists
- WHEN `git status` runs
- THEN it is not listed
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
