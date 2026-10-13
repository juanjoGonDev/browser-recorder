# Design: Improve npm package discoverability

Use lowercase npm keywords describing what the package is and what it does:
`browser-automation`, `browser-recording`, `browser-recorder`, `cli`,
`e2e-testing`, `patchright`, and `test-automation`. Do not add `playwright` as a
keyword because the package's documented runtime engine is Patchright.

The keywords are public package metadata. Follow the repository's release
impact policy and bump the patch version from `0.1.2` to `0.1.3`; do not publish
as part of this change.

## Verification

- Test the manifest's keyword contract, including the exact `cli` value.
- Run the focused package metadata tests and build.
