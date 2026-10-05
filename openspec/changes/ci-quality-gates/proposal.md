# Proposal: CI quality gates

## Intent

Every gate that runs locally must also run in CI, visibly and once. Today the static gates (ESLint, Prettier, knip, dependency-cruiser) are grouped in one step and repeated on three OSes, and commitlint (a local `commit-msg` gate) never runs in CI. Because merges are squash merges, an invalid PR title lands on `main` unchecked.

## Scope

### In Scope
- Split `.github/workflows/ci.yml` into a `Quality` job (ubuntu, once) and a `Test — <os>` matrix (linux, macos, win). Both start in parallel.
- `Quality`: one named step per gate: Typecheck, Authored source policy, ESLint, Prettier, knip, dependency-cruiser, Audit, Commitlint.
- Commitlint: PR title always (env var, never interpolated); PR commits `base..head` only when the author is not a bot.
- Re-check the title on `edited` without re-running the OS matrix (mechanism decided in design).
- `Test`: install, Chromium, `pnpm test:coverage`, `pnpm build`. No static gates.
- Update `tests/unit/repository/workflows.test.ts` first (RED).

### Out of Scope
- Changing lint, knip, dependency-cruiser or commitlint rules.
- Changing lefthook, other workflows, secrets or permissions.
- Editing branch protection settings (owner action).
- Version bump (release-neutral workflow change).

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `repository-quality`: the "CI and automation" requirement gains CI gate parity: static gates run once in a dedicated job with one step per gate, the OS matrix runs only tests and build, and PR titles (plus non-bot PR commits) pass commitlint.

## Approach

Follow the exploration decisions verbatim. Full-history checkout only in `Quality` (for the commit range). Keep `permissions: read-all` / `contents: read`, repository guard, draft guard, concurrency and pinned action SHAs.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `.github/workflows/ci.yml` | Modified | Job split, per-gate steps, commitlint |
| `.github/workflows/` (title workflow, if chosen) | New | Title re-check on edit |
| `tests/unit/repository/workflows.test.ts` | Modified | New layout assertions; workflow-set list if a file is added |
| `openspec/specs/repository-quality/spec.md` | Modified | Delta for CI parity |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Required check names change (`CI — linux` becomes `Quality` / `Test — linux`); protection waits forever | Med | Document new names in the PR; owner updates branch protection at merge |
| Dependabot commit bodies exceed commitlint body limits | High | Skip per-commit lint for bot authors; still lint the title |
| `edited` events re-run the full matrix or cancel an in-flight run via concurrency | Med | Isolate title check (separate workflow or guarded job with its own concurrency group) |
| Title injection into shell | Low | Pass title via `env`, pipe to `commitlint` |
| Shallow checkout breaks `base..head` | Low | `fetch-depth: 0` in `Quality` only |

## Rollback Plan

Revert the squash commit; `ci.yml` returns to the single matrix job. Restore old required check names in branch protection if they were changed.

## Dependencies

- Owner updates branch protection required checks after merge.

## Success Criteria

- [ ] Each local gate appears as its own CI step and runs once per PR.
- [ ] OS jobs run only Chromium install, tests with coverage and build.
- [ ] An invalid PR title fails CI; editing it to a valid title turns it green without re-running the matrix.
- [ ] Dependabot PRs pass with conventional titles.
- [ ] `workflows.test.ts` covers the new layout; `package.json` `version` unchanged.

## Proposal question round

Auto mode; assumptions for owner review:
1. Branch protection will be updated manually to the new check names.
2. Bot detection by PR author type (`Bot`) is sufficient; no allow-list.
3. Title re-check on `edited` only fires when the title changed.
