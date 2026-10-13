# Apply progress: npm publication and package verification

## Evidence before implementation

- Fastypest provides a manually dispatched `publish-npm.workflow.yml` with a
  dry-run switch and a packed-install check. Its Yarn/Node 18 configuration is
  not applicable here; this project uses pnpm and requires Node 22.13+.
- This repo already has cross-platform CI, a build, a GitHub Release workflow,
  and a release-impact policy. The minimal adaptation is a separate Ubuntu
  package smoke job plus an explicit manual npm publish workflow, not another
  copy of Fastypest's database matrix or release automation.
- `npm pack --dry-run` showed the current package includes source, tests,
  workflows, OpenSpec, and development tooling because there is no `files`
  allowlist.
- A real tarball install from a fresh Windows temp root failed in the current
  `postinstall`: `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` for
  `node_modules/browser-recorder/scripts/install-hooks.ts` on Node 24.14.0.
  This confirms the clean external-root installation is an essential gate, not
  a hypothetical check.
- `patchright@1.63.0` has no install lifecycle script. Its browser is installed
  at first run, so the package smoke command can stay browser-free by invoking
  only `--version`.

## Frozen-contract reconciliation

The active repository-quality spec had a workflow-change “version untouched”
scenario. The new design changes the published package surface and must follow
the repo's release-impact rule, so the package version advances to `0.1.2`.
The spec now preserves that intent for release-neutral workflow-only changes.
The separate replay-alias version
scenario remains applicable only to that alias behavior. The replay-alias
requirement is narrowed to alias-only changes so it does not forbid the
independent npm publication version bump.

## Progress

- [x] Branch created: `feat/npm-publishing-workflows`.
- [x] Confirmed the `browser-recorder` npm package name currently returns 404
  from the public registry.
- [x] WP1 RED contracts: the initial focused run failed on the expected missing
  public package metadata, shared recovery-command module, and package/publish
  workflow contracts.
- [x] WP2 package surface and consumer guidance.
- [x] WP3 workflows.
- [x] WP4 verification and final evidence.

## Verification

- `pnpm install --frozen-lockfile` passed; `prepare` ran and synchronized the
  local Git hooks. The lockfile remained in sync.
- Focused workflow, metadata, Patchright-command and TUI tests passed; the
  final workflow test file passed all 69 tests.
- `pnpm typecheck`, `pnpm lint:strict`, `pnpm format:check`, `pnpm deadcode` and
  `pnpm deps:check` passed as part of `pnpm quality`.
- `pnpm build` passed.
- The real package smoke script passed on Windows Node 24.14.0 via Git Bash:
  `RUNNER_TEMP=/c/Users/juanj/AppData/Local/Temp`
  `GITHUB_WORKSPACE=/d/projects/browser-recorder bash scripts/verify-npm-package.sh`.
  It packed 394 files (189.2 kB compressed), passed `npm publish --dry-run`,
  installed with lifecycle scripts enabled into the distinct external root
  `C:\Users\juanj\AppData\Local\Temp\browser-recorder-consumer.8KFND8`, and
  the installed `browser-recorder --version` reported `0.1.2`.
- The smoke script supports both POSIX npm's `bin/browser-recorder` and
  Windows npm's `browser-recorder.cmd` locations; the Windows path was exercised
  by that same run.
- `pnpm pack --dry-run --json` confirmed the exact package surface is `dist/`
  plus npm's automatic `package.json`, `README.md`, and `LICENSE`. The tarball
  contains no source, tests, OpenSpec, workflows, scripts, configs, recordings,
  or lockfiles. Its `.js.map` files have no embedded `sourcesContent`. The smoke
  script now fails if any path falls outside that allowlist.
- `pnpm quality` reached tests and failed on unrelated host/test issues:
  a timed generated-script replay, two Windows directory-symlink tests
  (`EPERM`), and managed-profile test cleanup (`EPERM`). Static gates all
  passed.
- `pnpm test:coverage` ran 2,314 tests successfully and skipped 20; four failed:
  two timing-sensitive generated-script replays and the same two Windows
  directory-symlink tests (`EPERM`).
- Release-policy regression tests were run: 68 passed and one failed because
  Windows denied a test directory symlink (`EPERM`).
- Checked `npm view browser-recorder name version --json` from outside the
  checkout on 2026-10-13; the registry returned E404. No npm publication was
  attempted.
- Checked npm registry authentication with `npm whoami` outside the checkout;
  it returned exit 1, so no usable local npm credential is configured. The
  command's output was suppressed and no token was read or exposed.

## Publication setup

For a real dispatch, configure `NPM_AUTH_TOKEN` as a secret in the existing
GitHub `admin` environment. The `Publish to npm` workflow defaults to dry-run;
only the owner can run it on the default branch, and a real publish requires
changing `dry_run` to `false`. No token is used by validation or package
installation.
