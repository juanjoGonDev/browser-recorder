# Apply progress: npm package keywords

## Decisions

- Use accurate lowercase keywords; omit `playwright` because the package uses
  Patchright as its runtime engine.
- Bump `0.1.2` to `0.1.3` under the repository release-impact policy.
- Do not publish from this task.

## Verification

- RED: the new focused manifest test failed because `keywords` was absent.
- GREEN: the focused `dependency-pins.test.ts` passed (19 tests).
- `pnpm format:check`, `pnpm build`, and `pnpm install --frozen-lockfile`
  passed. The package version is `0.1.3`.
- `npm pack --dry-run --ignore-scripts --json` confirmed the pack includes
  `package.json` and the manifest contains `cli` among the selected keywords.
- No publish was attempted.
