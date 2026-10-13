# Tasks: npm Trusted Publishing

## Delivery constraints

- Single PR, release-neutral workflow maintenance.
- No package version bump.
- Keep the protected `admin` environment and owner/default-branch guard.

## Tasks

### WP1 — RED workflow contract
- [x] Update workflow tests to require Node >=22.14 and npm >=11.5.1 in publish.
- [x] Require OIDC permission and the protected `admin` environment.
- [x] Reject `NPM_AUTH_TOKEN`, `NODE_AUTH_TOKEN`, and legacy token workflow checks.
- [x] Run focused tests and record their expected failure.

### WP2 — OIDC workflow and spec reconciliation
- [x] Install a supported npm CLI in the publish job and remove token auth.
- [x] Reconcile the active npm-publication and repository-quality specs,
  design, tasks, and setup notes.
- [x] Record why the original token contract was superseded.

### WP3 — Verification
- [x] Run focused workflow tests and relevant static quality checks.
- [x] Validate the workflow contract and ensure the package version is unchanged.
- [x] Record exact results and the real-publish follow-up after merge.
