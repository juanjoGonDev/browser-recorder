# Design: Browser engine and profiles

## Technical Approach

Patchright `1.63.0` replaces Playwright everywhere through a type-identical import swap. Recording and replay switch from `launch()` + `newContext()` to `launchPersistentContext(userDataDir, …)`. The user data directory comes from a profile mode (`managed`, `copy-of-real`, `ephemeral`), and the executable comes from a per-OS browser catalogue. Two new features follow the existing screaming + hexagonal layout: `src/browser-selection/` and `src/browser-profiles/`. They never import each other or any other feature. Only `src/composition/` combines them into a plain-data `LaunchTarget` for the recorder, and into environment variables for the generated script. The capture adapter stops sending `Runtime.enable`. It maps binding calls to frames with `Page.createIsolatedWorld` (an idempotent lookup per frame) instead of `Runtime.executionContextCreated`. This design is deliberately longer than the 800-word budget: the caller asked for exact files and contracts.

## Architecture Decisions

| Topic | Options | Tradeoff | Decision |
|---|---|---|---|
| Frame-to-world mapping without `Runtime.enable` | (a) keep `addScriptToEvaluateOnNewDocument(worldName)`, look up the context id with `Page.createIsolatedWorld({frameId, worldName})`, which Blink reuses for an existing world name; (b) inject per frame on `Page.frameNavigated` with `createIsolatedWorld` + `Runtime.evaluate`; (c) long-poll the world with `Runtime.callFunctionOn({awaitPromise})` instead of a binding | (a) keeps document-start coverage and today's binding; (b) leaves a gap before injection; (c) avoids depending on binding delivery but keeps one call always pending | **(a)**, validated by spike S0. If S0 shows that `Runtime.bindingCalled` is not delivered without `Runtime.enable`, switch the transport to **(c)** inside `isolated-world-capture.ts` only (same `CaptureWorld` contract). If S0 shows that the world is not reused, switch to (b). **S0 result: (a) is not viable and the transport is (b); see the S0 addendum** |
| Unknown context id in `bindingCalled` | drop / refresh | A click right after a navigation can arrive before the lookup | On a miss: refresh every frame from `Page.getFrameTree`, then look up again; drop the message if it is still unknown |
| Viewport | fixed emulated `1280x800` / `viewport: null` + `--window-size` | Emulated metrics are a fingerprint (inner and outer sizes disagree); a native window makes the viewport vary by browser UI | New recordings: `display: {kind:'window',1280,800}` → `viewport: null`, `--window-size=1280,800`. v1 recordings migrate to `{kind:'emulated',…}` so their recorded scroll coordinates still apply |
| Where the script gets its browser | bake paths into `script.mjs` / environment variables set by replay | Baked paths are machine-specific and leak home paths into a portable file | Environment: `BROWSER_RECORDER_EXECUTABLE_PATH`, `_USER_DATA_DIR`, `_BROWSER_ARGS` (JSON), `_REAL_KEYCHAIN`. Composition always sets all four (an empty value means unset) to override any inherited values. A standalone run uses bundled Chromium and a temporary profile. The header comment names the recorded browser and mode |
| Copy filter | allowlist of login stores / denylist of locks and caches | Logins live in Cookies, `Network/Cookies`, IndexedDB, Local Storage and Service Worker storage, and the layout changes between Chromium versions | Denylist, applied inside the chosen profile only. The copy holds just `Local State` plus that profile directory |
| Copy lifetime | reuse / fresh per launch | A reused copy goes stale and holds personal data on disk for longer | Fresh copy in `sessions/<random>`, deleted on release; leftovers swept at startup |
| Default arguments | keep Playwright's / drop some | `--use-mock-keychain` (macOS) and `--password-store=basic` (Linux) stop the browser from decrypting real cookies | `copy-of-real` only: `ignoreDefaultArgs` holds those two. Managed and ephemeral profiles keep them (no keychain prompts). No other custom arguments, as Patchright recommends |
| Lock detection | launch and wait / probe first | Chromium hands a locked directory over to the running instance and the launch fails or hangs | Probe first (`SingletonLock` symlink `host-pid` on POSIX, existence of `lockfile` on Windows). A matching launch error is also mapped to `ProfileInUseError`. Launch timeout 30 s |
| Old scripts import `playwright` | migrate on load / regenerate before every replay | Without regeneration, a v1 `script.mjs` breaks once Playwright is gone | `library.regenerateScript(slug)` writes only `script.mjs` before every replay. `recording.json` is upgraded to v2 only by a later save (for example a rename) |
| `sourceProfile` from `recording.json` | trust it / revalidate it | The recording file is data and may be edited | Accepted only if it matches `SAFE_PROFILE_DIR` and is listed in the current `Local State` |
| Opera | full support / managed and ephemeral only | Opera's user data directory is itself the profile (no `Default` folder) | `userDataDir: null` in the table: `copy-of-real` is not offered |
| Install scripts | allow Patchright's / do not | Browsers are installed by our own installer | `onlyBuiltDependencies` stays `["lefthook"]` |

## Data Flow

    TUI new-recording --BrowserChoice--> composition/browser-launch-plan
       |                                   |-- BrowserCatalog.find(id)       -> executablePath
       |                                   |-- ProfileStore.prepare(...)     -> userDataDir, args, warnings, release
       |                                   v
       |                         LaunchTarget --> startRecording --> PatchrightBrowserLauncher
       |                                              (Recording.browser = choice)   launchPersistentContext
       v                                                                              |
    replay: regenerateScript -> plan.forReplay(recording.browser) -> env -> node script.mjs -> openContext(env)
                                (fallback to bundled + warning)          release() once the replay ends

## File Changes

| File | Action | Description |
|---|---|---|
| `package.json` | Modify | `patchright: 1.63.0` replaces `playwright`; description says Patchright |
| `src/shared/domain/browser-choice.ts` | Create | `BrowserId`, `ProfileMode`, `BrowserChoice` |
| `src/shared/domain/recording.ts` | Modify | `schemaVersion: 2`, `display`, `browser`; `viewport` removed |
| `src/browser-selection/domain/browser-catalog-table.ts` | Create | Per-OS candidate tables |
| `src/browser-selection/domain/expand-path.ts` | Create | Fills in `{home}`, `{localAppData}`, `{appData}`, `{programFiles}`, `{programFilesX86}`, `{xdgConfigHome}` |
| `src/browser-selection/domain/resolve-replay-browser.ts` | Create | Fallback rule |
| `src/browser-selection/application/ports/file-probe.ts` | Create | Port |
| `src/browser-selection/application/browser-catalog.ts` | Create | `createBrowserCatalog` |
| `src/browser-selection/adapters/node-file-probe.ts` | Create | `fs.stat`; `X_OK` on POSIX |
| `src/browser-profiles/domain/profile-layout.ts` | Create | `appDataRootFor`, `profileLayout` |
| `src/browser-profiles/domain/parse-local-state.ts` | Create | Profiles and app-bound encryption flag |
| `src/browser-profiles/domain/copy-filter.ts` | Create | Denylist, SQLite companions |
| `src/browser-profiles/domain/singleton-lock.ts` | Create | Parses `host-pid` |
| `src/browser-profiles/domain/profile-errors.ts` | Create | `ProfileInUseError`, `ProfileCopyError` |
| `src/browser-profiles/application/ports/profile-file-system.ts`, `process-probe.ts` | Create | Ports |
| `src/browser-profiles/application/check-profile-lock.ts` | Create | Lock probe |
| `src/browser-profiles/application/copy-profile.ts` | Create | WAL-aware copy with retry |
| `src/browser-profiles/application/profile-store.ts` | Create | `createProfileStore` |
| `src/browser-profiles/adapters/node-profile-file-system.ts`, `node-process-probe.ts` | Create | Node IO |
| `src/recording-capture/application/ports/browser-launcher.ts` | Modify | `LaunchTarget`, `display` |
| `src/recording-capture/application/recording-session.ts` | Modify | Request gains `browser` and `target`; writes v2 |
| `src/recording-capture/domain/launch-arguments.ts` | Create | Pure: display + target → args, `ignoreDefaultArgs`, viewport |
| `src/recording-capture/domain/is-profile-in-use-error.ts` | Create | Launch error classifier |
| `src/recording-capture/adapters/playwright-browser-launcher.ts` → `patchright-browser-launcher.ts` | Rename/Modify | Persistent context; first page = `context.pages()[0]` |
| `src/recording-capture/adapters/playwright-browser-session.ts` → `patchright-browser-session.ts` | Rename/Modify | No `Browser`; end on context `close`; `close()` = `context.close()` |
| `src/recording-capture/adapters/isolated-world-capture.ts` | Modify | No `Runtime.enable`; lookup through `world-contexts` |
| `src/recording-capture/adapters/world-contexts.ts` | Create | Frame ↔ context map, filled on demand |
| `src/recording-capture/adapters/guarded-cdp.ts` | Create | Wraps every session we open; refuses the forbidden methods |
| `src/recording-capture/adapters/frame-path-resolver.ts`, `page-wiring.ts`, `out-of-process-frames.ts`, others | Modify | Async `contextOf`; `guardCdp`; imports from `patchright` |
| `src/script-generation/domain/generate-script.ts`, `script-prelude.ts` | Modify | `patchright` import, `openContext(display)` |
| `src/script-library/domain/parse-recording.ts` | Modify | Reads v1 and v2; migrates v1 |
| `src/script-library/application/library-service.ts`, `ports/recording-repository.ts`, `adapters/file-system-recording-repository.ts` | Modify | v2 draft, `regenerateScript`, `writeScript` |
| `src/replay/application/replay-runner.ts` | Modify | Request gains `launchEnv` |
| `src/environment-setup/adapters/playwright-browser-installation.ts` → `patchright-browser-installation.ts`; `resolve-playwright-cli.ts` → `resolve-patchright-cli.ts` | Rename/Modify | `patchright` / `patchright-core` bins |
| `src/environment-setup/application/ensure-browser.ts`, `domain/linux-deps-hint.ts` | Modify | Commands say `patchright` |
| `src/tui/domain/{app-state,app-views,intent,app-action,keymap,reduce-*}.ts`, `src/tui/render/screens/{new-recording,recording,replay,setup}-screen.ts`, `src/tui/application/{recording-flow,tui-controller}.ts`, `ports/app-services.ts` | Modify | Pickers, warnings |
| `src/composition/browser-launch-plan.ts` | Create | Planner + `toReplayEnvironment` |
| `src/composition/browser-views.ts` | Create | Catalogue + profiles → TUI views |
| `src/composition/create-app-services.ts`, `create-production-services.ts`, `resolve-paths.ts` | Modify | Wiring, `appDataRoot`, startup sweep |
| `.dependency-cruiser.json`, `eslint.config.ts`, `knip` config, `.github/workflows/ci.yml`, `README.md` | Modify | See Tooling |
| `tests/support/isolated-home.ts` | Create | Vitest `globalSetup` |
| `tests/fixtures/profiles/brave-like/**` | Create | `Local State`, `Default/{Preferences,Cookies,Cookies-wal,Cache/x}`, `Profile 1/…` |

## Interfaces / Contracts (frozen in WP0)

```ts
// shared/domain/browser-choice.ts
export const BROWSER_IDS = ['brave','chrome','edge','chromium','vivaldi','opera','bundled'] as const;
export type BrowserId = (typeof BROWSER_IDS)[number];
export type ProfileMode = 'managed' | 'copy-of-real' | 'ephemeral';
export interface BrowserChoice { readonly browserId: BrowserId; readonly profileMode: ProfileMode;
  /** "Default" | "Profile 2"…; non-null only for copy-of-real. */ readonly sourceProfile: string | null }
// shared/domain/recording.ts
export interface Display { readonly kind: 'window' | 'emulated'; readonly width: number; readonly height: number }
export interface Recording { readonly schemaVersion: 2; /* name…durationMs unchanged */
  readonly display: Display; readonly browser: BrowserChoice; readonly events: readonly RecordingEvent[] }

// browser-selection
export type Platform = 'darwin' | 'win32' | 'linux';
export interface BrowserCandidate { readonly browserId: Exclude<BrowserId,'bundled'>; readonly label: string;
  readonly executables: readonly string[]; readonly userDataDir: string | null }  // templates
export const BROWSER_TABLES: Readonly<Record<Platform, readonly BrowserCandidate[]>>;
export interface PathRoots { readonly home: string; readonly localAppData: string | null; readonly appData: string | null;
  readonly programFiles: string | null; readonly programFilesX86: string | null; readonly xdgConfigHome: string | null }
export function expandPath(template: string, roots: PathRoots): string | null; // null: a root is missing
export interface FileProbe { isFile(path: string): Promise<boolean>; isDirectory(path: string): Promise<boolean> }
export interface InstalledBrowser { readonly browserId: BrowserId; readonly label: string;
  readonly executablePath: string | null /* null = bundled */; readonly userDataDir: string | null /* null = no copy-of-real */ }
export interface BrowserCatalog { list(): Promise<readonly InstalledBrowser[]>; find(id: BrowserId): Promise<InstalledBrowser | null> }
export function createBrowserCatalog(deps: { probe: FileProbe; platform: string; roots: PathRoots;
  isBundledInstalled: () => Promise<boolean> }): BrowserCatalog; // table order, bundled last; unknown OS → bundled only
export type ReplayBrowser = { readonly kind: 'as-recorded'; readonly choice: BrowserChoice }
  | { readonly kind: 'fallback'; readonly choice: BrowserChoice; readonly missing: BrowserId };
export function resolveReplayBrowser(recorded: BrowserChoice, isAvailable: (id: BrowserId) => boolean): ReplayBrowser;
// fallback: bundled; managed stays managed (bundled's own managed directory); copy-of-real → ephemeral

// browser-profiles
export function appDataRootFor(platform: string, env: Readonly<Record<string, string | undefined>>, home: string): string;
//   darwin ~/Library/Application Support/browser-recorder | win32 %LOCALAPPDATA%\browser-recorder (fallback ~\AppData\Local)
//   else ${XDG_DATA_HOME:-~/.local/share}/browser-recorder
export interface ProfileLayout { managedDir(id: BrowserId): string;  // <root>/profiles/<id>/managed
  sessionsRoot(id: BrowserId): string }                               // <root>/profiles/<id>/sessions (copies + ephemerals)
export const SAFE_PROFILE_DIR: RegExp; // /^(?:Default|Profile \d{1,4})$/ (Chromium's only user profile names)
export interface RealProfile { readonly directory: string; readonly displayName: string }
export interface LocalStateInfo { readonly profiles: readonly RealProfile[]; readonly hasAppBoundEncryption: boolean }
export function parseLocalState(text: string): LocalStateInfo; // profile.info_cache, sorted by profile.profiles_order
export function shouldCopy(segments: readonly string[]): boolean;
export const SQLITE_COMPANIONS: readonly ['-wal', '-journal'];
export type LockState = { readonly kind: 'free' } | { readonly kind: 'locked'; readonly pid: number | null };
export interface DirEntry { readonly name: string; readonly kind: 'file' | 'directory' | 'symlink' | 'other' }
export interface FileStamp { readonly size: number; readonly mtimeMs: number }
export interface ProfileFileSystem {
  makePrivateDir(path: string): Promise<void>;   // mkdir -p, then chmod 0o700 (POSIX)
  readText(path: string): Promise<string>; list(dir: string): Promise<readonly DirEntry[]>; // lstat kinds
  stamp(path: string): Promise<FileStamp | null>; readLink(path: string): Promise<string | null>;
  exists(path: string): Promise<boolean>;
  copyFile(from: string, to: string): Promise<void>;  // COPYFILE_EXCL; source opened read-only
  remove(path: string): Promise<void>; randomName(): string }
export interface ProcessProbe { hostname(): string; isAlive(pid: number): boolean } // kill(pid,0); EPERM = alive
export type ProfileWarning = { readonly code: 'source-running' } | { readonly code: 'app-bound-encryption' }
  | { readonly code: 'unstable-copy'; readonly files: readonly string[] };
export interface PrepareProfileRequest { readonly browserId: BrowserId; readonly profileMode: ProfileMode;
  readonly sourceProfile: string | null; readonly realUserDataDir: string | null }
export interface PreparedProfile { readonly userDataDir: string; readonly browserArgs: readonly string[];
  readonly shouldUseRealKeychain: boolean; readonly warnings: readonly ProfileWarning[]; release(): Promise<void> }
export interface ProfileStore {
  listRealProfiles(realUserDataDir: string): Promise<LocalStateInfo | null>; // null: missing/unreadable Local State
  prepare(request: PrepareProfileRequest): Promise<PreparedProfile>;          // throws ProfileInUseError | ProfileCopyError
  sweepStaleSessions(): Promise<void> }
export function createProfileStore(deps: { fs: ProfileFileSystem; processes: ProcessProbe; platform: string;
  layout: ProfileLayout; sleep: (ms: number) => Promise<void> }): ProfileStore;
export class ProfileCopyError extends Error { readonly code: 'source-in-use' | 'source-missing' | 'unknown-profile' }

// recording-capture/application/ports/browser-launcher.ts
export interface LaunchTarget { readonly executablePath: string | null; readonly userDataDir: string;
  readonly browserArgs: readonly string[]; readonly shouldUseRealKeychain: boolean }
export interface LaunchOptions { readonly startUrl: string | null; readonly display: Display;
  readonly isHeadless: boolean; readonly target: LaunchTarget }
// StartRecordingRequest += { browser: BrowserChoice; target: LaunchTarget }
// recording-capture/adapters/isolated-world-capture.ts
export interface CaptureWorld { contextOf(frameId: string): Promise<number | undefined> }

// replay: StartReplayRequest += { launchEnv: Readonly<Record<string, string>> }
// script-library: RecordingRepository += writeScript(slug, scriptMjs); LibraryService += regenerateScript(slug): Promise<Recording>
// tui
export interface ProfileOptionView { readonly choice: BrowserChoice; readonly label: string; readonly note: string | null }
export interface BrowserOptionView { readonly browserId: BrowserId; readonly label: string; readonly profiles: readonly ProfileOptionView[] }
// AppServices += browsers: { list(): Promise<readonly BrowserOptionView[]> };
// recording.start(request: NewRecordingRequest & { browser: BrowserChoice });
// LiveRecordingView/LiveReplayView += warnings: readonly string[]; EnvironmentView.ready += browsers: readonly string[]
// composition/browser-launch-plan.ts
export interface LaunchPlan { readonly choice: BrowserChoice; readonly target: LaunchTarget;
  readonly warnings: readonly string[]; release(): Promise<void> }
export function createLaunchPlanner(deps: { catalog: BrowserCatalog; profiles: ProfileStore }):
  { forRecording(choice: BrowserChoice): Promise<LaunchPlan>; forReplay(recorded: BrowserChoice): Promise<LaunchPlan> };
export function toReplayEnvironment(target: LaunchTarget): Readonly<Record<string, string>>;
```

### Browser tables (executable candidates; data directory)

| Id | darwin (`/Applications` then `{home}/Applications`) | win32 (`{programFiles}`, `{programFilesX86}`, `{localAppData}`) | linux |
|---|---|---|---|
| brave | `Brave Browser.app/Contents/MacOS/Brave Browser`; `{home}/Library/Application Support/BraveSoftware/Brave-Browser` | `BraveSoftware\Brave-Browser\Application\brave.exe`; `{localAppData}\BraveSoftware\Brave-Browser\User Data` | `/usr/bin/brave-browser`, `/usr/bin/brave`, `/opt/brave.com/brave/brave`; `{xdgConfigHome}/BraveSoftware/Brave-Browser` |
| chrome | `Google Chrome.app/…/Google Chrome`; `…/Google/Chrome` | `Google\Chrome\Application\chrome.exe`; `{localAppData}\Google\Chrome\User Data` | `/usr/bin/google-chrome-stable`, `/usr/bin/google-chrome`, `/opt/google/chrome/chrome`; `{xdgConfigHome}/google-chrome` |
| edge | `Microsoft Edge.app/…/Microsoft Edge`; `…/Microsoft Edge` | `Microsoft\Edge\Application\msedge.exe`; `{localAppData}\Microsoft\Edge\User Data` | `/usr/bin/microsoft-edge-stable`, `/opt/microsoft/msedge/msedge`; `{xdgConfigHome}/microsoft-edge` |
| chromium | `Chromium.app/…/Chromium`; `…/Chromium` | `{localAppData}\Chromium\Application\chrome.exe`; `{localAppData}\Chromium\User Data` | `/usr/bin/chromium`, `/usr/bin/chromium-browser`; `{xdgConfigHome}/chromium` |
| vivaldi | `Vivaldi.app/…/Vivaldi`; `…/Vivaldi` | `{localAppData}\Vivaldi\Application\vivaldi.exe`; `{localAppData}\Vivaldi\User Data` | `/usr/bin/vivaldi-stable`, `/opt/vivaldi/vivaldi`; `{xdgConfigHome}/vivaldi` |
| opera | `Opera.app/…/Opera`; none | `{localAppData}\Programs\Opera\opera.exe`; none | `/usr/bin/opera`; none |

`{xdgConfigHome}` defaults to `{home}/.config`. Snap and Flatpak builds are not listed (their sandboxes refuse a user data directory outside the sandbox).

### Profile store rules

- **managed**: `makePrivateDir(managedDir)`; lock check → `ProfileInUseError`; `browserArgs: []`; mock keychain kept; `release` is a no-op.
- **ephemeral**: `sessionsRoot/<random>`, private; `release` removes it (5 retries, 100 ms apart, for Windows `EBUSY`).
- **copy-of-real**: `sourceProfile` must match `SAFE_PROFILE_DIR` and appear in `Local State`, otherwise `unknown-profile`. A locked source only adds the `source-running` warning. On win32, `hasAppBoundEncryption` adds `app-bound-encryption`. The copy holds `Local State` and the profile directory, walked through `list()`. Symlinks and `other` entries are skipped, and so is anything `shouldCopy` rejects. Every database is copied together with its `-wal` and `-journal` files, stamped before and after; a changed stamp or `EBUSY`/`EPERM` triggers a retry (3 attempts, 50/100/200 ms). After the retries a changed stamp becomes an `unstable-copy` warning, while a still-busy file throws `source-in-use` ("close Brave and try again"), the destination is removed first. Result: `--profile-directory=<dir>`, `shouldUseRealKeychain: true`. Every destination and every `remove` must resolve inside `profiles/*/sessions/`; the real directory never appears as a destination.
- **Denylist** (names): `SingletonLock SingletonSocket SingletonCookie lockfile LOCK Cache "Code Cache" GPUCache DawnCache DawnGraphiteCache DawnWebGPUCache GrShaderCache GraphiteDawnCache ShaderCache CacheStorage ScriptCache Crashpad "Crash Reports" BrowserMetrics component_crx_cache optimization_guide_model_store "Safe Browsing" Sessions "Current Session" "Current Tabs" "Last Session" "Last Tabs" blob_storage`. Suffixes: `-shm .tmp .pma`.
- **Lock**: POSIX `readLink(dir/SingletonLock)` → `host-pid`. Another host counts as locked; a dead pid is a stale lock and counts as free. win32: an existing `dir/lockfile` counts as locked (Chromium deletes it on close).

### Capture without `Runtime.enable`

`attachCapture` sends `Page.enable`, `Runtime.addBinding({name, executionContextName: WORLD_NAME})` and `Page.addScriptToEvaluateOnNewDocument({worldName, runImmediately: true})`, and listens to `Runtime.bindingCalled`. `world-contexts.ts` keeps `frameId ↔ contextId` maps, fills them with `Page.createIsolatedWorld({frameId, worldName: WORLD_NAME})` on demand, and drops entries on `Page.frameNavigated` (new document) and `Page.frameDetached`. `frame-path-resolver` awaits `contextOf(parentId)`. `guardCdp(session)` wraps every session from `newCDPSession` and throws `ForbiddenCdpMethodError` when the method is `${domain}.enable` with domain `Runtime` or `Console` (built from a constant, so no forbidden literal appears in `src`). The replay prelude already uses only `Page.createIsolatedWorld` + `Runtime.callFunctionOn`.

### Launch (recorder and prelude share the same rules, from `launch-arguments.ts`)

`chromium.launchPersistentContext(userDataDir, { headless, executablePath ?? undefined, viewport: display.kind === 'window' ? null : {width, height}, args: [...(window ? ['--window-size=W,H'] : []), ...browserArgs], ignoreDefaultArgs: realKeychain ? ['--use-mock-keychain', '--password-store=basic'] : undefined, timeout: 30_000 })`. No user agent, headers or `channel`. The prelude gains `openContext(display)` (reads the four variables, accepts only `--profile-directory=` arguments, uses `mkdtemp` when no user data directory is given, removes it in `close()`). The script uses `page1 = context.pages()[0] ?? await context.newPage()` and `finally { await close(); }`.

### TUI

New recording screen focus order: `name → url → browser → profile`. Tab and ↑↓ move between fields; on a picker, ←→ send a new intent `{kind:'cycle-option', delta}`; Enter starts (refused with "Detecting browsers…" while the list is still `null`). State adds `browsers: BrowserOptionView[] | null`, `browserIndex`, `profileIndex` (reset to 0 when the browser changes). Opening the screen loads `browsers.list()` (actions `browsers-loaded` / `browsers-failed`). The profile picker shows `Managed (keeps logins)`, `Copy of <displayName> (<directory>)` for each entry in `Local State` (Brave names included), and `Ephemeral (clean each time)`; the note line shows "Brave is running: the copy may miss its latest changes" or the app-bound warning. The recording and replay screens show `Brave · managed` and any warnings, including the fallback warning. A locked profile shows the error message inline. The setup screen lists the browsers it detected. Recording stays possible when bundled Chromium failed to install but another browser was detected.

## Tooling

- depcruise: `playwright-in-adapters` becomes `patchright-in-adapters` (`node_modules/patchright(-core)?/`); a new `no-playwright` rule forbids `node_modules/playwright(-core)?/` from anywhere.
- ESLint (applies to `src/**`): `no-restricted-imports` covers `playwright`, `playwright-core` and `@playwright/test`. The headless-literal `no-restricted-syntax` block (applies to all typed files) gains `Literal[value=/^(Runtime|Console)\.enable$/]`.
- knip: no new entries.
- CI: `pnpm exec patchright install chromium` (`--with-deps` on Ubuntu). The `ms-playwright` cache path stays the same (S0 confirms this).

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | Tables × 3 OS, `expandPath`, `resolveReplayBrowser`, `parseLocalState` (hostile names, missing `info_cache`, app-bound key), `shouldCopy`, `singleton-lock`, profile store (in-memory fs: retry, `EBUSY`, unstable copy, path refusals, release), `launch-arguments`, v1→v2 parse, golden scripts (window and emulated), keymap/reducer/renderers for the pickers, launch planner, `guardCdp` | Vitest, fakes |
| Integration (headless, default) | Node profile fs on temp dirs (0700 mode, symlinks skipped, **fixture source hash unchanged**); lock probe with a fake `SingletonLock` pointing at a live and a dead pid; capture suite on bundled Patchright Chromium; **`cdp-method-audit.test.ts`**: wraps `context.newCDPSession`, drives same-origin and cross-origin frames, navigation, a dialog and a scroll replay, and asserts the sent methods contain neither forbidden method; a managed login survives a second launch (cookie set by the fixture server); a `scriptPrelude` text scan | `tests/support/isolated-home.ts` pins `PLAYWRIGHT_BROWSERS_PATH`, then points `HOME`, `USERPROFILE`, `LOCALAPPDATA`, `APPDATA`, `XDG_*` at a temp dir |
| Opt-in real browser | Copy-of-real on Brave/Chrome from `tests/fixtures/profiles/brave-like`, a lock error, a replay | `describe.runIf(process.env.BROWSER_RECORDER_REAL_BROWSER_TESTS === '1')`; the source must resolve under `tests/fixtures/` (asserted); headless unless `BROWSER_RECORDER_HEADED_TESTS=1` |
| E2E | Existing roundtrip on Patchright with a v2 recording, plus a migrated v1 recording | Unchanged harness |

## Threat Matrix

| Boundary | Applicability | Design response | Planned RED tests |
|---|---|---|---|
| Documentation-like paths, git selection, commit, push, PR | N/A: the product runs no repository files and has no VCS or PR automation | — | — |
| Browser executable selection (added) | Applicable | Only table paths go to `executablePath`; nothing typed by the user and nothing from `recording.json` becomes a path | A recording with an unknown `browserId` falls back to bundled; a table entry pointing at a directory is not detected |
| Profile paths from `Local State` / `recording.json` (added) | Applicable | `SAFE_PROFILE_DIR` + listed in `Local State`; destinations and removals stay inside `sessions/` | `../x`, `Default/../..`, `C:\x`, an absolute path, `Guest Profile` → `unknown-profile`; a symlink inside the source is not followed; `remove` outside the root throws |
| Real profile read-only (added) | Applicable | `COPYFILE_EXCL`, read-only opens, no source destination | Fixture tree hash and modification times are unchanged after a copy, also after a failed copy |
| Replay subprocess and environment (modified) | Applicable | `shell: false`; all four variables set explicitly; the prelude accepts only `--profile-directory=` | Inherited `BROWSER_RECORDER_USER_DATA_DIR` is overridden; `["--remote-debugging-port=1"]` is ignored by the prelude |
| Installer subprocess (modified) | Applicable | Fixed argv `[cli, 'install', 'chromium']` through `patchright` | Bin resolution falls back to `patchright-core`; failure prints `pnpm exec patchright install chromium` |

## Migration / Rollout

`parseRecording` reads v1 recordings as `display {kind:'emulated', …viewport}` and `browser {bundled, ephemeral, null}`; v2 is required to have both fields. `script.mjs` is regenerated before every replay. Rollback: a v1 `recording.json` stays untouched until it is saved again. A v2 file is listed as `invalid` by the old version, which does not crash. The profile directories are tool-owned and can be deleted.

## Work Packages (parallel worktrees after WP0)

| WP | Owns | Depends on |
|---|---|---|
| WP0 (main, first) | Spike S0 (binding without `Runtime.enable`, world reuse, Patchright bin names and cache path, whether Patchright already drops `--use-mock-keychain`; outcomes recorded as an addendum here); dependency swap + mechanical import rename; every contract above (types, ports, views, intents, actions); minimal stubs so `pnpm quality` stays green; depcruise and ESLint rules; `isolated-home.ts`; profile fixtures | — |
| WP1 | `src/browser-selection/**` | WP0 |
| WP2 | `src/recording-capture/**` (capture, guard, launcher, session, launch arguments), CDP audit test | WP0 |
| WP3 | `src/browser-profiles/**` | WP0 |
| WP4 | `src/script-generation/**`, `src/script-library/**` | WP0 (the prelude copies the rules of `launch-arguments.ts`; parity golden test) |
| WP5 | `src/replay/**`, `src/environment-setup/**`, CI workflow | WP0 |
| WP6 | `src/tui/**` against fake `AppServices` | WP0 |
| WP7 (main, last) | `src/composition/**`, e2e, opt-in real-browser tests, README | WP1–WP6 |

## Open Questions

- [x] S0: `Runtime.bindingCalled` without `Runtime.enable`, and `Page.createIsolatedWorld` reusing the named world. Resolved: transport (b), see the S0 addendum.
- [x] S0: the `patchright-core` bin name; whether Patchright still adds `--use-mock-keychain`. Resolved: `patchright-core`, and yes it still adds both keychain switches; see the S0 addendum.
- [ ] Whether a Windows app-bound encrypted copy actually fails on Chrome, Brave and Edge. For now the design only warns, before launch; the opt-in test on Windows confirms.

## S0 Addendum: spike outcomes (WP0, Patchright 1.63.0, bundled Chromium, headless)

Every statement below is pinned by a headless test under `tests/spike/` (project `spike`), so a Patchright bump that changes one of them fails a test instead of the recorder.

| Question | Outcome | Test |
|---|---|---|
| Is `Runtime.bindingCalled` delivered without `Runtime.enable`? | **Yes, but only for a binding added to a world that already exists.** `Runtime.addBinding({name, executionContextName})` installs the function into every existing context with that name and calls reach our session. A binding added before the world of a new document exists is **not** installed in it | `runtime-binding.test.ts` |
| Does re-adding the binding work and stay single? | Yes. Calling `Runtime.addBinding` again with the same name installs it into the new context and does not duplicate delivery (one call, one event) | `runtime-binding.test.ts` |
| Does `Page.createIsolatedWorld` reuse a named world? | Yes, per document: the same `{frameId, worldName}` returns the same context id on repeated calls. A different name or a different frame gets another id. After a navigation the frame id stays and the context id is new (new document), again stable on repeat. The id in `bindingCalled.executionContextId` equals the id the lookup returned | `isolated-world-reuse.test.ts` |
| Does a document-start script (`Page.addScriptToEvaluateOnNewDocument` with `worldName`) work? | **Not reliably.** On Patchright it does not run in the main frame while our session has sent no `Runtime` command, and runs once any `Runtime` command was sent. That dependency is an engine quirk, not a contract, so the recorder must not depend on it | `document-start-script.test.ts` |
| Does a cross-origin (out-of-process) frame behave the same? | Yes: `context.newCDPSession(frame)` answers `Page.createIsolatedWorld`, accepts `Runtime.addBinding` and delivers `bindingCalled` on that session | `out-of-process-world.test.ts` |
| Does the real capture script work through the new transport? | Yes: look up the world, add the binding, `Runtime.evaluate` the bundled script in that context; a trusted click arrives as a parsed message tagged with that context, a second injection is a no-op, and the page's own world shows no recorder global | `injection-transport.test.ts` |
| Bin names | `patchright` has `bin.patchright = cli.js`; `patchright-core` has `bin.patchright-core = cli.js`. `patchright/cli` is not an exported subpath (use `package.json`, which is). `patchright-core` is not resolvable from this repository (strict pnpm layout), only from inside `patchright`; so `resolve-patchright-cli` tries `patchright/package.json` first | `patchright-install.test.ts` |
| Browser cache | Unchanged: `<cache>/ms-playwright` (`~/Library/Caches` on macOS, `$XDG_CACHE_HOME` or `~/.cache` on Linux, `%LOCALAPPDATA%` on Windows), overridable with `PLAYWRIGHT_BROWSERS_PATH`. The directory is computed from `os.homedir()` when the library loads, so `isolated-home.ts` must pin `PLAYWRIGHT_BROWSERS_PATH` **before** it redirects `HOME`. Chromium revision 1243 is the same as Playwright 1.63, so an existing cache is reused | `patchright-install.test.ts` |
| Default switches | Patchright **still adds `--use-mock-keychain` and `--password-store=basic`**, plus `--disable-blink-features=AutomationControlled`, and already ignores `--enable-automation`. The `copy-of-real` rule (`ignoreDefaultArgs` holds the two keychain switches) is therefore still required | `patchright-install.test.ts` |

### Decision: transport (b), per-frame injection (changes WP2 only)

The design's preferred transport (a) fails twice: the binding is not installed into a world created by a document-start script, and the document-start script itself is not dependable. Transport (c) is unnecessary because (b) works. `isolated-world-capture.ts` and `world-contexts.ts` (WP2) implement this; the `CaptureWorld.contextOf(frameId): Promise<number | undefined>` contract is unchanged.

1. On attach, send `Page.enable` only. Send **no** `Page.addScriptToEvaluateOnNewDocument`.
2. A frame is *prepared* by: `Page.createIsolatedWorld({frameId, worldName: WORLD_NAME})`, then `Runtime.addBinding({name: BINDING_NAME, executionContextName: WORLD_NAME})` (idempotent, installs into every existing context of that name), then `Runtime.evaluate({contextId, expression: scriptSource})`. The bundled script already guards against a second install.
3. Prepare every frame of `Page.getFrameTree` at attach, and a frame again on each `Page.frameNavigated` (its context id changed). Frames attached later arrive through `Page.frameNavigated` as well. Drop a frame's entry on `Page.frameNavigated` (before re-preparing) and on `Page.frameDetached`.
4. `bindingCalled.executionContextId` is looked up in the reverse map to find the frame. On a miss, re-prepare from `Page.getFrameTree`, look up again, then drop the message (as already designed).
5. Out-of-process frames keep their own session from `context.newCDPSession(frame)` and run the same steps against it.
6. Accepted gap: events between the commit of a document and the end of its preparation are not captured (milliseconds, before a person can interact). Preparing on `Page.frameNavigated` keeps it as short as the protocol allows without `Runtime.enable`.

### Consequences for other work packages

- Patchright's `page.evaluate`, `frame.evaluate` and `locator.evaluate` run in an isolated world by default (the third or fourth `isolatedContext` argument). Test helpers that read globals set by `addInitScript` pass `isolatedContext: false`; WP0 already updated `tests/support/in-page-probe.ts`, `scroll-listener.test.ts` and `scroll-runtime.test.ts`.
- WP0 made the minimal swap outside its package list so the tree stays green: the generated script import (`patchright`), the installer CLI candidates (`patchright`, `patchright-core`) and the install commands in `ci.yml` and `auto-release.workflow.yml`. WP4 (script, goldens) and WP5 (rename, messages, CI) refine them; the identical lines merge cleanly.
