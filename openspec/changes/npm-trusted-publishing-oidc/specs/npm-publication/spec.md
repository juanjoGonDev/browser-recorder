# Delta for npm-publication

## MODIFIED Requirements

### Requirement: npm publication workflow

The repository MUST provide an owner-only, default-branch, manually dispatched
workflow that builds and validates the package before publication. Dry-run MUST
default to true and MUST never publish. A real publish MUST run in the protected
`admin` environment and authenticate through npm Trusted Publishing with GitHub
OIDC, without a long-lived npm token secret. The publish job MUST use Node
22.14.0 or later and npm CLI 11.5.1 or later. It MUST reject an already-published
version and publish the validated tarball as a public package.

#### Scenario: Safe dry run
- GIVEN the owner dispatches the workflow with no input override
- WHEN package validation completes
- THEN the workflow does not run `npm publish`

#### Scenario: Protected OIDC publication
- GIVEN the owner dispatches from the repository default branch with dry-run disabled
- AND the npm Trusted Publisher matches the repository, workflow filename, and `admin` environment
- WHEN package validation succeeds and the version is not in the registry
- THEN the workflow publishes the validated tarball publicly using GitHub OIDC
- AND npm generates provenance without a long-lived token

#### Scenario: Duplicate version
- GIVEN the requested package version already exists in the npm registry
- WHEN a real publication is requested
- THEN the workflow fails before attempting to publish and asks for a version bump

#### Scenario: Untrusted dispatch
- GIVEN a non-owner, fork, or non-default branch dispatch
- WHEN the workflow evaluates the job guard
- THEN no package validation or publication job runs
