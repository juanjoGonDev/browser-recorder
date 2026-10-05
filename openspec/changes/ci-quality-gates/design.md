# Design: CI quality gates

## Technical Approach

Split `.github/workflows/ci.yml` into two independent jobs (no `needs`): `quality` (ubuntu, once, one step per local gate) and `test` (OS matrix, OS-dependent work only). Lint the PR title in a new small workflow, `.github/workflows/pr-title.workflow.yml`, so a title edit re-checks only the title. Commits are linted inside `quality`. Pinned action SHAs, `permissions: read-all` plus job `contents: read`, the repository guard, the draft guard and the ci.yml concurrency stay exactly as today.

## Architecture Decisions

| Topic | Options | Tradeoff | Decision |
|---|---|---|---|
| Title re-check | (a) separate workflow; (b) add `edited` to ci.yml and guard jobs | (b) shares ci.yml's concurrency group `CI-<head_ref>` with `cancel-in-progress`: an `edited` event cancels the in-flight matrix, and its guarded-out jobs report `skipped` on the same head SHA, which can mask a real failure | (a) `pr-title.workflow.yml` with its own concurrency group |
| Where the title is linted | in `quality` and in pr-title, or pr-title only | `quality` does not re-run on edit, so a bad title would leave it red forever after the fix | pr-title only; `quality` lints commits only |
| `edited` filtering | run only when `changes.title` exists, or always | a `skipped` run is recorded as a new check on the same SHA and can overwrite an earlier failure | always run (about 1 min); deviates from proposal assumption 3 on purpose |
| pr-title event types | `[opened, edited, reopened, synchronize]` | checks attach to the head SHA, so a push needs a fresh title check | include `synchronize`; no draft guard (cheap), so `ready_for_review` is not needed |
| Gate failure visibility | stop at the first failing step, or run every gate | the old bash helper existed to say which gate failed | each gate step uses `if: ${{ !cancelled() && steps.install.outcome == 'success' }}`, so one run reports every failing gate |
| Bot detection | author type, or a login allow-list | `type == 'Bot'` covers Dependabot and `github-actions[bot]` | `github.event.pull_request.user.type != 'Bot'` on the commits step |
| Commit range | `base.sha..head.sha`, or a merge-base calculation | merges from `main` are reachable from base and excluded; config-conventional ignores merge commits by default | `pnpm exec commitlint --from "$BASE_SHA" --to "$HEAD_SHA" --verbose` with `fetch-depth: 0` in `quality` only |

## Data Flow

    pull_request (opened|reopened|synchronize|ready_for_review)
      └─ ci.yml ── quality (ubuntu) ── gates + commitlint base..head (non-bot)
               └─ test[linux|macos|win] ── Chromium, test:coverage, build
    pull_request (opened|edited|reopened|synchronize)
      └─ pr-title.workflow.yml ── title (env) | commitlint

## Exact layout

`ci.yml` (triggers, top-level permissions and concurrency unchanged):

- `quality`: `name: Quality`, `runs-on: ubuntu-latest`, `timeout-minutes: 15`, same `if` guard, `contents: read`. Steps: Checkout (`fetch-depth: 0`, `persist-credentials: false`), Set up pnpm, Set up Node.js (22, pnpm cache), `Install reproducibly` (`id: install`), then `Typecheck` (`pnpm typecheck`), `Authored source policy` (the current `git ls-files` bash block, unchanged), `ESLint` (`pnpm lint:strict`), `Prettier` (`pnpm format:check`), `knip` (`pnpm deadcode`), `dependency-cruiser` (`pnpm deps:check`), `Audit` (`pnpm audit --audit-level=moderate`), `Commitlint — commits` (`if:` adds `github.event_name == 'pull_request' && github.event.pull_request.user.type != 'Bot'`; env `BASE_SHA`, `HEAD_SHA` from `pull_request.base.sha` and `head.sha`).
- `test`: `name: Test — ${{ matrix.os }}`, the current matrix, timeout, guard and cache, then Checkout (default depth), pnpm, Node, Cache Playwright browsers, Install, both Chromium steps, `Tests` (with the coverage comment kept), `Build`. No static gate and no audit.

`pr-title.workflow.yml`: `name: PR title`; `permissions: read-all`; `concurrency: pr-title-${{ github.event.pull_request.number }}`, `cancel-in-progress: true`; job `title`, `name: Commitlint — PR title`, repository guard, `contents: read`, `timeout-minutes: 5`; Checkout, pnpm, Node, Install, then:

```yaml
- name: Commitlint — PR title
  env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  run: printf '%s\n' "$PR_TITLE" | pnpm exec commitlint --verbose
```

`printf` instead of `echo`, so a title such as `-n` is not read as an option.

## File Changes

| File | Action | Description |
|---|---|---|
| `tests/unit/repository/workflows.test.ts` | Modify (RED first) | New layout assertions |
| `.github/workflows/ci.yml` | Modify | `quality` and `test` jobs |
| `.github/workflows/pr-title.workflow.yml` | Create | Title commitlint |
| `CONTRIBUTING.md` | Modify | Short "Continuous integration" section after "Git hooks" naming the jobs and the title check |
| `openspec/specs/repository-quality/spec.md` | Delta (spec phase) | CI parity |

README (badge only) and AGENTS.md need no change. `package.json` `version` stays the same.

## Testing Strategy (workflows.test.ts, string/regex style, no YAML parser)

- Workflow set and repository-guard `it.each` lists include `pr-title.workflow.yml`.
- Split ci.yml at `/^  test:$/m` into `quality` and `test` blocks.
- `quality`: `runs-on: ubuntu-latest`, `fetch-depth: 0`, no `matrix`. `it.each` of [step name, command] for all eight gates. The commits step contains the Bot guard and `--from "$BASE_SHA" --to "$HEAD_SHA"`.
- `test`: contains `test:coverage`, `build` and both Chromium installs (the existing regex is kept). Contains none of `typecheck`, `lint:strict`, `format:check`, `deadcode`, `deps:check`, `audit` or `commitlint`. No `fetch-depth`.
- ci.yml has no `needs:`, no `edited`, and no `pull_request.title`.
- pr-title: the exact `types` line, the concurrency group, `contents: read`, no `changes.title`, and `pull_request.title` appears exactly once, on the `PR_TITLE:` env line.
- Every `uses:` in both files matches `@[0-9a-f]{40} # v`.
- Replace "audits dependencies on Linux only" with "audits once in quality".

## Threat Matrix

| Boundary | Applicability | Design response | Planned RED tests |
|---|---|---|---|
| Documentation-like paths | N/A: no file classification | — | — |
| Git repository selection | N/A: a single checkout in the default cwd | — | — |
| Commit state | N/A: no commits created | — | — |
| Push state | N/A: no push | — | — |
| PR commands | Applicable: an untrusted PR title and PR SHAs reach shell | Values only through `env`, quoted `"$VAR"`, `printf` piped to commitlint, no `${{ }}` in `run` | the title appears only on the env line; the commits command uses the quoted env SHAs |

## Migration / Rollout

The `main` ruleset has no required status checks, so renamed checks block nothing. After merge, the owner may require `Quality`, `Test — linux|macos|win` and `Commitlint — PR title`. To roll back, revert the squash commit.

## Open Questions

- None blocking. Owner to confirm the deviation that the title check always runs on `edited`.
