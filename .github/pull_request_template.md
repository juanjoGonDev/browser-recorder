## What and why

<!-- What changes and why, in one or two sentences. Link the issue if there is one. -->

## How

<!-- The approach, and anything a reviewer should look at first. -->

## Testing

- [ ] `pnpm quality`
- [ ] `pnpm test:coverage`
- [ ] `pnpm build`

<!-- Describe any manual verification beyond the automated gates. -->

## Risks and rollback

<!-- What could break, who is affected, and how to revert (usually: revert this PR). -->

## Checklist

- [ ] The title is a Conventional Commit in English (`feat: ...`, `fix: ...`)
- [ ] Tests were written first (strict TDD: RED, GREEN, REFACTOR)
- [ ] Docs updated (README, SECURITY, CONTRIBUTING) where behavior changed
- [ ] CHANGELOG impact considered: the release notes come from the PR title and labels
- [ ] No AI attribution or `Co-Authored-By` trailers
- [ ] No recordings or secrets are included
