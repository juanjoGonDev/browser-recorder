# Exploration: ci-quality-gates

## User request (2026-10-05)

"Everything that passes locally must also pass in CI" (knip, ESLint, ...).
Static checks must be separate and run once; each OS job in the matrix must
only test what depends on the OS.

## Current state (verified)

- `.github/workflows/ci.yml` has one job, `ci`, run as a matrix on
  ubuntu-latest, macos-15 and windows-latest. Every OS runs, in order:
  install, Chromium install, "Type safety and authored-source policy"
  (`pnpm typecheck` + no authored JS), "Static quality" (one step that runs
  `lint:strict`, `format:check`, `deadcode` (knip) and `deps:check` through a
  bash helper), "Audit dependencies" (linux only), "Tests"
  (`pnpm test:coverage`) and "Build".
- So knip, ESLint, Prettier and dependency-cruiser DO run in CI, but grouped
  under one step name and repeated on three OSes.
- Local hooks (lefthook): pre-commit prettier + eslint + typecheck + build;
  commit-msg commitlint; pre-push format-check + test:coverage + deadcode +
  deps:check + audit. The only local gate missing in CI is commitlint.
- Merges are squash merges: the PR title becomes the commit on `main`.
- Dependabot commit bodies can exceed commitlint's body line limit, so linting
  every commit of a Dependabot PR would fail on lines the bot writes.
- `tests/unit/repository/workflows.test.ts` asserts properties of `ci.yml`
  (the job layout change must update it test-first).

## Decisions

1. Split `ci.yml` into:
   - `quality` (ubuntu-latest, once): checkout with full history for the PR
     range, pnpm + Node setup, `pnpm install --frozen-lockfile` (no browser
     install needed), then one visible step per gate: Typecheck, Authored
     source policy (no JS), ESLint (`pnpm lint:strict`), Prettier
     (`pnpm format:check`), knip (`pnpm deadcode`), dependency-cruiser
     (`pnpm deps:check`), Audit (`pnpm audit --audit-level=moderate`),
     Commitlint (PR title always; PR commits `base..head` when the PR author
     is not a bot).
   - `test` matrix (linux, macos, win): install, Chromium install, Tests
     (`pnpm test:coverage`), Build. No static gates repeated.
   - The matrix does not wait for `quality` (both start in parallel; the PR is
     red if either fails) so feedback stays fast.
2. The PR title is checked with the repo's own commitlint config
   (`echo "$TITLE" | pnpm exec commitlint`), passing the title through an env
   var, never interpolated into the script (injection-safe).
3. Re-run the title check on title edits without re-running the OS matrix:
   either a separate small workflow on `pull_request: [edited, ...]`, or a job
   guarded so `edited` only runs commitlint. Decide in design.
4. Keep check names stable and readable in GitHub (`Quality — ESLint` style
   is per step; job names `Quality` and `Test — <os>`).
5. Keep the existing secret contract, permissions (`read-all` / contents
   read) and concurrency; update `workflows.test.ts` first (RED).
