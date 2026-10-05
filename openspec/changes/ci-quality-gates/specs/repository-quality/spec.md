# Delta for repository-quality

## MODIFIED Requirements

### Requirement: CI and automation

Workflows adapted from devbar (CI, CodeQL, Dependabot auto-merge/recreate, cache delete, required-QA auto-merge, release-impact label, version bump, auto-release) and `dependabot.yml` MUST exist, keep the original secret/PAT names, and produce no Electron artifacts.
(Previously: only the sentence above; CI gate layout was unspecified.)

The CI workflow MUST also satisfy CI gate parity:

- A `Quality` job MUST run on Linux exactly once per PR revision and MUST contain one named step per static gate: Typecheck, Authored source policy, ESLint, Prettier, knip, dependency-cruiser, Audit, Commitlint.
- The `Test — linux`, `Test — macos` and `Test — win` matrix MUST run only dependency install, Chromium install, tests with coverage and build. It MUST NOT run any static gate.
- `Quality` and the `Test` matrix MUST start in parallel (neither `needs` the other).
- Commitlint MUST always check the PR title with the repository commitlint config. It MUST check the PR commits (`base..head`) only when the PR author is not a bot (author type `Bot`).
- A PR title edit MUST re-check only the title and MUST NOT re-run the OS matrix; it fires only when the title changed.
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
- THEN Typecheck, Authored source policy, ESLint, Prettier, knip, dependency-cruiser, Audit and Commitlint each appear as exactly one separate step

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
- WHEN the Commitlint step or title workflow runs
- THEN the PR title is passed to `commitlint` and an invalid title fails the check

#### Scenario: Commits checked for human authors only
- GIVEN the Commitlint step
- WHEN its conditions are inspected
- THEN the `base..head` commit lint is guarded so it runs only when the PR author type is not `Bot`, while the title lint has no such guard

#### Scenario: Dependabot PR
- GIVEN a Dependabot PR with a conventional title and long commit body lines
- WHEN CI runs
- THEN Commitlint passes because commits are skipped and the title is valid

#### Scenario: Title edit
- GIVEN a PR whose title was edited
- WHEN the `edited` event triggers workflows
- THEN only the title check runs, the `Test` matrix does not run, and the check turns green for a valid title

#### Scenario: Non-title edit
- GIVEN an `edited` event where the title did not change (for example body only)
- WHEN workflows are evaluated
- THEN the title check does not run

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

#### Scenario: Version untouched
- GIVEN the change diff
- WHEN `package.json` is compared with main
- THEN `version` is unchanged
