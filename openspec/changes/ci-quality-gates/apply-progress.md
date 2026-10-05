# Apply progress: ci-quality-gates

Mode: Strict TDD. All tasks complete (1.1-1.7, 2.1-2.4, 3.1-3.4, 4.1-4.2, R.1-R.4). Changes are committed.

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 1.1-1.7 | workflows.test.ts: 20 new/changed assertions failed on the old ci.yml and missing pr-title file (a first run failed at collection because of a top-level read; fixed by reading lazily so each test fails on its own) | 2.1-2.3: 55/55 pass; actionlint clean on both files | 3.1 helpers `ciJobs`, `stepsOf` extracted; tests green |
| 2.1-2.4 | n/a (driven by 1.x) | `pnpm vitest run tests/unit/repository/workflows.test.ts` 50/50 then 55/55 | 3.3 comments/ordering tidied, green |
| 3.2 docs | n/a (CONTRIBUTING section, no behavior) | n/a | n/a |
| 3.4 triggers | Honest note: config already satisfied it, so the new tests passed on first run. Mutation proof: adding `branches: [main]` to ci.yml made 'runs for pull requests targeting any branch' fail; reverted | 55/55 | none |
| 4.1-4.2 | n/a | pnpm quality, test:coverage (2239 passed, 6 skipped), build, audit all green; package.json diff vs main empty | n/a |
| R.1, R.3 spec/design | n/a (spec wording, no behavior; spec now matches the already-tested 'always runs' behavior) | n/a | n/a |
| R.2 guards | Honest note: config already satisfied the 3 new tests (draft guard, read-all + contents: read, no bot guard in pr-title), so they passed on first run (safety net: 55/55 before). Mutation proof: draft == true in ci.yml, write-all and a Bot guard in pr-title made exactly those 3 tests fail; reverted | 58/58 | none |
| R.4 redundant test | n/a (removal; 'keeps coverage, build and both Chromium installs' still asserts the test block) | 58/58 | whole-file test removed |

Note: the 'does not repeat X' tests passed vacuously in RED (no `test:` job existed yet) and became meaningful at GREEN.

## Work Unit Evidence

- Focused: `pnpm vitest run tests/unit/repository/workflows.test.ts`: 55 passed.
- Runtime harness: N/A, workflows only run on GitHub; actionlint clean, commitlint simulations pass.
- Rollback: revert the squash commit.
