# Tasks: automatic npm publication

## Delivery constraints

- One PR, release-neutral tooling change.
- Keep npm Trusted Publishing on `publish-npm.workflow.yml` and retain the
  protected `admin` environment.
- Do not add long-lived npm or GitHub secrets; do not bump the package version.

## Tasks

### WP1 — RED workflow contract
- [x] Test that a verified stable release dispatches the existing npm workflow
  with the release tag/run ID and narrowly scoped `actions: write` permission.
- [x] Test that automated publication validates the caller release run, builds
  from its immutable release tag, and skips an already published version.
- [x] Preserve owner-only manual dispatch, default dry-run, package validation,
  and the existing OIDC trust identity.
- [x] Run the focused workflow test and record its expected failure.

### WP2 — Automatic dispatch and publication validation
- [x] Dispatch `publish-npm.workflow.yml` after `release.yml` verifies a release.
- [x] Validate automated dispatch metadata and check out/verify the exact tag.
- [x] Keep manual dry-run behavior and make duplicate publishes idempotent.
- [x] Update the active repository-quality npm-publication requirements.

### WP3 — Verification
- [x] Run focused workflow tests and parse the changed workflow YAML.
- [x] Run `pnpm quality`, `pnpm test:coverage`, and `pnpm build`.
- [x] Verify the package version is unchanged and record exact results.
