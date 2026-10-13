# Proposal: Keep pnpm-only settings out of npm configuration

## Intent

Prevent npm CLI warnings when commands such as `npm whoami` run from the
repository root, while preserving the repository's pnpm install policies.

## Scope

- Move pnpm-specific settings from `.npmrc` to `pnpm-workspace.yaml`.
- Keep settings understood by both npm and pnpm in `.npmrc`.
- Update the repository-quality contract and verify both CLIs read the intended
  configuration.

## Out of Scope

- Changing any dependency installation policy or package-manager version.
- Changing npm authentication or publishing configuration.
