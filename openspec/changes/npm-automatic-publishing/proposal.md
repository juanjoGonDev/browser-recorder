# Proposal: publish npm automatically after GitHub releases

## Why

The package currently has a protected OIDC publishing workflow, but it only
runs when a maintainer dispatches it manually. That leaves each successful
GitHub release waiting for a second manual action.

## What changes

- Dispatch the existing `publish-npm.workflow.yml` after `release.yml` verifies
  a stable GitHub Release.
- Keep npm Trusted Publishing attached to that exact workflow file; do not add
  an npm token or switch to a reusable workflow with a different OIDC caller.
- Verify the dispatch came from a successful trusted release workflow run and
  build/install-check the package from the immutable release tag.
- Make successful duplicate publish attempts idempotent while preserving the
  manual dry-run path.

## Impact

Only GitHub Actions, workflow contract tests, and OpenSpec documentation change.
The npm package contents and version remain unchanged; this is release-neutral
tooling.
