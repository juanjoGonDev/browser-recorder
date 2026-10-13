# Design: npm Trusted Publishing through GitHub OIDC

## Technical approach

Keep the existing owner-only, default-branch `workflow_dispatch`, dry-run
validation job, exact tarball artifact, duplicate-version guard, and protected
`admin` publication environment. Replace token authentication in the real
publish job with npm Trusted Publishing through the GitHub OIDC token already
permitted by that job.

Trusted Publishing requires Node 22.14 or later and npm CLI 11.5.1 or later.
Pin Node to 22.14.0 and install npm 11.5.1 explicitly in the publish job so the
minimum is guaranteed rather than inferred from the Node distribution. Do not
set `NODE_AUTH_TOKEN` or pass `--provenance`: npm's OIDC trusted publisher
authenticates the publish and generates provenance automatically.

The npm Trusted Publisher registration must match repository
`juanjoGonDev/browser-recorder`, workflow filename
`publish-npm.workflow.yml`, and GitHub environment `admin`.

## Reconciliation

The original npm-publication design and spec required `NPM_AUTH_TOKEN`. The
first real workflow run showed that the package is configured for OIDC and has
no token secret. This change supersedes that credential decision while
preserving the manual trigger, protected environment, artifact validation, and
release safeguards. The old publication artifacts and repository test
expectations are reconciled in this change's task list.

## Test strategy

- RED: update repository workflow tests to require supported Node/npm, OIDC
  permission and protected environment, while rejecting token-based auth.
- GREEN: update the publish job and reconcile npm-publication spec artifacts.
- Verify the focused workflow tests, static quality gates, and workflow YAML.
- A real publish is intentionally not part of local verification; it is a
  protected maintainer action after merge.

## Release impact

Workflow, tests, and specs are release-neutral. Do not bump `package.json`.
