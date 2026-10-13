# Apply progress: npm CLI config warnings

## Baseline

The user reproduced `npm warn Unknown project config` for six pnpm-specific
keys in the project `.npmrc`: `minimum-release-age`, `prefer-frozen-lockfile`,
`verify-store-integrity`, `verify-deps-before-run`, `auto-install-peers`, and
`strict-peer-dependencies`.

## Decisions

- Preserve all pnpm policy values; this is a config-location correction only.
- Keep npm-compatible keys in `.npmrc`.
- Include `pnpm-workspace.yaml` in release-impact classification, matching the
  existing treatment of `.npmrc` settings.

## Verification

- `pnpm config get` reported all six original values from pnpm 10.34.4.
- `npm whoami --registry=https://registry.npmjs.org` completed without the six
  unknown-project-config warnings after the migration.
- `pnpm install --frozen-lockfile` passed and reported the lockfile up to date.
- Focused `dependency-pins.test.ts` passed (18 tests). The release-impact
  policy cases passed, but its Windows symlink-entrypoint test failed with
  `EPERM`; that test is unrelated to the changed classification and is already
  host-sensitive.
- `pnpm build` passed. `pnpm quality` / `pnpm test:coverage` remain blocked by
  existing flaky generated-script replay tests and Windows `EPERM` symlink or
  cleanup tests; their earlier full runs also exposed the two dependency-pin
  assertions, now updated and passing in the focused test.
