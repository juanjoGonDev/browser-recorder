# AGENTS.md — working agreements for AI agents on browser-recorder

Conventions an agent MUST follow when changing this repo. Human-facing docs
live in `README.md`; the security model lives in `SECURITY.md`.

## Spec-driven development

SDD is always used: every change starts from a proposal, specs, a design and a
task list (`openspec/changes/<change>/`), and implementation follows the tasks
in order. Do not implement outside a task. When the design and a spec disagree,
the design names win for frozen contracts; record the reconciliation in the
apply-progress notes and fix the docs in the reconciliation task.

## No review budget

There is no line limit and no review-size budget. A change is as large as the
task list says. Do not split work only to keep a diff small.

## Single pull request

Deliver as a single pull request unless the owner says otherwise. Internal work
packages are commit groups inside that one pull request, not separate pull
requests.

## Autonomy

Work autonomously. Make reasonable decisions, write them down (design, notes,
commit messages) and keep going. Ask the owner only when a decision cannot be
reversed cheaply or depends on information you cannot obtain.

## Strict TDD

Every behavior change follows RED -> GREEN -> REFACTOR:

1. RED: write a failing test first and watch it fail for the right reason.
2. GREEN: write the minimum code that passes, then triangulate with a second
   case so a hard-coded answer cannot survive.
3. REFACTOR: clean up with the tests green after every step.

No production code without a failing test. Assertions must exercise real
production behavior: no tautologies, no empty-collection assertions without
setup, no CSS-class assertions.

Tests, probes and scripts never open browser windows. Vitest sets
`BROWSER_RECORDER_HEADLESS=1` for every spawned replay, and ESLint rejects a
literal `headless: false`. A test that genuinely needs a headed browser is
skipped unless `BROWSER_RECORDER_HEADED_TESTS=1` is set.

## Clean code and SOLID

- Apply SOLID: one reason to change per module (SRP); depend on ports, not adapters (DIP);
  extend by adding code, not by editing switch statements (OCP).
- Small functions (at most 40 lines), shallow nesting, few parameters. Prefer
  pure functions; push IO to adapters.
- Name things for what they mean. Booleans read as a question (`isReady`,
  `hasFocus`). No magic numbers: name them.
- Comments explain why, never what.

## Architecture

Screaming and hexagonal. One top-level folder per capability under `src/`
(`recording-capture`, `script-generation`, `replay`, `script-library`,
`environment-setup`, `tui`), each split into `domain/` (pure),
`application/` (use cases and `ports/`) and `adapters/` (Node and Playwright
IO). `src/shared/domain/` is the shared kernel. Only `src/main.ts` and
`src/composition/` wire features together; features never import each other.
Playwright is the only runtime dependency and is imported only from adapters
and the composition root. `pnpm deps:check` (dependency-cruiser) enforces all
of this; do not weaken `.dependency-cruiser.json` to make a change pass.

## Naming and lint rules

Enforced by ESLint (`pnpm lint:strict`), not advisory:

- File names are kebab-case (`unicorn/filename-case`).
- Functions and variables are camelCase, types are PascalCase with no `I`
  prefix, global constants are camelCase or UPPER_CASE.
- Boolean variables and properties start with `is`, `has`, `should`, `can`,
  `did`, `was` or `will`.
- A leading underscore is allowed only on unused parameters.
- At most 40 lines per function, 300 lines per source file (800 per test file),
  complexity 10, nesting depth 3, 3 parameters, 3 nested callbacks.
- No `console` in `src/`; output goes through the `Terminal` port.
- Exact dependency versions only, each at least 3 days old (`.npmrc`).

### Test layout (enforced by ESLint)

`@vitest/eslint-plugin` runs over `tests/**/*.test.ts`: every test lives in a
top-level `describe`, use `it` (never `test`), no duplicate titles, every test
asserts, no `.only`. A file's outermost `describe` is named after the module
under test.

## Parallel agents and worktrees

Parallel agents each get their own git worktree under
`../browser-recorder-worktrees/<name>`, on a branch `feat/<name>-<slug>`.
Size the pool as `min(floor((freeRAM_GB - 2) / 1.5), cpuCores - 2)` with a
minimum of 1; when there are more packages than slots, run in waves. Each slot
budgets ~1.5 GB (Vitest workers plus one headless Chromium) and 2 GB stay
reserved for the OS and the orchestrator. Measure `freeRAM_GB` right before
each wave:

- macOS: `memory_pressure` "System-wide memory free percentage" × total RAM.
- Linux: `MemAvailable` from `/proc/meminfo`.
- Windows: `(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory` (KB).

After a worktree finishes: `git merge` its branch into the main worktree, verify
the merged files are actually present, then `git worktree remove` it and delete
the branch with `git branch -d`. Update a worktree branch with `git merge main`,
never rebase. Contract changes (shared types, ports) happen only on the main
worktree, in their own commit, before the worktrees merge them in.

## Branching and pull requests

- Trunk-based: `main` is the only long-lived branch; branches are short.
- Squash + merge only. Update a branch with `git merge main`; never rebase.
  No force push and no `--amend` on commits that were already pushed.
- Branch name `<type>/<slug>`, where `<type>` is one of `feat`, `fix`,
  `refactor`, `chore`, `docs` and the slug is short kebab-case.
- Commits and pull request titles are Conventional Commits in English
  (`feat: add replay progress parser`).
- No AI attribution and no `Co-Authored-By` trailers in commits or pull
  requests.
- Never work on `main`.

## Never push

Agents never push, never add remotes and never open pull requests. Work stays
on the local branch until the owner publishes it. No script or product code in
this repo runs `git push`.

## Recordings are plaintext

`recordings/<slug>/recording.json` stores every typed value as plaintext, including
passwords (password fields are only flagged). `recordings/` is gitignored; never
commit, paste or log its contents.

## Versioning

`scripts/release-impact-policy.ts` is the single source of truth for whether a
change needs a release. Release-impacting changes bump `package.json` `version`
with semantic versioning (patch for fixes, minor for features, major for
breaking changes). Release-neutral changes (docs, tests, workflows, tooling
dependencies) never bump it. Do not hand-create tags or GitHub releases: the
release workflows own them.

## Quality gate

Before considering a change done, run `pnpm quality` (`typecheck`,
`lint:strict`, `format:check`, `deadcode`, `deps:check`, `test`), then
`pnpm test:coverage` and `pnpm build`. Run `pnpm format` to fix formatting.
Git hooks (lefthook) run the same gates on commit and push; never bypass them
with `--no-verify`.
