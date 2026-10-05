# Tasks: CI quality gates

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 250-350 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Split CI, add title workflow, docs | PR 1 | `pnpm vitest run tests/unit/repository/workflows.test.ts` | N/A: workflows only run on GitHub; string tests plus final `pnpm test` | Revert squash commit |

## Phase 1: RED (tests first)

- [x] 1.1 `tests/unit/repository/workflows.test.ts`: add `pr-title.workflow.yml` to the workflow-set and repository-guard `it.each` lists (Guards and permissions preserved). Expect failure.
- [x] 1.2 Same file: split ci.yml at `/^  test:$/m`; assert `quality` is ubuntu, `fetch-depth: 0`, no matrix, and the eight [step name, command] gates (Quality job layout, One named step per static gate). RED.
- [x] 1.3 Same file: assert the commits step has the `user.type != 'Bot'` guard and `--from "$BASE_SHA" --to "$HEAD_SHA"` (Commits checked for human authors only, Dependabot PR). RED.
- [x] 1.4 Same file: assert `test` block keeps `test:coverage`, `build`, both Chromium installs, has none of typecheck/lint:strict/format:check/deadcode/deps:check/audit/commitlint, and no `fetch-depth` (No repeated static gate, Full history only where needed). RED.
- [x] 1.5 Same file: assert ci.yml has no `needs:`, `edited` or `pull_request.title` (Jobs run in parallel). Replace "audits on Linux only" with "audits once in quality". RED.
- [x] 1.6 Same file: pr-title assertions: exact `types` line `[opened, edited, reopened, synchronize]`, concurrency `pr-title-`, `contents: read`, no `changes.title`, `pull_request.title` only once on the `PR_TITLE:` env line, `printf` pipe (Title always checked, Title edit, Non-title edit deviation, Title not interpolated). RED.
- [x] 1.7 Same file: every `uses:` in both files matches `@[0-9a-f]{40} # v`. Confirm `pnpm vitest run tests/unit/repository/workflows.test.ts` fails only on new assertions.

## Phase 2: GREEN (workflows)

- [x] 2.1 `.github/workflows/ci.yml`: add `quality` job (name Quality, 15 min, guard, `contents: read`, install `id: install`, eight gate steps with `if: ${{ !cancelled() && steps.install.outcome == 'success' }}`, Commitlint commits step with Bot guard and env SHAs). Passes 1.2, 1.3, 1.5.
- [x] 2.2 Same file: reduce `ci` job to `test` (name `Test — ${{ matrix.os }}`): install, Chromium, Tests with coverage comment, Build; drop static gates and audit. Passes 1.4, 1.7.
- [x] 2.3 Create `.github/workflows/pr-title.workflow.yml` per design (env `PR_TITLE`, `printf '%s\n' "$PR_TITLE" | pnpm exec commitlint --verbose`, own concurrency, pinned SHAs reused from ci.yml). Passes 1.1, 1.6.
- [x] 2.4 Run `pnpm vitest run tests/unit/repository/workflows.test.ts`: all green.

## Phase 3: REFACTOR and docs

- [x] 3.1 `tests/unit/repository/workflows.test.ts`: dedupe helpers (block extraction, step lookup); keep it string/regex style.
- [x] 3.2 `CONTRIBUTING.md`: add "Continuous integration" section after "Git hooks" naming Quality, Test matrix, `Commitlint — PR title`, bot commit skip (Renamed checks break nothing).
- [x] 3.3 Tidy workflow YAML comments/ordering; confirm tests stay green.

## Phase 3b: Triggers (owner addition)

- [x] 3.4 `workflows.test.ts`: assert both workflows have `pull_request` without `branches`/`branches-ignore`, `synchronize` (pr-title also `edited`) and per-PR concurrency with `cancel-in-progress: true`. Existing workflows already satisfy it; guard verified by mutation.

## Phase 4: Final gate

- [x] 4.1 Run `pnpm test`, `pnpm typecheck`, `pnpm lint:strict`, `pnpm format:check`, `pnpm deadcode`, `pnpm deps:check`; all pass.
- [x] 4.2 Verify `package.json` `version` unchanged via `git diff main -- package.json` (Version untouched).

## Phase R: Verify remediation (R)

- [x] R.1 (CRITICAL) `specs/repository-quality/spec.md`: title check runs on every `edited` event (requirement line and "Non-title edit" scenario); remove the open owner-confirmation note in `design.md`.
- [x] R.2 (WARNING) `workflows.test.ts`: assert the ci.yml draft guard, `permissions: read-all` plus job-level `contents: read` in both files, and no bot guard in pr-title. Guard verified by mutation.
- [x] R.3 (WARNING) Spec wording: "Commitlint — commits" in `Quality`; title checking attributed to the separate `pr-title` workflow (`Commitlint — PR title`).
- [x] R.4 (SUGGESTION) Remove the redundant whole-file "runs coverage and a build on every platform" test (the test-job block assertion covers it).
