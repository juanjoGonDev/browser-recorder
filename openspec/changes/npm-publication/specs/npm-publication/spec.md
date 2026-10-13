# Delta for npm-publication

## ADDED Requirements

### Requirement: Installable npm package

The package MUST be publishable (not private) and its tarball MUST contain the
compiled CLI, bundled in-page script, manifest, README, and license while
excluding repository-only source, tests, workflow, and OpenSpec files. The
package MUST NOT run repository Git-hook setup as a registry dependency's
`postinstall`.

#### Scenario: Tarball contents
- GIVEN a build has completed
- WHEN the package is packed
- THEN required runtime files and package documentation are present and repository-only files are absent

#### Scenario: Clean npm installation
- GIVEN the tarball and an empty install root outside the checkout
- WHEN npm installs it globally with lifecycle scripts enabled
- THEN installation succeeds and `browser-recorder --version` prints the manifest version

#### Scenario: Local Git hooks
- GIVEN the repository is installed for development
- WHEN the local package preparation lifecycle runs
- THEN lefthook is installed in the repository and registry consumers do not run that hook setup

### Requirement: npm publication workflow

The repository MUST provide an owner-only, default-branch, manually dispatched
workflow that builds and validates the package before publication. Dry-run MUST
default to true and MUST never publish. A real publish MUST run in the protected
`admin` environment and authenticate through npm Trusted Publishing with GitHub
OIDC, without a long-lived npm token secret. The publish job MUST use Node
22.14.0 or later and npm CLI 11.5.1 or later. The workflow MUST reject an
already-published version and publish the validated tarball as a public package.

#### Scenario: Safe dry run
- GIVEN the owner dispatches the workflow with no input override
- WHEN package validation completes
- THEN the workflow does not run `npm publish`

#### Scenario: Protected OIDC publication
- GIVEN the owner dispatches from the repository default branch with dry-run disabled
- AND the npm Trusted Publisher matches the repository, workflow filename, and `admin` environment
- WHEN package validation succeeds and the version is not in the registry
- THEN the workflow publishes the tarball publicly from the `admin` environment using GitHub OIDC
- AND npm generates provenance without a long-lived token

#### Scenario: Duplicate version
- GIVEN the requested package version already exists in the npm registry
- WHEN a real publication is requested
- THEN the workflow fails before attempting to publish and asks for a version bump

#### Scenario: Untrusted dispatch
- GIVEN a non-owner, fork, or non-default branch dispatch
- WHEN the workflow evaluates the job guard
- THEN no package validation or publication job runs

### Requirement: Clean package smoke check

Pull-request CI and the publish workflow MUST install the built tarball from a
fresh global npm prefix outside the source checkout with lifecycle scripts
enabled. The check MUST verify the package contents and execute the installed
binary without opening a browser.

#### Scenario: External root install
- GIVEN a clean temporary prefix outside `GITHUB_WORKSPACE`
- WHEN the packed package is installed
- THEN no repository hooks or checkout-relative files are required and the CLI version command succeeds

## MODIFIED Requirements

### Requirement: Browser recovery guidance

Manual Patchright browser and Linux dependency commands shown to users MUST use
the exact pinned Patchright package through npm exec so they work for both npm
consumers and source developers without assuming pnpm's local executable path.

#### Scenario: Browser install recovery
- GIVEN automatic Chromium installation fails
- WHEN the UI or replay CLI shows recovery guidance
- THEN it shows the exact pinned Patchright npm exec command

#### Scenario: Linux dependency recovery
- GIVEN Chromium is missing Linux system libraries
- WHEN the UI shows dependency guidance
- THEN both manual commands use the exact pinned Patchright version and npm exec
