# Design: automatic npm publication through trusted dispatch

## Technical approach

After `release.yml` creates and verifies a stable GitHub Release, it invokes
`publish-npm.workflow.yml` through `workflow_dispatch`, using the built-in
`GITHUB_TOKEN` and passing the release tag plus the successful release
workflow's run ID. Grant `actions: write` only to the release job that performs
this dispatch. GitHub permits `workflow_dispatch` runs triggered by
`GITHUB_TOKEN`, unlike release/push events, so no long-lived GitHub or npm token
is introduced.

Keep publication in the existing workflow file because npm Trusted Publishing
checks the calling workflow identity; changing to `workflow_call` would make
the caller `release.yml` and invalidate the currently configured
`publish-npm.workflow.yml` trusted publisher. The existing `admin` environment
and OIDC-only publish job remain unchanged.

The publication workflow accepts optional release metadata only for the
automated invocation. It checks out the tag, confirms the dispatch references
a successful `release.yml` run on the default branch, verifies the matching
published stable release and package version, and checks that the tag commit is
reachable from the upstream run and current default branch. It then runs the
existing clean external-root package verification and uploads that exact
tarball. A registry lookup makes a retry a no-op when that version is already
published; registry errors other than a confirmed missing version remain
failures.

An owner may still manually dispatch a dry run (the default) or a real publish
from the default branch. Manual dry runs do not receive release inputs and
never publish.

## Test strategy

- RED: add workflow contract tests for dispatch permissions, source-run
  validation, release-tag checkout, idempotent registry handling, and preserved
  OIDC/manual-dry-run constraints; run them against the old workflows.
- GREEN: wire dispatch and validation into the existing release and npm
  workflows, then reconcile the active repository-quality spec.
- Verify focused tests, YAML parsing, workflow formatting, the quality suite,
  coverage, and build. Do not perform a real npm publish locally.

## Release impact

Workflow, test, and specification changes are release-neutral. Do not bump
`package.json`.
