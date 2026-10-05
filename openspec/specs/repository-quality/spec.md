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
(Previously: only the sentence above; CI gate layout was unspecified.)

The CI workflow MUST also satisfy CI gate parity:

- A `Quality` job MUST run on Linux exactly once per PR revision and MUST contain one named step per static gate: Typecheck, Authored source policy, ESLint, Prettier, knip, dependency-cruiser, Audit, Commitlint — commits.
- The `Test — linux`, `Test — macos` and `Test — win` matrix MUST run only dependency install, Chromium install, tests with coverage and build. It MUST NOT run any static gate.
- `Quality` and the `Test` matrix MUST start in parallel (neither `needs` the other).
- The separate `pr-title` workflow (`Commitlint — PR title`) MUST always check the PR title with the repository commitlint config. The `Commitlint — commits` step in `Quality` MUST check the PR commits (`base..head`) only when the PR author is not a bot (author type `Bot`).
- A PR title edit MUST re-check only the title and MUST NOT re-run the OS matrix; the title check MUST run on every `edited` event, because a skipped run on the same head SHA could hide an earlier failure.
- The PR title MUST NOT be interpolated into shell; it MUST be passed through an environment variable.
- Existing `permissions` (`read-all` / `contents: read`), repository guard, draft guard, concurrency and pinned action SHAs MUST be preserved. Full-history checkout MUST be used only where the commit range is needed.

#### Scenario: Secret contract
- GIVEN the workflows
- WHEN secret references are listed
- THEN names equal those in devbar

#### Scenario: Release
- GIVEN a release workflow
- WHEN inspected
- THEN it creates a GitHub release with generated notes and no binaries

#### Scenario: Quality job layout
- GIVEN the parsed CI workflow YAML
- WHEN jobs are listed
- THEN a `Quality` job exists with `runs-on` Linux and a `Test — <os>` matrix job exists with linux, macos and win entries

#### Scenario: One named step per static gate
- GIVEN the `Quality` job steps
- WHEN step names are listed
- THEN Typecheck, Authored source policy, ESLint, Prettier, knip, dependency-cruiser, Audit and Commitlint — commits each appear as exactly one separate step

#### Scenario: No repeated static gate
- GIVEN the `Test` matrix job steps
- WHEN their `run` commands are inspected
- THEN none runs typecheck, lint, format:check, deadcode, deps:check, audit or commitlint, and the only gate-like steps are install, Chromium install, `pnpm test:coverage` and `pnpm build`

#### Scenario: Jobs run in parallel
- GIVEN the parsed CI workflow
- WHEN `needs` is read on `Quality` and on the test job
- THEN neither declares `needs` on the other

#### Scenario: Title always checked
- GIVEN a PR opened by a human or a bot
- WHEN the `pr-title` workflow runs
- THEN the PR title is passed to `commitlint` and an invalid title fails the check

#### Scenario: Commits checked for human authors only
- GIVEN the `Commitlint — commits` step and the `pr-title` workflow
- WHEN its conditions are inspected
- THEN the `base..head` commit lint is guarded so it runs only when the PR author type is not `Bot`, while the title lint has no such guard

#### Scenario: Dependabot PR
- GIVEN a Dependabot PR with a conventional title and long commit body lines
- WHEN CI runs
- THEN `Commitlint — commits` is skipped and `Commitlint — PR title` passes because the title is valid

#### Scenario: Title edit
- GIVEN a PR whose title was edited
- WHEN the `edited` event triggers workflows
- THEN only the title check runs, the `Test` matrix does not run, and the check turns green for a valid title

#### Scenario: Non-title edit
- GIVEN an `edited` event where the title did not change (for example body only)
- WHEN workflows are evaluated
- THEN the title check still runs and passes for a valid title, so no skipped run can hide an earlier failure on the same head SHA

#### Scenario: Title not interpolated
- GIVEN every `run` script in the workflows
- WHEN scanned for `${{ github.event.pull_request.title }}`
- THEN no occurrence exists inside a `run` script; the title is only read through an `env` entry

#### Scenario: Full history only where needed
- GIVEN the checkout steps
- WHEN `fetch-depth` is read
- THEN `0` appears only in the `Quality` job

#### Scenario: Guards and permissions preserved
- GIVEN the parsed workflows
- WHEN permissions, repository guard, draft guard, concurrency and action refs are inspected
- THEN permissions are `read-all` / `contents: read`, guards and concurrency remain, and every `uses` is pinned to a commit SHA

#### Scenario: Renamed checks break nothing
- GIVEN the `main` ruleset has no required status checks
- WHEN `CI — <os>` is replaced by `Quality` and `Test — <os>`
- THEN no merge is blocked; the owner MAY add `Quality` and `Test — <os>` as required checks after merge

#### Scenario: Any base branch and restart on push
- GIVEN `ci.yml` and `pr-title.workflow.yml`
- WHEN their `pull_request` triggers and concurrency are inspected
- THEN neither has a `branches` or `branches-ignore` filter, both include the `synchronize` type (the title workflow also `edited`), and each concurrency group is keyed per PR or branch with `cancel-in-progress: true`, so a new push cancels the stale run and starts a fresh one

#### Scenario: Version untouched
- GIVEN the change diff
- WHEN `package.json` is compared with main
- THEN `version` is unchanged
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
