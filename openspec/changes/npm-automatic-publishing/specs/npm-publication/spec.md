# Delta for npm-publication

## MODIFIED Requirements

### Requirement: npm publication workflow

The repository MUST provide an owner-only, default-branch npm publication
workflow that builds and validates the package before publication. Manual
dispatch MUST default to dry-run and MUST never publish unless explicitly
disabled. After `release.yml` verifies a stable GitHub Release, it MUST dispatch
the same `publish-npm.workflow.yml` workflow with the release tag and successful
release run ID. Automated publication MUST validate that the source run is a
successful run of `release.yml` on the default branch, that the release tag
matches the package version, and that the tag commit is reachable from the
default branch. It MUST build and publish the exact release-tag tarball from a
clean external install verification. A version already present in npm MUST be
treated as an idempotent no-op. Real publication MUST use npm Trusted
Publishing through GitHub OIDC in the protected `admin` environment, without a
long-lived npm token. The publish job MUST use Node 22.14.0 or later and npm CLI
11.5.1 or later.

#### Scenario: Automatic publication after release
- GIVEN `release.yml` has successfully created and verified a stable release
- WHEN it dispatches `publish-npm.workflow.yml`
- THEN the npm workflow validates that exact release and its upstream run
- AND it publishes the validated release-tag tarball through OIDC

#### Scenario: Untrusted automated dispatch
- GIVEN an automated dispatch does not reference a successful `release.yml`
  run on the default branch
- WHEN npm publication validates its release metadata
- THEN publication fails before building or publishing a package

#### Scenario: Safe manual dry run
- GIVEN the owner manually dispatches the workflow with no input override
- WHEN package validation completes
- THEN the workflow does not run `npm publish`

#### Scenario: Idempotent duplicate publication
- GIVEN the exact release version is already available from the npm registry
- WHEN the automated publish workflow is retried
- THEN it reports the version as already published and skips `npm publish`

#### Scenario: Protected OIDC publication
- GIVEN a verified release version is not in the registry
- AND the npm Trusted Publisher matches this repository, workflow filename,
  and `admin` environment
- WHEN package validation succeeds
- THEN the workflow publishes the validated tarball publicly through GitHub
  OIDC and npm generates provenance without a long-lived token
