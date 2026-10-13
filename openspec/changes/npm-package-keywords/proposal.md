# Proposal: Improve npm package discoverability

## Intent

Add accurate npm keywords to the package manifest so people searching npm can
discover the CLI and its browser automation/recording use case.

## Scope

- Add a concise, relevant keyword list to the public package manifest.
- Require the exact `cli` keyword.
- Bump the package patch version according to repository release policy.

## Out of Scope

- Renaming the package or changing its functionality.
- Publishing the package to npm.
