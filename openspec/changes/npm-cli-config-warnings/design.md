# Design: Keep pnpm-only settings out of npm configuration

## Approach

`.npmrc` is shared with npm CLI commands, so it should contain only npm-compatible
settings. Move the six pnpm-only settings that triggered npm's warnings to the
project's `pnpm-workspace.yaml`, using pnpm's camelCase setting names.

Preserve all values exactly:

| `.npmrc` key | `pnpm-workspace.yaml` key | Value |
|---|---|---|
| `minimum-release-age` | `minimumReleaseAge` | `4320` |
| `prefer-frozen-lockfile` | `preferFrozenLockfile` | `true` |
| `verify-store-integrity` | `verifyStoreIntegrity` | `true` |
| `verify-deps-before-run` | `verifyDepsBeforeRun` | `warn` |
| `auto-install-peers` | `autoInstallPeers` | `true` |
| `strict-peer-dependencies` | `strictPeerDependencies` | `false` |

Retain npm-compatible `.npmrc` values such as exact-save behavior, engine
strictness and audit level. Do not alter the pinned pnpm version or lockfile.

## Verification

- Query all six settings through `pnpm config get` and confirm their original
  values remain active.
- Run `npm whoami` from the repository root and verify npm no longer emits
  unknown project-config warnings.
- Run a frozen pnpm install and confirm the lockfile does not change.
