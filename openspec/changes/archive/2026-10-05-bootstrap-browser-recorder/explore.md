# Exploration: bootstrap-browser-recorder

## Goal (from the user)

A terminal-only tool, driven by a modern self-refreshing TUI, that records a real
browser session and turns it into a Playwright script that replays it
faithfully — clicks, fills, selects, key presses, navigation, reloads,
back/forward, tabs, and the original pauses between actions. Scripts are stored
outside git and can be created (name + optional start URL), listed, renamed,
deleted, replayed, and inspected as a timeline.

Repository requirements: born with zero known vulnerabilities, minimum
dependencies, exact versions, hardened pnpm, Dependabot and the same
self-maintenance GitHub Actions as the sibling repos, cross-OS (macOS, Windows,
Linux) with automatic install of everything needed, strict ESLint (function
size, naming of functions/files/types), knip, lefthook pre-commit/pre-push,
commitlint, AGENTS.md describing the working agreement. Local only: nothing is
pushed.

## Reference 1: `record` command in juanjoGonDev/webApi (private)

Location: `scripts/record.ts`, `scripts/run-record.ts`,
`src/shared/session-recorder/{browser,dom,recorder,types,config}.ts`.

How it works:

- Injection without CDP: `page.exposeFunction(name, handler)` +
  `page.addInitScript(script)` + `frame.evaluate(script)` on every existing
  frame; re-injected on `framenavigated`, `frameattached`, `domcontentloaded`,
  `load`. Idempotent via a non-enumerable `window.__...Installed` flag.
- New pages/popups via `context.on("page")` → `page2`, `page3`...
- Capture (capture phase listeners): `pointerdown` left click (skips fillable
  targets, dedupes same selector within 350 ms), `input` → fill with full value,
  `change` on `<select>` → selectOption, `keydown` for
  Enter/Tab/Escape/Arrow keys.
- Navigation: main-frame `framenavigated`; within 2 s of a user action →
  `waitForURL(pattern)` (query/hash stripped to `${origin}${pathname}**`),
  otherwise `goto(url)`. Same-URL navigations are dropped (so reloads are lost).
- Selector priority: `#id` → `[data-testid]` → `tag[name]` → `tag[aria-label]`
  → `tag[placeholder]` → `tag[autocomplete]` → `tag[role]` → unique stable class
  combo (filters CSS-in-JS hashes and Tailwind-like utility classes) →
  `input[type]` if unique → DOM path with stable class or `:nth-of-type`.
- Data model: in-page `DomRecorderEvent` → persisted `RecordedAction` with
  `pageVariable` and ISO `createdAt` stamped in Node on receipt. Coalescing:
  consecutive fills on same selector merge (keep first timestamp), consecutive
  selectOption merge, consecutive goto/waitForURL merge.
- Codegen: whole `.ts` file regenerated after each action and written
  atomically (`.tmp` + rename). Pauses are `await replayDelay(gapMs)` between
  actions, scaled by `delayScale`, capped at 30 s.
- Replay picker: raw-mode arrow-key menu over `.recordings/*.ts`, spawns
  `node --import tsx <file>`.

Gaps we must close (user asked for "TODO" and perfect replay):

- No reload, back/forward, scroll, checkbox/radio state, dblclick, right click,
  hover, drag & drop, dialogs, file inputs, keyboard shortcuts with modifiers.
- No visual timeline (only timestamp comments).
- Sleeps drift: replay adds human delays and action execution time on top of
  the recorded gap. Fix: schedule each step at its absolute recorded offset
  from the session start (`await waitUntilOffset(ms)`), so execution time is
  absorbed instead of accumulated.
- `#id` not checked for uniqueness; no role/text/label locators.
- Depends on patchright + tsx + a repo-specific wrapper; ours must emit plain
  Playwright that runs with `node` only.

## Reference 2: sibling repo `~/workspace/tools/devbar` (tooling template)

Copy from there, adapting only what is Electron-specific:

- `.npmrc`: save-exact, save-prefix=, minimum-release-age=4320,
  prefer-frozen-lockfile, verify-store-integrity, verify-deps-before-run=warn,
  engine-strict, auto-install-peers, strict-peer-dependencies=false,
  audit-level=moderate. Drop `node-linker=hoisted` (Electron-only need).
- `package.json`: `packageManager` pinned, `engines`, exact versions,
  `pnpm.onlyBuiltDependencies` allow-list, `pnpm.overrides` for advisories,
  `"type": "module"`, scripts `test`, `test:coverage`, `lint`, `lint:strict`,
  `format`, `format:check`, `deadcode` (knip), `deps:check`
  (dependency-cruiser), `quality`, `typecheck`, `build`, `postinstall`
  (installs hooks).
- `lefthook.yml`: pre-commit prettier on staged files (stage_fixed) + eslint;
  pre-push format-check + quality.
- `eslint.config.ts`: typescript-eslint `recommendedTypeChecked`,
  complexity/max-depth/max-params/max-lines, `@vitest/eslint-plugin` layout
  rules for tests.
- `knip.json`, `.dependency-cruiser.json`, `.prettierrc`, `.prettierignore`,
  `tsconfig.*.json`, `vitest.config.ts`, `SECURITY.md`, `AGENTS.md` sections
  (versioning, branches & commits in English, test layout enforced by lint).
- `.github/`: `dependabot.yml`, `release.yml`, workflows `ci.yml`,
  `codeql.yml`, `dependabot-auto-merge.workflow.yml`,
  `dependabot-recreate-on-conflict.workflow.yml`, `delete-cache.workflow.yml`,
  `auto-merge-required-qa.workflow.yml`, `release-impact-label.workflow.yml`,
  `version-bump.yml`, `auto-release.workflow.yml`,
  `release-auto-merge.workflow.yml`, `release.yml`, `release-validation.yml`,
  plus `scripts/release-impact-policy.ts` used by them. The release pipeline
  builds Electron installers there; here a release is a GitHub release with
  generated notes (no binaries). The PAT/secrets names stay identical so the
  user only configures them.

## Decisions taken in exploration

1. **Runtime dependency: `playwright` only.** TUI is hand-rolled on
   `node:readline` keypress events + ANSI escape codes (alternate screen,
   cursor hide, full-frame redraw on state change and on a timer). Ink/clack
   rejected: more transitive deps for what ~300 lines of rendering cover.
2. **Language/runtime:** TypeScript strict, ESM, compiled with `tsc` to
   `dist/`; Node >= 22.13 (LTS). The CLI entry is `bin` in package.json and a
   `pnpm start` script.
3. **Storage outside git:** `recordings/<slug>/recording.json` (source of
   truth: metadata + timestamped events) and `recordings/<slug>/script.mjs`
   (generated, plain Playwright ESM runnable with `node`). `recordings/` is
   gitignored. `script.mjs` resolves `playwright` through the repo's
   `node_modules` because it lives inside the repo tree.
4. **One replay implementation:** the TUI replays by spawning
   `node recordings/<slug>/script.mjs`; the generated script prints
   machine-readable progress lines (`::step <index>`) that the TUI parses to
   highlight the live timeline. No second interpreter that could diverge.
5. **Timing fidelity:** every event stores `offsetMs` from session start,
   measured with a monotonic clock in Node at receipt
   (`performance.now()`), and the generated script waits until each absolute
   offset before running the step.
6. **Browsers installed automatically:** on startup the app checks the
   Chromium executable (`chromium.executablePath()` + `fs.existsSync`) and, if
   missing, runs the Playwright CLI (`playwright install chromium`) with live
   output. Linux system deps (`--with-deps`) need sudo; we print the exact
   command instead of escalating.
7. **Capture coverage:** click (left/middle/right + modifiers), dblclick,
   check/uncheck for checkbox/radio, fill (coalesced), selectOption,
   press (special keys and modifier shortcuts), hover only when it precedes a
   click on a different element within a short window is NOT recorded
   (noise) — instead we record hover for elements opened via mouseover menus
   only if the next click target was invisible before; scroll (throttled,
   window and element), drag & drop, file input (records file names, replay
   requires the file to exist — flagged), dialogs (accept/dismiss + prompt
   text), navigation (goto / waitForURL), reload, back, forward, new page,
   page close. Hover heuristics may be simplified in design.
8. **Selectors:** emit Playwright locators, priority `getByTestId` →
   `getByRole(role, { name })` when unique → `getByLabel` → `getByPlaceholder`
   → unique `#id` (non-dynamic) → `getByText` (exact, unique) → stable CSS
   path (webApi algorithm). Uniqueness checked in-page at capture time.
9. **Architecture:** screaming + hexagonal. Feature folders under `src/`
   (e.g. `recording/`, `script-library/`, `replay/`, `codegen/`, `browser/`
   adapter, `tui/` presentation, `installer/`). Domain is pure and unit
   tested; adapters behind ports; dependency-cruiser enforces direction.
10. **Sensitive values:** recorded values are stored in plain text locally
    (required for faithful replay); password inputs are flagged in the
    timeline. Documented in README/SECURITY.md.

## Risks

- Cross-OS raw-mode TUI on Windows: `readline.emitKeypressEvents` works in
  Windows Terminal/PowerShell; legacy conhost may render ANSI poorly.
- Perfect replay is bounded by site nondeterminism (dynamic ids, A/B tests,
  timing-dependent content). Mitigated by stable locators + explicit waits.
- Copying devbar workflows: release jobs are Electron-specific and must be
  reduced without breaking the secret/PAT contract.
