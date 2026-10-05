# Delta for repository-quality

## ADDED Requirements

### Requirement: Dependency hygiene

All dependencies MUST use exact versions; Playwright MUST be the only runtime dependency; `pnpm audit` MUST report zero findings; `.npmrc` MUST enable save-exact, minimum-release-age, engine-strict and frozen lockfile.

#### Scenario: Audit
- GIVEN a fresh install
- WHEN `pnpm audit` runs
- THEN it exits 0 with no vulnerabilities

#### Scenario: Range detected
- GIVEN a dependency declared as `^1.0.0`
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
