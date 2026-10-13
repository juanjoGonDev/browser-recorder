# Tasks: npm publication and package verification

## Delivery Constraints

| Field | Value |
|-------|-------|
| Review-size budget | None; keep the complete change in one PR |
| Delivery strategy | Single PR; work units do not imply separate PRs |
| Decision needed before apply | No |

## Suggested Work Units

| Unit | Goal | Focused verification | Runtime harness | Rollback boundary |
|---|---|---|---|---|
| WP1 | Lock package metadata, workflow, and recovery-command contracts with failing tests | Focused repository/environment/CLI tests | N/A: assertions cover workflow and metadata contracts | New and updated tests only |
| WP2 | Make the package publishable, safe to install, documented, and versioned | Package metadata, hook lifecycle, and recovery-command tests | `pnpm install --frozen-lockfile` + external tarball install | `package.json`, shared install-command module, affected docs/tests |
| WP3 | Add clean package CI and protected manual npm publication | Workflow/release-workflow tests | External-root tarball install and CLI version invocation | `.github/workflows/ci.yml`, new publish workflow, workflow tests |
| WP4 | Reconcile active repository-quality spec and record apply evidence | `pnpm quality` plus release validation | Same external-root install above | OpenSpec artifacts only |

## Tasks

### WP1 — RED contracts

- [x] Add package tests requiring public metadata, runtime-only files,
  `prepare` (not `postinstall`), and Node-only consumer engines.
- [x] Add workflow tests for a separate clean-install job, tarball inspection,
  safe manual publish defaults, owner/default-branch guard, protected token use,
  duplicate-version check, and expected workflow inventory.
- [x] Add tests for shared Patchright recovery commands and their exact manifest
  dependency version.
- [x] Run the focused tests and record that they fail for the missing package
  and workflow contracts.

### WP2 — Package surface and local install behavior

- [x] Remove `private`, add the `dist` file allowlist, and remove pnpm from the
  published `engines` contract while retaining the source `packageManager`.
- [x] Move hook installation from `postinstall` to `prepare`; keep its existing
  CI/production/no-Git guards and update lifecycle tests.
- [x] Add a shared Patchright command constant pinned to the manifest's exact
  version; update the TUI, replay, Linux guidance, and their tests.
- [x] Document global npm installation and distinguish it from pnpm source
  development; update manual recovery commands in README and CONTRIBUTING.
- [x] Bump `package.json` from `0.1.1` to `0.1.2` and reconcile the active
  repository-quality version rule.

### WP3 — CI package verification and npm workflow

- [x] Add an Ubuntu package job that builds and packs to `RUNNER_TEMP`, checks
  required/excluded tarball paths, installs globally into a fresh prefix
  outside `GITHUB_WORKSPACE` with scripts enabled, and verifies `--version`.
- [x] Add a workflow-dispatch publish workflow with a default-true dry run,
  repository-owner/default-branch guard, `admin` environment, npm auth only on
  the publish step, duplicate-version rejection, and public publish command.
- [x] Keep workflow actions SHA-pinned and use Node 22.13 for package smoke
  verification.
- [x] Run focused workflow and package tests.

### WP4 — Verify and record

- [x] Verify local hook installation still works after a normal pnpm install.
- [x] Run `pnpm quality`, `pnpm test:coverage`, `pnpm build`, and release-policy
  regression tests.
- [x] Run the same packed-tarball external-root installation used by CI.
- [x] Record exact commands/results, known npm environment setup
  (`admin`/`NPM_AUTH_TOKEN`), and rollback boundary in apply progress.
