# Apply progress: npm Trusted Publishing through GitHub OIDC

## Reconciliation

The existing publication change and repository-quality spec required a
long-lived `NPM_AUTH_TOKEN`. The configured npm Trusted Publisher intentionally
has no token secret. The first real attempt failed at `npm publish` with
`ENEEDAUTH`; its publish job used Node 22.13.0, below the documented OIDC
runtime minimum. This change updates the contract and the old publication
artifacts rather than introducing a token.

## Progress

- [x] Branch created from current `origin/main`: `fix/npm-trusted-publishing-oidc`.
- [x] WP1 RED: focused workflow test run failed on the old token contract,
  Node 22.13.0 and `--provenance` expectations.
- [x] WP2: publish job now uses Node 22.14.0 and npm CLI 11.5.1, with OIDC
  permission in the existing protected `admin` environment and no npm token.
- [x] WP2: reconciled the active repository-quality spec and original
  npm-publication spec/design/tasks/setup notes.
- [x] WP3: focused workflow tests passed, static quality checks passed, and the
  package version is unchanged.
- [ ] Commit, push and PR.

## Verification

- RED: `pnpm exec vitest run tests/unit/repository/workflows.test.ts -t 'workflow secret contract|publishes a validated|validates and publishes|does not require a long-lived npm token'`
  failed as expected before the workflow update.
- GREEN: `pnpm exec vitest run tests/unit/repository/workflows.test.ts` passed:
  69 tests.
- `pnpm quality` passed typecheck, strict lint, format, deadcode, and
  dependency checks, but the full test step failed on 9 Windows-host issues:
  timing-sensitive replay/runtime tests, symlink creation `EPERM`, and a
  `pnpm` replay-alias timeout. These tests do not exercise the workflow change.
- `pnpm build` passed.
- `pnpm test:coverage` ran 2,311 tests successfully and skipped 20; 13 failed
  on Windows timing, symlink, and temporary-directory cleanup `EPERM` issues.
  The changed workflow test passed in the focused run.
- Prettier check passed; the package version remains `0.1.3` (unchanged).
- `python -c "import yaml; yaml.safe_load(open('.github/workflows/publish-npm.workflow.yml'))"`
  passed; `git diff --check` passed.
- No real publish was attempted by this change. After merge, dispatch the
  workflow with `dry_run=false`; ensure the npm Trusted Publisher matches
  repository `juanjoGonDev/browser-recorder`, workflow
  `publish-npm.workflow.yml`, and environment `admin`. The first successful
  OIDC publish validates the pending npm configuration.
