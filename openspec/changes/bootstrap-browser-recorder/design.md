# Design: Bootstrap browser-recorder

## Technical Approach

Greenfield TypeScript 6 strict ESM CLI. Screaming + hexagonal: one top-level folder per capability (`recording-capture`, `script-generation`, `replay`, `script-library`, `environment-setup`, `tui`), each split into `domain/` (pure), `application/` (use cases + `ports/`), `adapters/` (Node/Playwright IO). A shared kernel (`src/shared/domain/`) holds the recording model. Only `src/main.ts` + `src/composition/` wire features together; features never import each other. Playwright is the only runtime dependency. All contracts (shared types + every `ports/*.ts`) are frozen in work package WP0 so WP1–WP6 run in parallel worktrees.

## Architecture Decisions

| Topic | Options | Tradeoff | Decision |
|---|---|---|---|
| Feature coupling | features import each other / each feature owns the ports it needs | direct imports are shorter but block parallel work | Each feature declares its own driven ports; composition adapts. depcruise forbids cross-feature imports |
| In-page code packaging | single `addInitScript(fn)` / tsc `outFile` / esbuild IIFE bundle | one function exceeds file-size rules; `outFile`/`module:none` are deprecated in TS 6 | Multi-file `in-page/` bundled by **esbuild** (devDep, build-time only) to `dist/in-page/capture-script.js`, injected with `context.addInitScript({ path })` |
| Injection | per-page `exposeFunction` + re-inject on frame events (webApi) / context-level `exposeBinding` + `addInitScript` | binding gives `source.page`/`source.frame` for free | `context.exposeBinding('__browserRecorderEmit')` + `context.addInitScript`; covers popups and every frame/navigation. Guarded by a non-enumerable `Symbol.for('browser-recorder.installed')` flag |
| Timestamps | in-page clock / Node receipt | page clocks differ per document | Adapter stamps `receivedAt = performance.now()` at binding entry; payload carries `ageMs` (in-page `performance.now()` delta since the real moment, e.g. hover enter, debounced scroll); `offsetMs = max(prevOffset, receivedAt - t0 - ageMs)`, rounded to integer ms |
| Locator uniqueness | in-page approximation only / Node verification | Playwright's engine may disagree with ours | In-page sends up to 4 ranked candidates computed at `pointerdown`; adapter `locator-verifier` picks the first with `count() === 1` within 150 ms, else keeps in-page first. Order kept by a per-session promise queue |
| Dialogs | let Playwright auto-dismiss / in-page `window.confirm` wrapping / TUI-mediated | auto-dismiss loses the answer; wrapping misses `beforeunload` | Adapter `page.on('dialog')` → `dialog-opened` signal → TUI banner (`a` accept, `d` dismiss, type text for prompt) → `respondToDialog` → recorded `dialog` event |
| Script timing | relative sleeps / absolute offsets | relative sleeps accumulate execution drift | `await rt.at(offsetMs)` sleeps until `t0 + offsetMs`; overruns absorbed |
| Fill offset | first keystroke / last keystroke | last = time the field reached its final value | Coalesced fill keeps the **last** input offset |
| Viewport/profile | user window / fixed | layout-dependent locators | Fixed `1280x800`, fresh ephemeral context in both record and replay |
| Validation | zod / hand-written | dependency vs code | Hand-written `parse-recording.ts` |
| TUI | ink, blessed / hand-rolled | dozens of transitive deps | `node:readline` keypress + ANSI, pure renderers |
| Cognitive complexity | `eslint-plugin-sonarjs` / core rules | plugin brings ~10 transitive deps; overlaps with `complexity`+`max-depth` | Rejected; core rules only |
| Commit linting | hand-rolled regex / commitlint | user explicitly asked for commitlint | `@commitlint/cli` + `config-conventional`, config in `package.json#commitlint` (no authored JS) |
| `@types/node` | devbar `26.x` / `22.x` | 26 types expose APIs absent on the Node 22 engine | Latest `22.x`, exact |

## Data Flow

    Chromium page --binding--> PlaywrightBrowserSession --SessionSignal--> RecordingSession
       (in-page capture)        (stamp receivedAt, frame path,              (offset, classify-navigation,
                                 verify locator, dialogs, pages)             to-recording-event, coalesce)
                                                                                   |
                                     RecordingSink (composition) <----------------+ debounced 250 ms
                                       -> LibraryService.save -> generateScript -> atomic write
                                                                                   |
    TUI store <-- live events --------------------------------------------------- +
    TUI replay -> ReplayRunner -> NodeProcessSpawner: node recordings/<slug>/script.mjs
                     ^-- parseProgressLine("::step i ms") <-- stdout

## Folder Layout (all files kebab-case)

```
src/main.ts                                  bin entry (shebang), composition only
src/composition/create-app-services.ts       adapts feature use cases to tui AppServices
src/composition/resolve-paths.ts             package root, recordings root, playwright cli path
src/shared/domain/recording.ts | recording-event.ts | locator.ts | format-offset.ts
src/recording-capture/domain/captured-event.ts        in-page -> Node protocol (types)
  coalesce-events.ts classify-navigation.ts select-hover-targets.ts should-record-key.ts
  normalize-key.ts is-dynamic-id.ts filter-stable-classes.ts to-recording-event.ts
  stamp-offset.ts page-registry.ts
src/recording-capture/application/ports/browser-launcher.ts | monotonic-clock.ts | recording-sink.ts
src/recording-capture/application/recording-session.ts
src/recording-capture/in-page/capture-script.ts (bundle entry) emit.ts hover-tracker.ts
  pointer-listener.ts input-listener.ts key-listener.ts scroll-listener.ts drag-listener.ts
  navigation-listener.ts deep-query.ts implicit-role.ts accessible-name.ts css-path.ts build-locator.ts
src/recording-capture/adapters/playwright-browser-launcher.ts playwright-browser-session.ts
  frame-path-resolver.ts locator-verifier.ts performance-clock.ts
src/script-generation/domain/generate-script.ts render-step.ts render-target.ts script-prelude.ts js-literal.ts
src/replay/domain/parse-progress-line.ts replay-progress.ts split-lines.ts
src/replay/application/ports/process-spawner.ts ; replay-runner.ts
src/replay/adapters/node-process-spawner.ts
src/script-library/domain/slugify.ts allocate-slug.ts validate-name.ts validate-start-url.ts
  parse-recording.ts summarize-recording.ts
src/script-library/application/ports/recording-repository.ts ; library-service.ts
src/script-library/adapters/file-system-recording-repository.ts atomic-write-file.ts
src/environment-setup/domain/linux-deps-hint.ts
src/environment-setup/application/ports/browser-installation.ts ; ensure-browser.ts
src/environment-setup/adapters/playwright-browser-installation.ts
src/tui/domain/app-state.ts app-action.ts app-reducer.ts intent.ts keymap.ts text-input.ts list-window.ts
src/tui/application/ports/app-services.ts terminal.ts timers.ts ; tui-controller.ts frame-scheduler.ts
src/tui/render/ansi.ts layout.ts render-app.ts describe-event.ts timeline-list.ts status-bar.ts
  main-menu-screen.ts setup-screen.ts new-recording-screen.ts recording-screen.ts
  library-screen.ts timeline-screen.ts replay-screen.ts
src/tui/adapters/node-terminal.ts node-timers.ts
tests/unit/<feature>/*.test.ts  tests/integration/<feature>/*.test.ts  tests/e2e/record-replay-roundtrip.test.ts
tests/support/fixture-server.ts fake-clock.ts fake-terminal.ts build-in-page-bundle.ts (vitest globalSetup)
tests/fixtures/site/*.html
```

## Interfaces / Contracts (frozen in WP0)

```ts
// src/shared/domain/locator.ts
export type Locator =
  | { readonly kind: 'test-id'; readonly testId: string }
  | { readonly kind: 'role'; readonly role: string; readonly name: string }
  | { readonly kind: 'label' | 'placeholder' | 'text'; readonly text: string }
  | { readonly kind: 'css'; readonly selector: string };
export interface Target {
  readonly locator: Locator; readonly nth: number | null;
  readonly framePath: readonly string[]; // iframe CSS selectors, outermost first
  readonly description: string;          // timeline label
}
// src/shared/domain/recording-event.ts
export type PageId = `page${number}`;
export type Modifier = 'Alt' | 'Control' | 'Meta' | 'Shift';
type Base<K extends string> = { readonly kind: K; readonly offsetMs: number; readonly pageId: PageId };
export type RecordingEvent =
  | (Base<'goto'> & { readonly url: string })
  | (Base<'wait-for-url'> & { readonly url: string })        // matched on origin+pathname
  | Base<'reload'> | Base<'go-back'> | Base<'go-forward'> | Base<'page-closed'>
  | (Base<'click'> & { readonly target: Target; readonly button: 'left' | 'middle' | 'right'; readonly modifiers: readonly Modifier[] })
  | (Base<'dblclick'> & { readonly target: Target; readonly modifiers: readonly Modifier[] })
  | (Base<'hover'> & { readonly target: Target })
  | (Base<'check'> & { readonly target: Target; readonly checked: boolean })
  | (Base<'fill'> & { readonly target: Target; readonly value: string; readonly isSensitive: boolean })
  | (Base<'select-option'> & { readonly target: Target; readonly values: readonly string[] })
  | (Base<'press'> & { readonly target: Target | null; readonly key: string }) // 'Control+Shift+K'
  | (Base<'scroll'> & { readonly target: Target | null; readonly x: number; readonly y: number })
  | (Base<'drag-and-drop'> & { readonly source: Target; readonly target: Target })
  | (Base<'set-input-files'> & { readonly fileNames: readonly string[] })
  | (Base<'dialog'> & { readonly dialogType: 'alert' | 'confirm' | 'prompt' | 'beforeunload';
      readonly message: string; readonly action: 'accept' | 'dismiss'; readonly promptText: string | null })
  | (Base<'page-opened'> & { readonly openerPageId: PageId | null; readonly cause: 'action' | 'user'; readonly url: string });
// src/shared/domain/recording.ts
export interface Recording {
  readonly schemaVersion: 1; readonly name: string; readonly slug: string;
  readonly startUrl: string | null; readonly createdAt: string; readonly updatedAt: string;
  readonly status: 'recording' | 'complete'; readonly durationMs: number;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly events: readonly RecordingEvent[];
}
// recording-capture/application/ports/browser-launcher.ts
export interface BrowserLauncher { launch(o: { startUrl: string | null; viewport: Recording['viewport']; isHeadless: boolean }): Promise<BrowserSession> }
export interface BrowserSession {
  onSignal(listener: (s: SessionSignal) => void): void;
  respondToDialog(r: { action: 'accept' | 'dismiss'; promptText: string | null }): Promise<void>;
  close(): Promise<void>;
}
export type SessionSignal = { readonly receivedAt: number; readonly pageId: PageId } & (
  | { kind: 'dom'; framePath: readonly string[]; payload: CapturedEvent; candidates: readonly Locator[] }
  | { kind: 'navigation'; url: string; navigationType: 'navigate' | 'reload' | 'back_forward' | 'push' | 'replace' | 'traverse' | 'unknown'; entryIndex: number | null }
  | { kind: 'page-opened'; openerPageId: PageId | null; url: string }
  | { kind: 'page-closed' } | { kind: 'browser-closed' }
  | { kind: 'dialog-opened'; dialogType: 'alert' | 'confirm' | 'prompt' | 'beforeunload'; message: string; defaultValue: string }
  | { kind: 'dialog-closed'; dialogType: 'alert' | 'confirm' | 'prompt' | 'beforeunload'; message: string; action: 'accept' | 'dismiss'; promptText: string | null }); // answered in the browser window
// monotonic-clock.ts: export interface MonotonicClock { now(): number }
// recording-sink.ts:  export interface RecordingSink { save(r: Recording): Promise<void> }
// recording-session.ts
export interface LiveRecording {
  subscribe(l: (u: { events: readonly RecordingEvent[]; pendingDialog: SessionSignal | null; isClosed: boolean }) => void): () => void;
  respondToDialog: BrowserSession['respondToDialog']; stop(): Promise<Recording>; discard(): Promise<void>;
}
export function startRecording(deps: { launcher: BrowserLauncher; clock: MonotonicClock; sink: RecordingSink; now: () => Date },
  request: { name: string; slug: string; startUrl: string | null }): Promise<LiveRecording>;
// script-generation/domain/generate-script.ts
export function generateScript(recording: Recording): string;
// replay/application/ports/process-spawner.ts
export interface ProcessSpawner { spawn(r: { command: string; args: readonly string[]; cwd: string; env: Readonly<Record<string, string>> }): SpawnedProcess }
export interface SpawnedProcess { onStdout(l: (chunk: string) => void): void; onStderr(l: (chunk: string) => void): void;
  onExit(l: (code: number | null) => void): void; writeStdin(text: string): void; kill(): void }
// replay/domain/parse-progress-line.ts
export type ProgressMessage = { kind: 'step'; index: number; elapsedMs: number } | { kind: 'done'; elapsedMs: number }
  | { kind: 'error'; index: number | null; message: string } | { kind: 'log'; line: string };
// replay-runner.ts
export interface LiveReplay { subscribe(l: (p: ReplayProgress) => void): () => void; cancel(): Promise<void>; readonly finished: Promise<ReplayProgress> }
export function startReplay(deps: { spawner: ProcessSpawner; nodePath: string; cancelGraceMs: number },
  request: { scriptPath: string; cwd: string; isHeadless: boolean }): LiveReplay;
// script-library/application/ports/recording-repository.ts
export type RecordingListing = { kind: 'valid'; summary: RecordingSummary } | { kind: 'invalid'; slug: string; reason: string };
export interface RecordingRepository {
  listSlugs(): Promise<readonly string[]>; reserve(slug: string): Promise<boolean>;
  read(slug: string): Promise<unknown>; write(slug: string, files: { recordingJson: string; scriptMjs: string }): Promise<void>;
  move(from: string, to: string): Promise<void>; remove(slug: string): Promise<void>; scriptPath(slug: string): string;
}
// library-service.ts: createLibraryService({ repository, renderScript: (r: Recording) => string, now })
//   -> { createDraft(name, startUrl), list(), load(slug), save(r), rename(slug, name), remove(slug) }
// environment-setup/application/ports/browser-installation.ts
export interface BrowserInstallation { isInstalled(): Promise<boolean>; install(onLine: (l: string) => void): Promise<{ exitCode: number | null }> }
// ensure-browser.ts -> { kind: 'ready'; linuxHint: string | null } | { kind: 'failed'; manualCommand: string }
// tui/application/ports/terminal.ts
export interface Terminal { size(): { columns: number; rows: number }; write(s: string): void;
  onKey(l: (k: { name: string | null; sequence: string; ctrl: boolean; meta: boolean; shift: boolean }) => void): void;
  onResize(l: () => void): void; enter(): void; restore(): void }
// tui/application/ports/app-services.ts: AppServices { environment, library, recording, replay } using shared types +
//   tui-local view types; implemented only in src/composition/create-app-services.ts.
```

## In-Page Capture Script

Listeners on `window`, capture phase, `isTrusted` only. Main-frame-only navigation reports (`window === window.top`).

| Signal | Rule |
|---|---|
| pointerdown | Snapshot target (retarget to closest interactive ancestor), button, modifiers, candidates, hover trace |
| click / auxclick / contextmenu | Emit click from the snapshot; suppressed when target is a checkbox/radio or its label (emitted as `check` from `change`) or when a drag was detected |
| dblclick | Emitted raw; Node merges |
| input | `fill` with full value for input/textarea/contenteditable (not file/checkbox/radio); `isSensitive` for `type=password` or `autocomplete*=password` |
| change | select → `select-option` (selected values); checkbox/radio → `check`; file → `set-input-files` (names only) |
| keydown | `should-record-key`: record specials (Enter, Tab, Escape, Arrows, Home/End, PageUp/Down, F1–F12) and modifier shortcuts (Control/Alt/Meta + key); inside fillables skip editing keys (Backspace, Delete, Ctrl/Meta + A/C/V/X/Z/Y) and keep Enter/Tab/Escape/ArrowUp/ArrowDown |
| scroll | Per-target 150 ms trailing debounce; recorded only if wheel/touchmove/scroll-key/scrollbar pointerdown happened in the previous 500 ms |
| dragstart+drop / pointer drag (>5 px, different element) | `drag-and-drop`; suppress the click |
| hover | Pure `select-hover-targets` on the trace: (1) outermost entered ancestor of T (not html/body) since the previous action; (2) last entered non-ancestor during whose hover a MutationObserver fired. Emitted before the click, ordered by enter time, `ageMs` = time since enter |
| document start | `{ navigationType: performance navigation entry type, entryIndex: navigation.currentEntry.index }` |
| currententrychange | Same-document `{ navigationType, entryIndex }` from the Navigation API |

Adapter fallback: main-frame `framenavigated` with no in-page report within 500 ms emits `navigationType: 'unknown'`.

**Navigation classification (`classify-navigation.ts`, pure)**: user action in the previous 1000 ms, or a navigation of the same page in the previous 1500 ms with no action in between (redirect) → `wait-for-url`; `reload` → `reload`; `back_forward`/`traverse` → index delta −1 `go-back`, +1 `go-forward`, |n| repeated n times, unknown delta → `goto`; `navigate`/`unknown` → `goto`; same URL with `push`/`replace` and no action → dropped. `page-opened.cause` = `action` if any action happened in the previous 1000 ms.

**Locator algorithm (`build-locator.ts`)**: candidates in priority order, each kept only if unique under shadow-aware `deep-query`: `data-testid` → role + accessible name (implicit role table, simplified accname: aria-labelledby, aria-label, label, alt, title, text; name 1–80 chars) → label → placeholder → `#id` when `!is-dynamic-id` (digit runs ≥ 4, uuid/hex ≥ 8, `:r…:`, `radix-`, `headlessui-`, `mui-`, `ember\d`) → exact text (≤ 50 chars, non-input) → stable CSS path (webApi algorithm: attribute selectors, stable classes via `filter-stable-classes`, `:nth-of-type` up to the nearest unique ancestor). Nothing unique → best CSS + `nth`.

## Coalescing Rules (`coalesce-events.ts`, incremental `append(events, next)`)

1. `fill` after `fill` on the same page and target → replace value and offset.
2. Consecutive `select-option`, `check`, `scroll` on the same target → keep the last.
3. `dblclick` removes up to two preceding `click`s on the same target within 500 ms; keeps the first click's offset.
4. Consecutive `wait-for-url` on the same page → keep the last; `goto` followed by redirect `wait-for-url` → keep both (the wait synchronises).
5. `hover` immediately before a click on the same target → drop; repeated hovers on the same target → keep the last.

## Generated `script.mjs`

```js
// Generated by browser-recorder from recording.json. Do not edit.
import { chromium } from 'playwright';
/* script-prelude: createRuntime(context) -> { at, mark, done, fail, nextPage, expectDialogs, expectFiles, onAbort } */
const browser = await chromium.launch({ headless: process.env.BROWSER_RECORDER_HEADLESS === '1' });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const rt = createRuntime(context);
try {
  const page1 = await context.newPage();
  rt.expectDialogs(page1, [{ index: 7, action: 'accept', promptText: null }]);
  await rt.at(0); rt.mark(0); await page1.goto("https://example.com/");
  await rt.at(1532); rt.mark(1); await page1.getByRole("button", { name: "Save", exact: true }).click();
  await rt.at(2100); rt.mark(2); const page2 = await rt.nextPage();   // popup / action-caused tab
  rt.done();
} catch (error) { rt.fail(error); } finally { await browser.close(); }
```

- Every recorded string is emitted through `js-literal.ts` (`JSON.stringify`); no raw interpolation.
- `rt.at(ms)` sleeps until `t0 + ms` (`t0` taken after `page1` exists). `rt.mark(i)` prints `::step <i> <elapsedMs>`, `rt.done()` prints `::done <elapsedMs>`, `rt.fail(e)` prints `::error <i> <json message>` and sets exit code 1.
- Dialogs: a per-page queue registered at page creation answers dialogs in recorded order and marks their step.
- File choosers: a per-page queue sets files from `recordings/<slug>/files/<name>`; a missing file fails with a clear `::error`.
- Pages: a `context.on('page')` queue; `cause: 'user'` → `context.newPage()`.
- Frames: `page1.frameLocator(sel)…` chain. Scroll: `rt.scrollTo(page, chain, [x, y])` through a CDP isolated world (`Page.createIsolatedWorld` + `Runtime.callFunctionOn`), never `evaluate` (see the addendum). Drag: `source.dragTo(target)`.
- stdin `abort` line or stdin end → close the browser and exit 130.

## Replay, Install, Storage

- **Replay**: `spawn(process.execPath, [scriptPath], { cwd: packageRoot, shell: false, stdio: 'pipe' })`. Cancel writes `abort\n`, then `kill()` after `cancelGraceMs` (3000). `split-lines` → `parse-progress-line` → `replay-progress` (per-step drift = elapsed − offset).
- **Chromium install**: at startup the setup screen calls `ensureBrowser`. `isInstalled` = `existsSync(chromium.executablePath())`. `install` spawns `process.execPath [<playwright cli resolved via createRequire>, 'install', 'chromium']` and streams the lines. Failure → manual command `pnpm exec playwright install chromium`. On Linux, a launch error containing "missing dependencies" → hint `sudo pnpm exec playwright install-deps chromium`. The app never escalates privileges itself.
- **Storage**: `<packageRoot>/recordings/<slug>/{recording.json, script.mjs, files/}` (gitignored). Slug = NFKD, strip diacritics, `[^a-z0-9]+`→`-`, trim, ≤ 60 chars, fallback `recording`, collisions `-2`, `-3`; validated `^[a-z0-9]+(-[a-z0-9]+)*$` and the resolved path is asserted to stay inside the root. Atomic write: temp `<file>.<pid>.<rand>.tmp` in the same directory, `fsync`, `rename`; on Windows `EPERM`/`EBUSY`, retry 5× with 20 ms backoff. Writes are serialised per slug. Rename: move the directory (fails if the target exists), rewrite JSON, regenerate the script. Invalid JSON is listed as `invalid` instead of crashing.

## TUI

Store = pure `app-reducer(state, action)`. `keymap(state, key) → Intent | null` (pure). `tui-controller` executes intents against `AppServices` and dispatches result actions. `frame-scheduler` renders on change (coalesced with `queueMicrotask`) plus a 250 ms tick on the recording/replay screens and a 2 s library refresh. `render-app(state, size) → string[]`, written as cursor-home + per-line `\x1b[K`. Alternate screen and hidden cursor are restored on exit, SIGINT and uncaught errors. `NO_COLOR` is respected.

| Screen | Keys |
|---|---|
| setup | install progress; Enter retry, q quit |
| main-menu | ↑↓/j k, Enter (New recording, Library, Quit), q |
| new-recording | Tab/↑↓ switch field, text editing (←→, Backspace, Ctrl+U), Enter start, Esc back; validates name (1–80, no control chars) and URL (http/https or empty) |
| recording | live timeline (auto-follow), elapsed time, event count, password flag; dialog banner a/d/text+Enter; s stop and save, x discard (y/n); closing the browser = stop |
| library | list (name, created, duration, steps, invalid); Enter/p replay, t timeline, r rename (inline), d delete (y/n), n new, Esc |
| timeline | scrollable events with offsets and gaps; ↑↓ PgUp PgDn, Esc |
| replay | steps ✓ / ▶ / ·, drift per step, status and error; c/Esc cancel, Esc back when finished |

## Tooling (copy plan)

| File | Action |
|---|---|
| `.prettierrc`, `.github/dependabot.yml`, `.github/release.yml`, `scripts/install-hooks.ts`, `scripts/lib/script-runtime.ts`, workflows `codeql.yml`, `delete-cache`, `dependabot-auto-merge`, `dependabot-recreate-on-conflict`, `auto-merge-required-qa` | Verbatim |
| `.npmrc` | Drop `node-linker=hoisted` and its comment; everything else verbatim |
| `package.json` | name `browser-recorder`, `packageManager: pnpm@10.34.4`, engines node `>=22.13.0`, `bin`, `type: module`, `onlyBuiltDependencies: ["lefthook"]`, `commitlint.extends`; scripts: start, build, test, test:watch, test:coverage, lint, lint:strict, format, format:check, deadcode, deps:check, typecheck (node + in-page + tests), quality, audit, postinstall |
| `tsconfig.base.json` | + `erasableSyntaxOnly` |
| `tsconfig.node.json` / `tsconfig.tests.json` | Paths removed; `outDir: dist`; in-page excluded |
| `tsconfig.in-page.json` | New: `lib: [ES2023, DOM]`, `types: []`, noEmit |
| `.gitignore`, `.prettierignore` | + `recordings/`, `dist/`, `*.tmp` |
| `lefthook.yml` | pre-commit: prettier on staged files (`stage_fixed`), `lint:strict`, `typecheck`, `build`. commit-msg: `pnpm exec commitlint --edit {1}`. pre-push: `format:check`, `test:coverage`, `deadcode`, `deps:check`, `pnpm audit --audit-level=moderate` |
| `ci.yml` | Matrix ubuntu-latest / macos-15 / windows-latest (`fail-fast: false`): frozen install; cache ms-playwright; `playwright install chromium` (`--with-deps` on ubuntu); typecheck + authored-JS policy; quality gates; `test:coverage`; build. Audit runs on ubuntu only. Electron jobs dropped |
| `release.yml` (workflow) | Keep `detect`; drop build-*/assemble; `publish` creates tag + `gh release create --generate-notes` with **no assets**, and verifies an empty asset set |
| `release-validation.yml` | One ubuntu job: audit, release-policy tests, build, release plan |
| `auto-release`, `release-auto-merge`, `version-bump`, `release-impact-label` | Repo guard → `juanjoGonDev/browser-recorder`; package name; `pack` → `build`. Secrets `REPOSITORY_AUTOMATION_TOKEN`, `PAT_FINE`, `GITHUB_TOKEN` and environment `admin` unchanged |
| `scripts/release-impact-policy.ts` | Prefixes `['src/']`; exact paths: `.npmrc`, `scripts/build.ts`, `scripts/lib/script-runtime.ts`, `tsconfig.{base,node,in-page}.json`; non-shipping list + `@commitlint/`, − `jsdom` |
| `scripts/build.ts` | New: `tsc -p tsconfig.node.json` + esbuild IIFE bundle of the in-page entry |
| `AGENTS.md` | devbar sections + SDD always, no budget, single PR, autonomous, strict TDD, SOLID, parallel worktrees sized `max(1, min(6, floor(freeGiB / 3)))` under `../browser-recorder-worktrees/`, merged back then `git worktree remove`, never push. `CLAUDE.md` = `@AGENTS.md` |

**ESLint** (`strictTypeChecked`, typed files `src/scripts/tests`, in-page parsed with `tsconfig.in-page.json`):

| Rule | Setting |
|---|---|
| `@typescript-eslint/naming-convention` | default camelCase; typeLike PascalCase, no `^I[A-Z]` prefix; const globals camelCase or UPPER_CASE; boolean variables/properties prefixed `is/has/should/can/did/was/will`; quoted properties exempt; leading `_` only for unused parameters |
| `unicorn/filename-case` | `kebabCase` (only unicorn rule enabled) |
| `max-lines-per-function` | 40 (skip blanks/comments); off in tests |
| `max-lines` | 300 src / 800 tests |
| `complexity` | 10 |
| `max-depth` | 3 |
| `max-params` | 3 |
| `max-nested-callbacks` | 3 |
| Others | `switch-exhaustiveness-check`, `explicit-module-boundary-types`, `consistent-type-imports`, `no-floating-promises` on, `no-console` error in src; devbar vitest layout rules verbatim |

**knip**: entries `src/main.ts`, `src/recording-capture/in-page/capture-script.ts`, `scripts/*.ts`, `tests/**/*.test.ts`.

**dependency-cruiser**: devbar's 4 rules, `tsPreCompilationDeps: true`, plus:

| Rule | Forbids |
|---|---|
| `no-cross-feature` | `^src/([^/]+)/` → `^src/` unless `^src/($1\|shared)/`; `main.ts` and `composition/` exempt |
| `domain-pure` | `/domain/` → application, adapters, in-page, core or npm modules |
| `application-no-io` | `/application/` → adapters, core or npm modules |
| `playwright-in-adapters` | `playwright` imported outside `/adapters/` and `composition/` |
| `in-page-sealed` | anything outside `in-page/` → `in-page/`; `in-page/` → anything except `in-page/`, `recording-capture/domain/`, `shared/domain/` |
| `render-pure` | `tui/render/` → application or adapters |
| `no-orphans` | error |

**Coverage**: per-file statements and lines ≥ 85; global branches ≥ 80 and functions ≥ 85. Excluded: `src/main.ts`, type-only files (`**/ports/*.ts`, `recording-event.ts`, `locator.ts`, `recording.ts`, `captured-event.ts`, `app-state.ts`, `app-action.ts`, `intent.ts`) and `src/recording-capture/in-page/**`, which runs in Chromium and is covered by integration tests.

## Dependencies (exact pins)

Runtime: `playwright` (latest version older than 3 days at scaffold time). Dev, devbar versions: `typescript 6.0.3`, `vitest 5.0.1`, `@vitest/coverage-v8 5.0.1`, `@vitest/eslint-plugin 1.6.27`, `eslint 10.11.0`, `typescript-eslint 8.70.1`, `jiti 2.7.0` (loads `eslint.config.ts`), `prettier 3.9.8`, `knip 6.37.0`, `dependency-cruiser 18.4.0`, `lefthook 2.1.14`, `esbuild 0.28.2`. Dev, newly resolved at scaffold time: `@types/node` 22.x, `eslint-plugin-unicorn`, `@commitlint/cli`, `@commitlint/config-conventional`. Rejected: ink, blessed, chalk, string-width, zod, execa, tsx, jsdom/happy-dom (DOM code is tested in real Chromium), eslint-plugin-sonarjs.

## Work Packages (parallel worktrees)

| WP | Scope (owns these paths only) | Depends on |
|---|---|---|
| WP0 (main, first) | All tooling/CI/docs/scripts; `src/shared/domain/*`, every `ports/*.ts`, `captured-event.ts`, `tui/domain/app-state.ts`, `intent.ts`, `app-action.ts`; test support | — |
| WP1 | `recording-capture/domain/*` (minus types), `application/recording-session.ts` | WP0 |
| WP2 | `recording-capture/in-page/**`, `recording-capture/adapters/**`, chromium integration tests | WP0 (uses WP1's pure helpers only through domain imports; stub until merge) |
| WP3 | `script-generation/**` | WP0 |
| WP4 | `script-library/**` | WP0 |
| WP5 | `replay/**`, `environment-setup/**` | WP0 |
| WP6 | `tui/**` against a fake `AppServices` | WP0 |
| WP7 (main, last) | `src/main.ts`, `src/composition/**`, e2e roundtrip, README, SECURITY | WP1–WP6 |

Contract changes are made only on main as a separate commit; the affected worktrees then rebase. WP2 needs `select-hover-targets`, `should-record-key`, `is-dynamic-id` and `filter-stable-classes`: merge WP1 first, or move those four files into WP2's scope if they run concurrently.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | All `domain/*`, reducer, keymap, renderers (snapshot of lines), controller with fakes, progress parser, slugify, codegen (golden scripts) | Vitest, fake clock/timers, no IO |
| Integration | FS repository (temp dirs, atomic rename, Windows retry via injected fs), node spawner (fixture script), installer (fake CLI path), in-page script + Playwright adapter against `tests/fixtures/site` in headless Chromium, node-terminal with fake streams | Vitest; `globalSetup` builds the in-page bundle |
| E2E | Record (driven by Playwright trusted input, headless) → `generateScript` → spawn replay → assert `::step` order, final fixture state, every step drift ≤ 100 ms | `tests/e2e/record-replay-roundtrip.test.ts`, own timeout |

## Threat Matrix

| Boundary | Applicability | Design response | Planned RED tests |
|---|---|---|---|
| Documentation-like paths | N/A: the product classifies or executes no repository files | — | — |
| Git repository selection | N/A: no git automation in the product; `install-hooks.ts` copied verbatim with its tests | — | — |
| Commit state | N/A: same reason | — | — |
| Push state | N/A: never pushes; workflows copied with semantics intact | — | — |
| PR commands | N/A: workflow PR steps unchanged apart from the repo guard and package name | — | — |
| Replay subprocess (added) | Applicable | `process.execPath` + argument array, `shell: false`, script path from validated slug inside the root | Slug `../x`, `a/b`, `C:\x`, spaces → rejected; a path escaping the root → throws; spawn receives an args array with no shell |
| Generated-code injection (added) | Applicable | Every recorded string goes through `JSON.stringify` | URL, name, fill value, locator with `"`, `` ` ``, `${`, `\n`, `\u2028`, `*/` → generated script parses (`node --check`) and reproduces the exact value |
| Installer subprocess (added) | Applicable | Fixed argv, no sudo, manual command printed | Non-zero exit → `failed` with command; Linux missing-deps error → hint, no spawn of sudo |

## Migration / Rollout

No migration required. The repository is greenfield and nothing is pushed.

## Open Questions

- [x] Confirm that `playwright/cli` resolves through the package `exports`; otherwise resolve `playwright-core/cli.js`. Outcome (WP5): `playwright/cli` is not exported; `playwright/package.json` is, and its `bin` names the CLI.
- [x] Validate that headed Chromium with a `page.on('dialog')` listener does not show the native dialog. Outcome (WP2): it still shows it. The recorder prompt stays, and an answer given in the native dialog is recorded through the `dialog-closed` signal (see the WP7 addendum).
- [x] Reconcile the branch naming in AGENTS.md (devbar `feat/…` vs the owner's global branching policy). Outcome (WP0): `<type>/<slug>`.

## Addendum: no code in the page's main world (user decision, 2026-10-05)

Supersedes the injection parts of "In-page capture script" and the in-page
navigation classification above.

- Navigation, reload, back and forward are classified in Node from CDP
  (`Page.frameStartedNavigating.navigationType` plus
  `Page.getNavigationHistory().currentIndex`). No page code.
- Dialogs, popups, file choosers and page close come from Playwright events in
  Node. No page code.
- CDP has no event that observes user DOM interaction (`Input` only
  dispatches), so the listener bundle stays, but it runs only in a CDP isolated
  world (`Page.addScriptToEvaluateOnNewDocument` with `worldName`, and
  `Runtime.addBinding` with `executionContextName`), the same technique as
  Chrome's DevTools Recorder. The page's own scripts cannot see the binding or
  any recorder global, and the page's CSP does not apply to it.
- Forbidden on the recording path: `page.exposeBinding`, `exposeFunction`,
  `addInitScript` and `frame.evaluate` in the main world.

## Addendum: integration decisions (WP7)

Recorded when the work packages were merged; the names here are the ones the
code uses and the specs were reconciled to them.

- **Names.** `isSensitive`, `go-back` / `go-forward`, `wait-for-url`, `check`
  with `checked: boolean` (there is no `uncheck` kind), the 1000 ms action
  window (1500 ms for a redirect), a `fill` keeps the offset of its last input,
  saves are debounced by 250 ms, and the replay protocol is `::step <i> <ms>`,
  `::done <ms>`, `::error <i|-> <json>`.
- **Native dialogs.** The browser reports every closed dialog
  (`Page.javascriptDialogClosed`). One the recorder did not answer was answered
  in the browser window: the adapter emits `dialog-closed` (action and prompt
  text), the session clears the pending dialog and records the same `dialog`
  event the recorder prompt would have.
- **Cross-origin iframes.** A cross-site iframe lives in its own process and
  its own CDP target. The adapter asks Playwright for that frame's session
  (`context.newCDPSession(frame)`, which only succeeds for such frames) and
  installs the same isolated-world capture in it, so there is still no code in
  the page's main world. `Target.setAutoAttach` with `waitForDebuggerOnStart`
  was rejected: Playwright's `CDPSession` cannot address the child session it
  creates, so the paused frame could never be resumed (a reload hung in a
  probe). Frame paths are resolved across sessions, each iframe selector asked
  of the session that holds its parent.
- **Composition.** `src/composition/create-app-services.ts` adapts the use
  cases to `AppServices` and adds `persistActiveRecording()`;
  `create-production-services.ts` is the only place real adapters are built;
  `exit-after-saving.ts` makes SIGINT, SIGTERM and crashes save the live
  recording before exiting (bounded by a deadline). A discarded recording
  removes its whole `recordings/<slug>/` folder. `StartRecordingDeps` gained an
  optional `isHeadless` (default headed) so automation and tests never open a
  window.
- **Linux hint.** The printed command is `sudo pnpm exec playwright install-deps
  chromium`, with `playwright install --with-deps chromium` as the alternative.

## Addendum: verify remediation (2026-10-05)

- **Replay scrolls from an isolated world.** The generated runtime has no code
  in the page's main world either. `rt.scrollTo(page, chain, [x, y])` receives
  one locator per nesting level (each iframe element, then the target). Playwright
  itself (utility world) proves the element is attached and yields its child-index
  path per document (`xpath=ancestor-or-self::*[n]/preceding-sibling::*` counts);
  a CDP session of the page, or of the deepest out-of-process frame on the
  chain, creates an isolated world for the root frame and a single
  `Runtime.callFunctionOn` walks the index paths (through `contentDocument` for
  same-process iframes) and calls `scrollTo({ left, top, behavior: 'instant' })`.
  Elements inside a shadow tree are refused with a clear error (an XPath never
  crosses a shadow boundary). The element wait defaults to 10 s.
- **Setup failure keeps the library.** `EnsureBrowserResult` `failed` gained
  `exitCode: number | null` (additive). After a failed setup the app state has
  `isBrowserAvailable: false`: the setup screen offers `l` for the library, the
  main menu greys out New recording, and replay and new recording from the
  library are refused inline with the reason; list, rename, delete and timeline
  work as usual. A successful retry restores everything.
- **Hover coalescing.** A hover directly before a click, dblclick, check, fill
  or select-option on the same target is dropped. In the page, the label of the
  control being used counts as the same target (hovering the label is hovering
  the control), so `getByLabel(...).check()` records only the check.
