validator unavailable (gentle-ai 3.7.0); persisted by orchestrator override

```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: git:f02244e
verdict: fail
blockers: 1
critical_findings: 1
requirements: 0/1
scenarios: 14/17
test_command: pnpm test:coverage
test_exit_code: 0
test_output_hash: sha256:a5c26f9e5330c8b6209b291f1804de6efe0c95e6cf1bcf5fd227cd73c8229f77
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:ba41b571ad7aeb5a053a3afd1ac7fbd95c43f8708ac2e384f12e4ff2a4f957b8
```

## Verification Report

**Change**: ci-quality-gates
**Version**: delta for `repository-quality` (MODIFIED "CI and automation")
**Mode**: Strict TDD
**Candidate**: branch `ci/split-quality-gates` at `f02244e` (clean tree)

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 17 |
| Tasks complete | 17 |
| Tasks incomplete | 0 |

### Build & Tests Execution
| Command | Exit | Evidence |
|---|---|---|
| `pnpm vitest run tests/unit/repository/workflows.test.ts` | 0 | 55 passed |
| `pnpm quality` (typecheck, lint:strict, format:check, deadcode, deps:check, test) | 0 | 2244 passed, 6 skipped; sha256:9eeac208... |
| `pnpm test:coverage` | 0 | 192 files passed, 1 skipped; 2244 passed, 6 skipped; per-file thresholds met |
| `pnpm build` | 0 | sha256:ba41b571... |
| `pnpm audit --audit-level=moderate` | 0 | No known vulnerabilities found |
| `actionlint -no-color ci.yml pr-title.workflow.yml` (v1.7.7, shellcheck present) | 0 | clean |
| `pnpm exec commitlint --from origin/main --to HEAD --verbose` | 0 | 5 commits, 0 problems |
| `printf '%s\n' 'Bad title here' \| pnpm exec commitlint --verbose` | 1 | type-empty, subject-empty (invalid title fails) |
| `printf '%s\n' "$PR_TITLE" \| pnpm exec commitlint` (valid title) | 0 | passes |
| `printf 'build(deps): bump foo\n\n<150-char line>' \| pnpm exec commitlint` | 1 | body line limit fails: justifies the bot commit skip |
| `gh api .../rulesets/24519855` | 0 | rules: deletion, non_fast_forward, required_linear_history, pull_request, code_scanning, code_quality, copilot_code_review; no `required_status_checks` |
| `git diff main -- package.json` | 0 | empty (version 0.1.0 unchanged) |

**Coverage**: no `src/` or `scripts/` file changed; changed-file coverage not applicable. Global per-file thresholds pass.

### Owner Requirements
| Requirement | Result | Evidence |
|---|---|---|
| Static gates once in `Quality`, one step each | Met | ci.yml L50-98: Typecheck, Authored source policy, ESLint, Prettier, knip, dependency-cruiser, Audit, Commitlint — commits |
| `Test — linux/macos/win` only OS-dependent work | Met | ci.yml L100-163: checkout, pnpm, node, Playwright cache, install, Chromium, `pnpm test:coverage`, `pnpm build` |
| Every lefthook gate also in CI | Met | prettier/format-check -> Prettier; eslint -> ESLint; typecheck -> Typecheck; build -> Test Build; commitlint -> Commitlint commits + PR title; test-coverage -> Tests; deadcode -> knip; deps-check -> dependency-cruiser; audit -> Audit |
| CI for PRs to any branch, restart on push | Met | no `branches` filter; `synchronize` in types; ci group `CI-<head_ref>` and `pr-title-<number>`, both `cancel-in-progress: true` |
| PR title checked, re-checked on edit | Met | pr-title.workflow.yml types `[opened, edited, reopened, synchronize]` |
| Untrusted title/SHAs only via env | Met | `PR_TITLE`, `BASE_SHA`, `HEAD_SHA` set in `env`; `run` uses quoted `"$VAR"` only; no `${{ }}` inside any `run` of either file |

### Spec Compliance Matrix
| Scenario | Test / evidence | Result |
|---|---|---|
| Secret contract | `workflow secret contract > references exactly the secret names devbar uses` | COMPLIANT |
| Release | `release.yml > creates a GitHub release ...`, `verifies ... empty asset set` | COMPLIANT |
| Quality job layout | `ci.yml quality job > runs once on ubuntu ...`; `ci.yml > runs on ubuntu, macOS and Windows` | COMPLIANT |
| One named step per static gate | `ci.yml quality job > has one named step %s running %s` (8 cases) | COMPLIANT |
| No repeated static gate | `ci.yml test job > does not repeat %s` (7 cases) + `keeps coverage, build and both Chromium installs` | COMPLIANT |
| Jobs run in parallel | `ci.yml test job > runs jobs in parallel and ignores title edits` | COMPLIANT |
| Title always checked | `pr-title.workflow.yml > reads the title only through an env entry ...` + local simulation (invalid exit 1, valid exit 0) | COMPLIANT |
| Commits checked for human authors only | `ci.yml quality job > lints commits for human authors only ...` | COMPLIANT |
| Dependabot PR | Bot guard test + local simulation (long body fails, title passes); no test asserts the title job has no Bot guard | PARTIAL |
| Title edit | `re-checks on every title-relevant event` + ci.yml has no `edited` | COMPLIANT |
| Non-title edit | `always runs, whether or not the title changed` asserts the OPPOSITE of the scenario | FAILING (spec contradiction) |
| Title not interpolated | `reads the title only through an env entry ...` (exactly one occurrence) | COMPLIANT |
| Full history only where needed | `runs once on ubuntu with full history`, `uses the default checkout depth` | COMPLIANT (pr-title has no fetch-depth, not asserted) |
| Guards and permissions preserved | repository guard `it.each`, `workflow action pinning`, pr-title `contents: read` | PARTIAL: draft guard and `permissions: read-all` not asserted (present in source) |
| Renamed checks break nothing | `gh api` ruleset: no required status checks | COMPLIANT (runtime command, no unit test) |
| Any base branch and restart on push | `pull request triggers` suite (5 cases) | COMPLIANT |
| Version untouched | `git diff main -- package.json` empty | COMPLIANT (runtime command, no unit test) |

**Compliance summary**: 14/17 compliant, 2 partial, 1 failing.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|---|---|---|
| CI and automation (CI gate parity) | Implemented except one clause | "A PR title edit ... fires only when the title changed" is not implemented: the title workflow runs on every `edited` event by design |

### Coherence (Design)
| Decision | Followed? | Notes |
|---|---|---|
| Separate `pr-title.workflow.yml` with own concurrency | Yes | |
| Title linted only in pr-title; quality lints commits | Yes | Spec step name "Commitlint" implemented as "Commitlint — commits" |
| `edited` always runs (no `changes.title`) | Yes | Deliberate deviation from spec and proposal assumption 3; spec delta not amended |
| Event types `[opened, edited, reopened, synchronize]` | Yes | |
| Every gate runs (`!cancelled() && steps.install.outcome == 'success'`) | Yes | |
| Bot detection by `user.type != 'Bot'` | Yes | |
| Commit range with quoted env SHAs, `fetch-depth: 0` only in quality | Yes | |
| `printf` piped to commitlint | Yes | `-n` title correctly reaches commitlint (exit 1, not swallowed) |
| CONTRIBUTING "Continuous integration" section after "Git hooks" | Yes | |

### TDD Compliance
| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | Yes | apply-progress.md table |
| All tasks have tests | Yes | behavior tasks covered by workflows.test.ts; docs task n/a |
| RED confirmed (tests exist) | Yes | test file exists, 55 tests |
| GREEN confirmed (tests pass) | Yes | 55/55 pass now |
| Triangulation adequate | Warning | table has no TRIANGULATE column; it.each cases exist (8 gates, 7 forbidden commands, 3 trigger cases) |
| Safety Net for modified files | Warning | table has no SAFETY NET column for the modified workflows.test.ts |

Honest notes in apply-progress accepted: 3.4 passed on first run (mutation proof recorded); "does not repeat" tests were vacuous in RED and are now guarded by the companion non-empty test.

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|---|---|---|---|
| Unit (static workflow text) | 55 | 1 | Vitest |
| Integration | 0 | 0 | n/a |
| E2E | 0 | 0 | GitHub Actions runtime not exercised locally |

### Assertion Quality
**Assertion quality**: no tautologies, no ghost loops (pinning test guards `uses.length > 0`), no mocks. `ci.yml > runs coverage and a build on every platform` is a whole-file `toContain` and is now redundant with the test-block assertion (informational).

### Quality Metrics
**Linter**: pass (`pnpm lint:strict`). **Type Checker**: pass (`pnpm typecheck`). **actionlint**: pass.

### Issues Found
**CRITICAL**:
1. Spec/implementation contradiction on title edits. The spec delta requires "it fires only when the title changed", and the "Non-title edit" scenario says "the title check does not run". `pr-title.workflow.yml` runs on every `edited` event, and `workflows.test.ts` asserts that (`not.toContain('changes.title')`). The design records this as a deliberate deviation for a sound reason: a skipped check on the same SHA can mask an earlier failure. The spec was never amended, and design marks owner confirmation as open. Fix: once the owner confirms, amend the spec delta (requirement bullet plus the "Non-title edit" scenario) so it says the title check runs on every `edited` event. No code change is needed.

**WARNING**:
1. "Guards and permissions preserved" is only partly tested: the ci.yml draft guard (`pull_request.draft == false`) and `permissions: read-all` in both files have no assertions, although they are present.
2. Dependabot scenario: no test asserts that the pr-title job lacks a Bot guard ("title lint has no such guard").
3. The spec names the step "Commitlint"; the implementation names it "Commitlint — commits" and moves title linting to a separate workflow. Matches the design, but the spec wording is now out of date.
4. apply-progress TDD table omits the TRIANGULATE and SAFETY NET columns.
5. Engram `sdd/ci-quality-gates/apply-progress` says "Changes are uncommitted"; they are committed (`edc15c1`, `cf6722a`, `f02244e`).

**SUGGESTION**:
1. Add assertions for `permissions: read-all` and the draft guard to lock in the preserved guards.
2. Remove the redundant whole-file `runs coverage and a build on every platform` test, or scope it to the test block.
3. In the PR description, list the new check names (`Quality`, `Test — linux|macos|win`, `Commitlint — PR title`) so the owner can add them to the ruleset after merge.

### Verdict
FAIL
All gates, actionlint and local commitlint simulations pass, and every owner requirement is met. One spec scenario (Non-title edit) contradicts the implemented and tested behavior. The fix is a spec-delta amendment, not code.
