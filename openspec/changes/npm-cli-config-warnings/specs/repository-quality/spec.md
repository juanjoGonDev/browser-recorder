# Delta for repository-quality

## MODIFIED Requirements

### Requirement: Dependency hygiene

All dependencies MUST use exact versions; Patchright (pinned `1.63.0`) MUST be
the only runtime dependency and `playwright` MUST NOT appear; `pnpm audit` MUST
report zero findings. `.npmrc` MUST contain only npm-compatible settings, while
pnpm-specific install policies MUST be configured in `pnpm-workspace.yaml`.
The repository MUST preserve `save-exact`, `minimumReleaseAge: 4320`,
`engine-strict`, and frozen-lockfile behavior.

#### Scenario: npm CLI configuration

- GIVEN the repository root `.npmrc`
- WHEN an npm CLI command runs from the checkout
- THEN npm MUST NOT warn about pnpm-only project configuration keys

#### Scenario: pnpm install policy

- GIVEN the project `pnpm-workspace.yaml`
- WHEN pnpm reads the repository configuration
- THEN the 4320-minute release-age policy, frozen-lockfile preference, store
  integrity verification, pre-run dependency warning, automatic peer install,
  and non-strict peer policy MUST remain enabled with their existing values
