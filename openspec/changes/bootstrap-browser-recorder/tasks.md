# Tasks: Bootstrap browser-recorder

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 12,000 - 16,000 (authored src + tests + tooling + docs; lockfile and goldens excluded) |
| 400-line budget risk | High |
| Chained PRs recommended | No (user explicitly accepted one large PR) |
| Suggested split | Single PR; internal work packages WP0..WP7 as commit groups |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

Note: `size:exception` was explicitly accepted by the user, so no decision gate remains. Do not recommend chaining.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| WP0 | Tooling, CI, docs, frozen contracts, 4 pure helpers, test support | PR 1 (single) | `pnpm test tests/unit/shared tests/unit/recording-capture && pnpm quality` | `pnpm lint:strict && pnpm deps:check && pnpm deadcode` | Revert WP0 commits (everything depends on them) |
| WP1 | Capture domain + `recording-session` | PR 1 | `pnpm test tests/unit/recording-capture` | N/A: pure logic, fakes only | `src/recording-capture/{domain,application}` |
| WP2 | In-page script + Playwright adapters | PR 1 | `pnpm test tests/integration/recording-capture` | Headless Chromium against `tests/fixtures/site` | `src/recording-capture/{in-page,adapters}` |
| WP3 | Script generation | PR 1 | `pnpm test tests/unit/script-generation` | `node --check` on goldens; one script run against the fixture | `src/script-generation` |
| WP4 | Script library | PR 1 | `pnpm test tests/unit/script-library tests/integration/script-library` | Temp-dir filesystem | `src/script-library` |
| WP5 | Replay + environment setup | PR 1 | `pnpm test tests/unit/replay tests/unit/environment-setup tests/integration/replay tests/integration/environment-setup` | Node spawner against a fixture script | `src/replay`, `src/environment-setup` |
| WP6 | TUI | PR 1 | `pnpm test tests/unit/tui tests/integration/tui` | Fake terminal and fake `AppServices` | `src/tui` |
| WP7 | Composition, entry, e2e, README, SECURITY | PR 1 | `pnpm test tests/e2e` | Record, generate, replay roundtrip; drift <= 100 ms | `src/main.ts`, `src/composition`, docs |

## Execution Model

- Order: WP0 (sequential, on main) -> WP1..WP6 (PARALLEL, one git worktree each) -> WP7 (sequential, on main).
- Design risk resolved: `is-dynamic-id`, `filter-stable-classes`, `should-record-key` and `select-hover-targets` move from WP1 into WP0 (task 0.12), so WP2 imports them from merged main. WP1 and WP2 no longer overlap.
- Worktrees: `../browser-recorder-worktrees/wpN`, branch `feat/wpN-<slug>`. Count = `min(floor((freeRAM_GB - 2) / 1.5), cpuCores - 2)`, min 1. If fewer slots than packages, run in waves.
- After each worktree finishes: `git merge` into the main worktree, verify the merged files are present, then `git worktree remove` and `git branch -d`. Branch updates use `git merge main`, never rebase.
- Contract changes: only on main, in a separate commit, then `git merge main` in affected worktrees.
- Every task: RED (failing test) -> GREEN (minimal code) -> REFACTOR. Spec refs: RC=recording-capture, SG=script-generation, RP=replay, SL=script-library, TUI=tui, ES=environment-setup, RQ=repository-quality.

## WP0: Foundation (main, first, sequential)

- [x] 0.1 RED: `tests/unit/repository/dependency-pins.test.ts` fails on any `^`/`~`/range in `package.json`, a second runtime dependency, or missing `.npmrc` keys (RQ Dependency hygiene: Range detected, Audit). GREEN: `package.json` (name, `packageManager pnpm@10.34.4`, engines `>=22.13.0`, `bin`, `type: module`, `onlyBuiltDependencies: ["lefthook"]`, `commitlint`, scripts per design, exact pins: typescript 6.0.3, vitest 5.0.1, @vitest/coverage-v8 5.0.1, @vitest/eslint-plugin 1.6.27, eslint 10.11.0, typescript-eslint 8.70.1, jiti 2.7.0, prettier 3.9.8, knip 6.37.0, dependency-cruiser 18.4.0, lefthook 2.1.14, esbuild 0.28.2; resolve exactly at scaffold: playwright (>3 days old), @types/node 22.x, eslint-plugin-unicorn, @commitlint/cli, @commitlint/config-conventional), `.npmrc` (devbar minus `node-linker=hoisted`); `pnpm install`; `pnpm audit` exits 0.
- [x] 0.2 Copy verbatim from `~/workspace/tools/devbar`: `.prettierrc`, `scripts/install-hooks.ts`, `scripts/lib/script-runtime.ts` plus their tests. `.gitignore` and `.prettierignore` add `recordings/`, `dist/`, `*.tmp` (RQ Gitignore: Ignored; RQ Hooks installed).
- [x] 0.3 RED: `tests/unit/repository/gitignore.test.ts` runs `git check-ignore recordings/x/script.mjs`. GREEN: rules from 0.2.
- [x] 0.4 TS configs: `tsconfig.base.json` (+`erasableSyntaxOnly`), `tsconfig.node.json` (outDir dist, in-page excluded), `tsconfig.tests.json`, new `tsconfig.in-page.json` (`lib [ES2023, DOM]`, `types: []`, noEmit). Smoke: `pnpm typecheck` green on a stub.
- [x] 0.5 RED: `tests/unit/repository/eslint-rules.test.ts` lints fixtures through `ESLint` API: 41-line function, `MyFile.ts`, non-boolean-prefixed boolean, `IFoo`, 4 params, depth 4, `console.log` in src each error (RQ Static analysis: Long function, Bad filename). GREEN: `eslint.config.ts` (strictTypeChecked, naming-convention, unicorn `filename-case` only, `max-lines-per-function` 40, `max-lines` 300/800, complexity 10, max-depth 3, max-params 3, max-nested-callbacks 3, switch-exhaustiveness, explicit-module-boundary-types, consistent-type-imports, no-floating-promises, no-console, devbar vitest layout rules; in-page parsed with `tsconfig.in-page.json`).
- [x] 0.6 RED: `tests/unit/repository/depcruise-rules.test.ts` runs depcruise on fixture trees: domain imports adapter, cross-feature import, `playwright` in application, in-page import outside allow-list, render importing application, orphan, each fails (RQ Static analysis: Layer violation). GREEN: `.dependency-cruiser.json` (devbar 4 rules, `tsPreCompilationDeps: true`, `no-cross-feature`, `domain-pure`, `application-no-io`, `playwright-in-adapters`, `in-page-sealed`, `render-pure`, `no-orphans`).
- [x] 0.7 `knip.json` (entries `src/main.ts`, `src/recording-capture/in-page/capture-script.ts`, `scripts/*.ts`, `tests/**/*.test.ts`), `vitest.config.ts` (unit/integration/e2e projects, `globalSetup` building the in-page bundle, coverage thresholds per design: per-file statements/lines >= 85, global branches >= 80, functions >= 85, listed exclusions).
- [x] 0.8 RED: `tests/unit/repository/commitlint.test.ts` rejects `fixed stuff` and accepts `feat: add x` (RQ Git hooks: Bad commit message). GREEN: `package.json#commitlint.extends`, `lefthook.yml` (pre-commit prettier `stage_fixed`, `lint:strict`, `typecheck`, `build`; commit-msg commitlint; pre-push `format:check`, `test:coverage`, `deadcode`, `deps:check`, `pnpm audit --audit-level=moderate`). Test asserts the hook layout and that `postinstall` installs hooks.
- [x] 0.9 RED: `tests/unit/repository/workflows.test.ts` lists `secrets.*` references and compares them to devbar's set; asserts no Electron steps, no `git push` in scripts, release creates a release with generated notes and an empty asset set (RQ CI and automation: Secret contract, Release). GREEN: copy or adapt `.github/` per the design copy plan (`dependabot.yml`, `release.yml`, `ci.yml` matrix, `codeql.yml`, `delete-cache`, `dependabot-auto-merge`, `dependabot-recreate-on-conflict`, `auto-merge-required-qa`, `release-impact-label`, `version-bump`, `auto-release`, `release-auto-merge`, `release.yml` workflow, `release-validation.yml`), repo guard `juanjoGonDev/browser-recorder`, `pull_request_template.md`; adapt `scripts/release-impact-policy.ts` and its test.
- [x] 0.10 RED: `tests/unit/repository/agent-docs.test.ts` asserts `CLAUDE.md` contains `@AGENTS.md` and `AGENTS.md` contains every required section (RQ Agent documentation: Import). GREEN: `AGENTS.md` with: SDD always, no line limit, single PR unless told otherwise; autonomous; strict TDD; clean code; SOLID; screaming + hexagonal; naming rules enforced by lint; parallel agents and worktrees sized `min(floor((freeRAM_GB - 2) / 1.5), cpuCores - 2)` min 1, merge each into main worktree, verify content present, remove worktree and branch; branching/PR policy (trunk-based, squash+merge only, `git merge main` never rebase, no force push or amend of pushed commits, branch `<type>/<slug>`, PR title Conventional Commits in English, no AI attribution or Co-Authored-By); never push; recordings plaintext note. `CLAUDE.md` = `@AGENTS.md`. Resolves the design open question on branch naming.
- [x] 0.11 Frozen contracts (type-only, no tests, coverage-excluded): `src/shared/domain/{locator,recording-event,recording}.ts`, `src/recording-capture/domain/captured-event.ts`, all `ports/*.ts` (`browser-launcher`, `monotonic-clock`, `recording-sink`, `process-spawner`, `recording-repository`, `browser-installation`, `app-services`, `terminal`, `timers`), `src/tui/domain/{app-state,app-action,intent}.ts`, and the exported function signatures `generateScript`, `startReplay`, `createLibraryService`, `ensureBrowser`, `startRecording` as type declarations. `pnpm typecheck` green.
- [x] 0.12 Four pure helpers moved from WP1. For each: RED `tests/unit/recording-capture/<name>.test.ts` -> GREEN `src/recording-capture/domain/<name>.ts` -> REFACTOR.
  - `is-dynamic-id.ts`: digit runs >= 4, uuid/hex >= 8, `:r1:`, `radix-`, `headlessui-`, `mui-`, `ember\d` are dynamic (RC Locator selection: Dynamic id).
  - `filter-stable-classes.ts`: drops CSS-in-JS hashes and utility-like classes (RC Locator selection).
  - `should-record-key.ts`: records specials and modifier shortcuts; skips editing keys inside fillables; keeps Enter/Tab/Escape/ArrowUp/ArrowDown (RC Event coverage).
  - `select-hover-targets.ts`: outermost entered ancestor (not html/body) plus last non-ancestor with a mutation; ordered by enter time, `ageMs` (RC Deterministic hover: CSS menu, No noise).
- [x] 0.13 Shared kernel helper: RED `tests/unit/shared/format-offset.test.ts` -> GREEN `src/shared/domain/format-offset.ts` (used by tui and replay UI via the shared kernel).
- [x] 0.14 Test support: `tests/support/{fixture-server,fake-clock,fake-terminal,build-in-page-bundle}.ts`, `tests/fixtures/site/*.html` (button, checkbox, prompt dialog, hover menu, iframe, shadow DOM, drag, file input, duplicate-id, dynamic-id, scroll, popup pages). Each support file has a smoke test; fixture server tested for ephemeral port and clean close.
- [x] 0.15 `scripts/build.ts`: RED `tests/integration/repository/build.test.ts` (build emits `dist/main.js` and `dist/in-page/capture-script.js`, an IIFE with no imports) -> GREEN `tsc -p tsconfig.node.json` plus esbuild IIFE (needs a stub in-page entry until WP2). Wire `pnpm quality`.
- [x] 0.16 Stub `src/main.ts` (shebang, empty composition) so knip and depcruise are green; commit WP0; run `pnpm quality`, `pnpm test`; tag the merge-base for worktrees.

## WP1: Capture domain and session (parallel; depends on WP0)

- [x] 1.1 RED/GREEN/REFACTOR `stamp-offset.ts`: `offsetMs = max(prevOffset, receivedAt - t0 - ageMs)` rounded to integer; backward clock jump keeps non-decreasing (RC Monotonic offsets: Clock jump).
- [x] 1.2 `normalize-key.ts`: `Control+Shift+K` canonical form and modifier order (RC Event coverage).
- [x] 1.3 `classify-navigation.ts`: action < 1000 ms or redirect < 1500 ms -> `wait-for-url`; reload -> `reload`; traverse delta -1/+1/n -> `go-back`/`go-forward`/repeated; unknown delta -> `goto`; same-URL push/replace without action dropped; `page-opened.cause` (RC Navigation fidelity: Reload, Back and forward, Action-triggered navigation).
- [x] 1.4 `page-registry.ts`: assigns `page1..n`, opener tracking, close (RC Event coverage: new tab, page close).
- [x] 1.5 `to-recording-event.ts`: `SessionSignal` -> `RecordingEvent` (modifiers, `isSensitive`, check/uncheck from `checked`, dialogs) (RC Modified right click, Checkbox state, Dialog, Sensitive input flag: Password).
- [x] 1.6 `coalesce-events.ts`: 5 rules, incremental `append` (RC Coalescing: Typing, Interleaved target; Navigation fidelity: redirect keeps both).
- [x] 1.7 `application/recording-session.ts` with fakes: RED covers offsets, dialog pending/respond, debounced 250 ms sink save, atomic stop, discard, `browser-closed` saves and closes (RC Interrupted recording safety: Ctrl+C, Browser closed; Crash mid-write via sink failure leaves the previous save).
- [x] 1.8 REFACTOR pass: enforce limits (40-line functions), `pnpm lint:strict`, `pnpm deps:check`; coverage per file >= 85.

## WP2: In-page script and Playwright adapters (parallel; depends on WP0)

- [x] 2.1 RED integration harness `tests/integration/recording-capture/` driving trusted Playwright input on fixtures; GREEN `in-page/emit.ts`, `capture-script.ts` (install guard `Symbol.for('browser-recorder.installed')`, `isTrusted` only).
- [x] 2.2 `deep-query.ts`, `implicit-role.ts`, `accessible-name.ts`, `css-path.ts` with RED tests in Chromium, shadow DOM included.
- [x] 2.3 `build-locator.ts` using the WP0 helpers `is-dynamic-id` and `filter-stable-classes`: ordered unique candidates, up to 4 (RC Locator selection: Duplicate id fallback, Dynamic id).
- [x] 2.4 `pointer-listener.ts`: click/auxclick/contextmenu from the pointerdown snapshot, checkbox/radio suppression, drag suppression (RC Modified right click).
- [x] 2.5 `input-listener.ts`: fill, `isSensitive`, select-option, check, set-input-files names only (RC Checkbox state, Password).
- [x] 2.6 `key-listener.ts` using `should-record-key` (RC Event coverage: keys/shortcuts).
- [x] 2.7 `scroll-listener.ts`: 150 ms trailing debounce plus 500 ms intent gate (RC Event coverage: scroll).
- [x] 2.8 `drag-listener.ts`: dragstart/drop and pointer drag > 5 px (RC Event coverage: drag).
- [x] 2.9 `hover-tracker.ts` using `select-hover-targets` plus MutationObserver (RC Deterministic hover: CSS menu, No noise).
- [x] 2.10 `navigation-listener.ts`: performance navigation type, `currententrychange`, main frame only (RC Navigation fidelity).
- [x] 2.11 Adapters: `performance-clock.ts`, `frame-path-resolver.ts`, `locator-verifier.ts` (`count() === 1` within 150 ms, ordered promise queue), `playwright-browser-launcher.ts`, `playwright-browser-session.ts` (`exposeBinding`, `addInitScript({ path })`, popups, `framenavigated` fallback 500 ms to `unknown`, `page.on('dialog')` -> `dialog-opened`, browser close) (RC Dialog, Navigation fidelity: Reload, Back and forward).
- [x] 2.12 Validate design open question: headed dialog assumption; record the outcome in a test note and fall back to documented behavior if it fails. REFACTOR: limits and lint.

## WP3: Script generation (parallel; depends on WP0)

- [x] 3.1 `js-literal.ts`: RED with `"`, backtick, `${`, `\n`, `\u2028`, `*/`, `"); process.exit(1); ("`; GREEN `JSON.stringify` plus `\u2028/\u2029` escape; assert `node --check` and exact value round-trip (SG Safe literals: Injection; threat matrix: generated-code injection).
- [x] 3.2 `render-target.ts`: locator kinds, `nth`, `frameLocator` chain (SG Event-to-code mapping).
- [x] 3.3 `script-prelude.ts`: `createRuntime` (`at`, `mark`, `done`, `fail`, `nextPage`, `expectDialogs`, `expectFiles`, `onAbort`); RED runs the prelude against a fake context: late step runs immediately; `::step i ms`, `::done`, `::error`; stdin `abort` exits 130 (SG Absolute-offset scheduling: Offset wait, Late step; Progress markers: Markers).
- [x] 3.4 `render-step.ts`: every event kind -> Playwright call; unknown kind throws naming type and index (SG Event-to-code mapping: Multi-tab, Unknown event type).
- [x] 3.5 `generate-script.ts`: golden scripts in `tests/unit/script-generation/goldens/`; byte-identical twice; only `playwright` and `node:` imports; pure function, so no file is written on error (SG Plain Playwright ESM output: Runnable, Deterministic).
- [x] 3.6 Integration: generated script runs against the fixture server; step markers in order and a step taking 400 ms does not shift later steps (SG Offset wait). Atomic write is covered in WP4 (SG Atomic generation).

## WP4: Script library (parallel; depends on WP0)

- [x] 4.1 `slugify.ts`: NFKD, diacritics, `[^a-z0-9]+`, <= 60, fallback `recording`, reserved names like `CON` (SL Slug generation: Unsafe characters, Reserved name).
- [x] 4.2 `allocate-slug.ts`: `-2`, `-3` (SL Collision). `validate-name.ts` (1-80, no control chars), `validate-start-url.ts` (http/https or empty) (TUI Create flow: Invalid URL, Empty URL).
- [x] 4.3 `parse-recording.ts`: hand-written validation, unsupported `schemaVersion` yields a descriptive error without modifying the file (SL Schema version). `summarize-recording.ts`.
- [x] 4.4 `atomic-write-file.ts` (temp `<file>.<pid>.<rand>.tmp`, fsync, rename, 5x/20 ms retry on Windows EPERM/EBUSY via injected fs): rename failure keeps the old file (SL Crash-safe writes; SG Atomic generation: Write failure; RC Crash mid-write).
- [x] 4.5 `file-system-recording-repository.ts`: `reserve`, `read`, `write`, `move` (fails if the target exists), `remove`, `scriptPath`; slug `../x`, `a/b`, `C:\x`, spaces rejected and escape of the root throws; orphan `.tmp` ignored (SL Storage layout: Create; Orphan temp; threat matrix: replay subprocess).
- [x] 4.6 `library-service.ts`: `createDraft`, `list` (createdAt desc, corrupt listed `invalid`), `load`, `save` (per-slug serialisation, writes JSON plus script), `rename` (conflict error, same-slug name-only), `remove` (SL Listing: Corrupt entry; Rename: Collision, Same slug; Delete: Declined, Confirmed).
- [x] 4.7 REFACTOR: limits, lint, deps, coverage.

## WP5: Replay and environment setup (parallel; depends on WP0)

- [x] 5.1 `split-lines.ts` (chunk splits, CRLF) and `parse-progress-line.ts` (`::step i ms`, `::done`, `::error`, `log`; `::step abc` is noise) (RP Progress parsing: Split chunk, Noise).
- [x] 5.2 `replay-progress.ts`: per-step drift = elapsed - offset, status, last step index, stderr tail (RP Exit handling: Failing step; Timing tolerance).
- [x] 5.3 `replay-runner.ts` with a fake spawner: missing script errors and spawns nothing; `process.execPath` plus args array, no shell; exit code 0 vs failed; cancel writes `abort\n`, then `kill()` after `cancelGraceMs` (RP Replay by spawning: Windows path via `node:path.win32` helper, Missing script; Exit handling: Cancel).
- [x] 5.4 `node-process-spawner.ts`: `shell: false`, stdio pipe; integration against a fixture script (stdout, stderr, exit code, kill, stdin).
- [x] 5.5 `linux-deps-hint.ts`: missing-libs error on linux -> `sudo pnpm exec playwright install-deps chromium` printed, never executed (ES Linux system dependencies: Missing libs; threat matrix: installer subprocess).
- [x] 5.6 `ensure-browser.ts`: present -> no install; missing -> announce then install; non-zero exit or still absent -> `failed` with the manual command (`pnpm exec playwright install chromium`); offline failure no crash (ES Chromium detection: Present, Missing; Automatic install: Success, Failure, Offline).
- [x] 5.7 `playwright-browser-installation.ts`: `existsSync(chromium.executablePath())`; install spawns `process.execPath [cli, 'install', 'chromium']` with a fixed argv, verify `playwright/cli` resolves or fall back to `playwright-core/cli.js` (resolves design open question) (ES Cross-OS portability: Windows spawn, no `.cmd`).
- [x] 5.8 Node version guard function in `environment-setup/domain` (`assertSupportedNode`): Node 20 yields a message with the minimum 22.13 (ES Cross-OS portability: Old Node). Wired in WP7.

## WP6: TUI (parallel; depends on WP0; fake `AppServices`)

- [x] 6.1 `app-reducer.ts` + `list-window.ts`: Down x2 then Up x1 selects the second, no wrap out of bounds; scrolling keeps the selection visible (TUI Library screen: Navigate; Resize).
- [x] 6.2 `text-input.ts` (cursor, Backspace, Ctrl+U) and `keymap.ts` per screen table; delete confirm defaults to no, Enter without choice deletes nothing, Esc cancels (TUI Rename and delete UX: Enter on delete prompt; SL Delete: Declined).
- [x] 6.3 Renderers, each pure, line snapshots at 80x24: `ansi.ts` (`NO_COLOR`), `layout.ts`, `describe-event.ts`, `timeline-list.ts`, `status-bar.ts`, then `main-menu`, `setup`, `new-recording`, `recording`, `library` (empty state shows the "new" hint), `timeline`, `replay` screens, `render-app.ts` (TUI Pure rendering: Snapshot; Library screen: Empty library; Self-refresh: Live recording, Replay highlight).
- [x] 6.4 `tui-controller.ts` with fakes: intents run against `AppServices`; new-recording validates name/URL inline; rename collision error inline; dialog banner a/d; browser close returns to the library; replay `::step 2` marks steps 0-1 done (TUI Create flow; Rename and delete UX; Self-refresh).
- [x] 6.5 `frame-scheduler.ts` (microtask-coalesced renders, 250 ms tick on recording/replay, 2 s library refresh) with a fake timers port; `node-timers.ts`.
- [x] 6.6 `node-terminal.ts`: alternate screen, hidden cursor, raw mode; restore on quit, SIGINT and uncaught error; non-TTY exits with an interactive-terminal message; fake streams (TUI Terminal lifecycle: Exit restore, Non-TTY).
- [x] 6.7 REFACTOR: lint, depcruise `render-pure`, coverage.

## WP7: Integration (main, last; depends on WP1-WP6 merged)

- [ ] 7.1 RED: `tests/integration/composition/create-app-services.test.ts` verifies each `AppServices` method against real feature use cases with fakes at the ports -> GREEN `src/composition/{resolve-paths,create-app-services}.ts` (package root, recordings root, playwright CLI path).
- [ ] 7.2 `src/main.ts`: node-version guard, TTY check, wire adapters, start the TUI; Ctrl+C persists the recording (RC Interrupted recording safety: Ctrl+C; ES Old Node; TUI Non-TTY).
- [ ] 7.3 E2E `tests/e2e/record-replay-roundtrip.test.ts`: trusted input headless -> `generateScript` -> spawn replay -> `::step` order, final fixture state, each step drift <= 100 ms (RP Timing tolerance; SG Offset wait; RC Event coverage).
- [ ] 7.4 Docs: `README.md` (install, usage, keys, plaintext values warning, Linux deps), `SECURITY.md` (devbar adapted).
- [ ] 7.5 Reconcile spec drift in docs only if needed: spec/design naming (`sensitive` vs `isSensitive`, `back`/`forward` vs `go-back`/`go-forward`, `uncheck` vs `check:false`, 2 s vs 1000 ms action window).
- [ ] 7.6 Final gates: `pnpm quality`, `pnpm test:coverage`, `pnpm build`, `pnpm audit`; verify all RQ scenarios; no push.
