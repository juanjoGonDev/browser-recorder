# Proposal: Bootstrap browser-recorder

## Intent

No local tool records a real browser session into a faithful, plain Playwright script with exact timing, managed from a terminal UI. The webApi `record` prototype loses reloads, history, hover menus and timing fidelity. Bootstrap a hardened repo that closes those gaps.

## Scope

### In Scope
- Self-refreshing TUI: create (name + optional start URL), list, rename, delete, replay, live timeline.
- Capture: clicks (buttons, modifiers), dblclick, check, fill, select, keys/shortcuts, scroll, drag & drop, file inputs, dialogs, goto/waitForURL, reload, back/forward, tabs, page close, pauses.
- Codegen to `recordings/<slug>/script.mjs` (gitignored) from `recording.json`; absolute-offset scheduling.
- Cross-OS auto-install of Chromium.
- Tooling: exact versions, hardened pnpm, zero audit findings, ESLint (function size, unicorn `filename-case`, naming-convention for functions/types), knip, dependency-cruiser, lefthook (pre-commit: prettier, eslint, typecheck, build; commit-msg: commitlint; pre-push: tests, knip, deps:check, audit), Dependabot plus all devbar maintenance workflows adapted (no Electron release).
- `AGENTS.md` (SDD always, no budget, single PR, autonomous, strict TDD, clean code/SOLID, RAM-sized parallel worktrees merged back then removed, never push) and `CLAUDE.md` importing it.

### Out of Scope
- Pushing, publishing, Firefox/WebKit, secret masking, cloud sync.

## Capabilities

### New Capabilities
- `recording-capture`: in-page/Node event capture, monotonic offsets, coalescing, locators.
- `script-generation`: `recording.json` to runnable Playwright ESM with progress markers.
- `replay`: spawning scripts, absolute-offset timing, progress parsing.
- `script-library`: storage, slugs, CRUD.
- `tui`: screens, keyboard input, refresh loop, timeline.
- `environment-setup`: browser detection and install, Linux deps guidance.
- `repository-quality`: tooling, hooks, CI, Dependabot, agent docs.

### Modified Capabilities
None.

## Approach

Exploration decisions 1–6 and 8–10 stand: Playwright is the only runtime dependency; hand-rolled ANSI TUI; hexagonal feature folders.

Decision 7 hover, now deterministic. Before each click on T, emit `hover` only for:
1. the outermost ancestor of T (excluding `html`/`body`) entered since the previous action (CSS `:hover` menus);
2. the last entered non-ancestor element during whose hover a DOM mutation occurred (JS popovers).

Dropping hover breaks hidden-target CSS menus, because Playwright's click waits for visibility. Extra hovers cost only a mouse move.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/` | New | Features + adapters |
| `.github/` | New | Workflows, Dependabot |
| root configs, `AGENTS.md`, `CLAUDE.md` | New | Tooling, agreement |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Site nondeterminism breaks replay | Med | Stable unique locators, waits |
| Windows legacy console ANSI | Low | Target Windows Terminal |
| Workflow adaptation breaks secret contract | Med | Keep names |

## Rollback Plan

Greenfield, local: discard branch or `git reset` to empty root; `recordings/` untouched.

## Dependencies

- Node >= 22.13, pnpm 10.34.4, Chromium download.

## Success Criteria

- [ ] Recorded session replays with each step within ±100 ms of its offset.
- [ ] All hooks, `pnpm audit`, knip, depcruise pass clean.
- [ ] Fresh clone on macOS/Windows/Linux installs and records.

## Proposal question round

Auto mode; assumptions to review: plain-text values acceptable; Chromium only; ±100 ms timing tolerance.
