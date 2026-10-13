# Proposal: npm publication and package verification

## Intent

Prepare `browser-recorder` for a first npm release and make the packed package
prove it can be installed and launched outside the repository checkout. Adapt
the relevant Fastypest publish/pack flow to this repository's pnpm toolchain,
existing release rules, Node requirement, and security practices.

## Scope

### In Scope
- Make the manifest publishable and restrict the tarball to runtime output and
  user-facing package documentation.
- Keep Git hook installation for local repository setup without executing the
  TypeScript hook installer as a registry dependency's `postinstall`.
- Add a clean global npm install smoke check rooted outside the checkout,
  including `browser-recorder --version` and tarball contents checks.
- Add a protected, owner-only, manually dispatched npm publication workflow
  with a dry run enabled by default.
- Document npm installation alongside source-development instructions and
  make browser recovery commands usable by npm-installed consumers.
- Bump the patch version because the publish surface and package lifecycle
  change.

### Out of Scope
- Actually publishing to npm as part of this code change.
- Automatically publishing on merge or release; the initial package is
  explicitly published by a maintainer after a dry run.
- Changing the existing GitHub Release or version-bump automation.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json` | Modified | Publish metadata, file allowlist, local hook lifecycle, patch version |
| `src/` | Modified | Package-manager-neutral recovery instructions for Patchright |
| `.github/workflows/` | Modified/Added | Clean package verification and protected npm publish workflow |
| `tests/` | Modified | Package, lifecycle, recovery-command, and workflow contracts |
| `README.md`, `CONTRIBUTING.md` | Modified | npm install and runtime recovery guidance |
| `openspec/` | Modified | Change artifacts and repository-quality spec reconciliation |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| The package installs but misses compiled runtime files | Med | Pack only after build; assert required tarball paths and run the installed CLI |
| A consumer install executes repository-only hook setup | High, observed | Move hook setup from `postinstall` to `prepare`; install the packed tarball in a clean external root with scripts enabled |
| An accidental dispatch publishes an unreleased package | Med | Require owner + default branch, use `admin` environment, and default dry-run to true |
| A duplicate version is published | Med | Check the registry before the publish step and fail with a clear version-bump instruction |
| Package metadata change conflicts with the active version-unchanged scenario | Known | Reconcile the stale workflow-only constraint; apply the existing release-impact policy and patch-bump the package |

## Success Criteria

- A clean global install from the generated tarball succeeds outside the checkout
  with lifecycle scripts enabled.
- The installed `browser-recorder --version` prints the manifest version.
- The tarball contains `dist/main.js`, the bundled capture script, `README.md`,
  and `LICENSE`, and excludes repository source, tests, OpenSpec, and workflows.
- A dispatch with `dry_run=true` validates and packages but cannot publish.
- A real publish is possible only from the default branch in the protected
  environment using `NPM_AUTH_TOKEN`.
