# Proposal: publish npm packages with trusted OIDC

## Why

The first real npm publish failed with `ENEEDAUTH`: the npm package already has
a Trusted Publisher configured, but the workflow still depends on a long-lived
`NPM_AUTH_TOKEN` and pins Node below npm's Trusted Publishing minimum.

## What changes

- Use npm Trusted Publishing from the protected `admin` job with GitHub OIDC.
- Use a supported Node/npm CLI pair and stop requiring an npm token secret.
- Reconcile the publication spec and tests with the configured trust contract.

## Impact

Only the manual npm publication workflow and its repository tests/specs change.
No package files or version changes are needed; this is release-neutral tooling.
