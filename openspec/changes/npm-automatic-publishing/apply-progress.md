# Apply progress: automatic npm publication

## Decisions

- Reuse the existing `publish-npm.workflow.yml` with `workflow_dispatch`, rather
  than `workflow_call`, so the configured npm Trusted Publisher continues to
  match the workflow that receives the OIDC identity.
- Use the built-in GitHub token for the dispatch. Verify the referenced
  successful `release.yml` run before trusting release metadata or building
  the npm tarball.
- Workflow-only change; keep the published package version unchanged.

## Progress

- [x] Created `feat/automatic-npm-publishing` from current `origin/main`.
- [x] WP1: added RED workflow contract tests. The three new tests failed
  against the previous manual-only workflows.
- [x] WP2: `release.yml` now dispatches npm publication after release
  verification; the target validates the source run, exact tag, package
  version, and release state before building. Reruns recover a prior validated
  release, and an npm duplicate is a no-op.
- [x] WP3: focused workflow tests, formatting, YAML parsing, embedded bash
  syntax, actionlint, and build pass. Full test and coverage suites retain
  three unrelated Windows failures (one timing-sensitive dialog/popup replay
  test and two symlink tests denied with `EPERM`).

## Verification

- `pnpm exec vitest run tests/unit/repository/workflows.test.ts`: 73 passed.
- `pnpm exec prettier --check` for changed workflow/test/spec files: passed.
- PyYAML parsed both changed workflow files; `bash -n` passed for every
  embedded shell block; `actionlint` v1.7.7 passed for both workflows.
- The dialog/popup test that failed under the full-suite load passed when run
  alone; the two symlink tests remain blocked by Windows `EPERM`.
- `pnpm quality`: typecheck, strict lint, format, deadcode and dependency
  checks passed; tests had 2,325 passed, 20 skipped and 3 unrelated failures:
  `generated-script.test.ts` dialog/popup exit code, plus `EPERM` symlink
  failures in `release-impact-policy.test.ts` and `script-runtime.test.ts`.
- `pnpm test:coverage`: same 3 unrelated Windows failures (2,325 passed,
  20 skipped); the changed workflow tests passed.
- `pnpm build`: passed.
- `package.json` remains at `0.1.3`; no real npm publish was attempted.
