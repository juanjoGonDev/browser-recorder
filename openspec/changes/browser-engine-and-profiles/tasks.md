# Tasks: Browser engine and profiles

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 5,500 - 8,000 (about 45% tests, fixtures, goldens) |
| 400-line budget risk | High |
| Chained PRs recommended | No (user accepted one large PR) |
| Suggested split | Single PR; commits grouped per WP (WP0 on main first, WP1-6 in worktrees merged into the feature branch, WP7 last) |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

Decision already given: user accepted one large PR, `size:exception`, unlimited review budget. Do not recommend chaining.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| WP0 | Spike, swap, frozen contracts, rules | PR 1 (commit group) | `pnpm vitest run tests/spike tests/support` | Headless spike tests on bundled Chromium | Revert WP0 commits |
| WP1 | `browser-selection` | PR 1 | `pnpm vitest run src/browser-selection` | N/A: pure over fake probe | `src/browser-selection/**` |
| WP2 | Capture, guard, launcher | PR 1 | `pnpm vitest run src/recording-capture tests/integration/cdp-method-audit.test.ts` | Headless capture suite + CDP audit | `src/recording-capture/**` |
| WP3 | `browser-profiles` | PR 1 | `pnpm vitest run src/browser-profiles` | Temp-dir fs integration on fixture | `src/browser-profiles/**` |
| WP4 | Script generation + library | PR 1 | `pnpm vitest run src/script-generation src/script-library` | Golden scripts | those two dirs |
| WP5 | Replay, setup, CI | PR 1 | `pnpm vitest run src/replay src/environment-setup` | Fake runner/installer | those dirs + ci.yml |
| WP6 | TUI | PR 1 | `pnpm vitest run src/tui` | Fake `AppServices` renders | `src/tui/**` |
| WP7 | Composition, e2e, opt-in tests, README | PR 1 | `pnpm test` | Headless e2e roundtrip (v2 + migrated v1) | `src/composition/**`, tests |

## HARD RULES (all tasks)

- Tests are headless only. Never open a browser window. `BROWSER_RECORDER_HEADED_TESTS=1` is the sole manual override.
- Real-browser tests are opt-in (`BROWSER_RECORDER_REAL_BROWSER_TESTS=1`, `describe.runIf`), source asserted under `tests/fixtures/`. Never run against the user's real profile dir. Never write to a real profile.
- Every task: RED (failing test) -> GREEN -> REFACTOR. Tests run through `pnpm test`.
- WPs 1-6 import nothing from each other. Shared helpers live in WP0.

## WP0: Foundation (main, first, sequential)

- [x] 0.1 RED: `tests/spike/runtime-binding.test.ts` (headless): `Runtime.addBinding` + `bindingCalled` delivered without `Runtime.enable`. Resolves design OQ1.
- [x] 0.2 RED: `tests/spike/isolated-world-reuse.test.ts`: `Page.createIsolatedWorld` with the same `worldName` returns the same context id per frame (incl. after navigation). Outcome selects transport (a)/(b)/(c).
- [x] 0.3 RED: `tests/spike/patchright-install.test.ts`: `patchright` and `patchright-core` bin names, cache path (`ms-playwright`), whether `--use-mock-keychain` is already dropped. Skip browser-open: headless only.
- [x] 0.4 GREEN: swap `package.json` to `patchright` `1.63.0` exact, remove `playwright`, `pnpm install`; keep `onlyBuiltDependencies: ["lefthook"]`; mechanical import rename across `src/**` and tests.
- [x] 0.5 Record S0 outcomes as an addendum in `openspec/changes/browser-engine-and-profiles/design.md`.
- [ ] 0.6 RED+GREEN: contract files: `src/shared/domain/browser-choice.ts`; `recording.ts` v2 (`display`, `browser`, no `viewport`); shared ports/types for WP1/WP3 (`Platform`, `PathRoots`, `FileProbe`, `ProfileFileSystem`, `ProcessProbe`, `LaunchTarget`, `LaunchOptions`, `CaptureWorld`, `ProfileOptionView`, `BrowserOptionView`, TUI intents/actions, `StartReplayRequest.launchEnv`, `RecordingRepository.writeScript`, `LibraryService.regenerateScript`). Type-level tests.
- [ ] 0.7 GREEN: minimal stubs and fixtures so `pnpm quality` stays green; `tests/fixtures/profiles/brave-like/**` (Local State, Default/{Preferences,Cookies,Cookies-wal,Cache/x}, Profile 1).
- [ ] 0.8 RED->GREEN: `tests/support/isolated-home.ts` (vitest globalSetup pins `PLAYWRIGHT_BROWSERS_PATH`, then redirects HOME/USERPROFILE/LOCALAPPDATA/APPDATA/XDG_*); test proves no real home is read. (Repository-quality: Default run.)
- [ ] 0.9 RED->GREEN: `.dependency-cruiser.json` (`patchright-in-adapters`, `no-playwright`) with a fixture violation test (Playwright reintroduced, Layer violation); ESLint `no-restricted-imports` + `Literal[value=/^(Runtime|Console)\.enable$/]` with a lint fixture (Forbidden call); knip unchanged.
- [ ] 0.10 RED->GREEN: `src/recording-capture/adapters/guarded-cdp.ts` (shared by WP2 and the audit; `ForbiddenCdpMethodError`, constant-built names) with unit test. Dependency audit scenarios (Audit, Range detected).
- [ ] 0.11 REFACTOR: run `pnpm quality`; tag WP0 done and branch worktrees.

## WP1: browser-selection (worktree)

- [ ] 1.1 RED: `domain/expand-path.test.ts`: roots filled, missing root -> null.
- [ ] 1.2 GREEN: `domain/expand-path.ts`.
- [ ] 1.3 RED: `domain/browser-catalog-table.test.ts` x3 OS, order and templates (macOS Brave, Windows paths, Linux paths).
- [ ] 1.4 GREEN: `domain/browser-catalog-table.ts`; Opera `userDataDir: null`.
- [ ] 1.5 RED: `application/browser-catalog.test.ts` with fake probe: bundled last (Always-available bundled; Nothing installed), directory entry not detected, unknown OS -> bundled only.
- [ ] 1.6 GREEN: `application/browser-catalog.ts`, `adapters/node-file-probe.ts` (X_OK on POSIX; temp-dir integration test).
- [ ] 1.7 RED->GREEN: `domain/resolve-replay-browser.ts`: Recorded Brave missing, Installed browser, Unknown id -> bundled; managed stays, copy-of-real -> ephemeral.
- [ ] 1.8 REFACTOR: barrel exports; depcruise clean.

## WP2: recording-capture (worktree)

- [ ] 2.1 RED->GREEN: `domain/launch-arguments.ts` pure (window -> `viewport:null` + `--window-size`; emulated; real keychain -> `ignoreDefaultArgs`); tests.
- [ ] 2.2 RED->GREEN: `domain/is-profile-in-use-error.ts` classifier tests (Locked).
- [ ] 2.3 RED->GREEN: `adapters/world-contexts.ts`: on-demand map via `createIsolatedWorld`, drop on `frameNavigated`/`frameDetached`; fake CDP unit tests.
- [ ] 2.4 RED: `isolated-world-capture` tests: no `Runtime.enable`, miss -> refresh `Page.getFrameTree` -> retry -> drop. GREEN: rewrite per S0 transport; async `contextOf` in `frame-path-resolver.ts`, `page-wiring.ts`, `out-of-process-frames.ts`; `guardCdp` on every session.
- [ ] 2.5 RED->GREEN: rename to `patchright-browser-launcher.ts` / `patchright-browser-session.ts`: `launchPersistentContext`, `context.pages()[0]`, end on context close; 30 s timeout (Patchright persistent context, Stored browser, Fallback).
- [ ] 2.6 RED->GREEN: `recording-session.ts` request gains `browser`, `target`; saves v2 (Saved fields); `ProfileInUseError`-like launch error surfaced (Locked at start).
- [ ] 2.7 RED->GREEN: `tests/integration/cdp-method-audit.test.ts` (headless): wraps `newCDPSession`, same/cross-origin frames, navigation, dialog, scroll; asserts no forbidden method (Protocol trace). Managed login survives second launch (cookie via fixture server).
- [ ] 2.8 REFACTOR: existing capture suite green on Patchright.

## WP3: browser-profiles (worktree)

- [ ] 3.1 RED->GREEN: `domain/profile-layout.ts` (`appDataRootFor` per OS, `SAFE_PROFILE_DIR`, managed/sessions dirs; Per browser).
- [ ] 3.2 RED->GREEN: `domain/parse-local-state.ts`: hostile names, missing `info_cache`, order, app-bound flag (Multiple profiles, Unreadable Local State).
- [ ] 3.3 RED->GREEN: `domain/copy-filter.ts` denylist + suffixes (Skipped entries); `domain/singleton-lock.ts` host-pid parser.
- [ ] 3.4 RED->GREEN: `domain/profile-errors.ts`; `application/check-profile-lock.ts` (Locked managed profile, Stale lock; win32 `lockfile`).
- [ ] 3.5 RED: `copy-profile.test.ts` (in-memory fs): WAL sibling, Torn read retry 50/100/200, `unstable-copy`, `source-in-use` removes destination, symlinks skipped, `../x`, `Default/../..`, `C:\x`, absolute, `Guest Profile` -> `unknown-profile`, `remove` outside sessions throws. GREEN: `application/copy-profile.ts`.
- [ ] 3.6 RED->GREEN: `application/profile-store.ts`: managed (First use, Reuse), ephemeral (Cleanup, 5 retries), copy-of-real (source-running, app-bound warnings, keychain flags), `sweepStaleSessions`.
- [ ] 3.7 RED->GREEN: `adapters/node-profile-file-system.ts` and `node-process-probe.ts`; integration on temp dirs: 0700, `COPYFILE_EXCL`, fixture hash and mtimes unchanged also after failed copy (Hash unchanged), fake `SingletonLock` live/dead pid, Unreadable cookies reporting.
- [ ] 3.8 REFACTOR: shared walk helpers; depcruise clean.

## WP4: script-generation + script-library (worktree)

- [ ] 4.1 RED->GREEN: `generate-script.ts`/`script-prelude.ts`: `patchright` import, `openContext(display)`, header names browser and mode; goldens for window and emulated (Runnable, Deterministic, Managed Brave, Ephemeral, Copy of real).
- [ ] 4.2 RED->GREEN: prelude env handling: four variables, only `--profile-directory=` accepted (`--remote-debugging-port=1` ignored), `mkdtemp` and cleanup; text scan for forbidden CDP literals; parity golden with `launch-arguments.ts`.
- [ ] 4.3 RED->GREEN: multi-tab `context.pages()[0] ?? newPage()`, `finally close()` (Multi-tab, Unknown event type, Legacy recording).
- [ ] 4.4 RED->GREEN: `parse-recording.ts` v1 -> v2 migration, v2 requires fields, bad mode rejected (Round trip, Legacy file, Bad mode).
- [ ] 4.5 RED->GREEN: `library-service.ts` `regenerateScript` (writes only `script.mjs`), `file-system-recording-repository.ts` `writeScript`, v2 draft; rename keeps browser (Rename).
- [ ] 4.6 REFACTOR: dedupe prelude and parser constants.

## WP5: replay + environment-setup + CI (worktree)

- [ ] 5.1 RED->GREEN: `replay-runner.ts` `launchEnv` merged over env, `shell: false`, inherited vars overridden (Stored browser, Legacy recording, Locked, Missing browser pass-through).
- [ ] 5.2 RED->GREEN: rename `patchright-browser-installation.ts`, `resolve-patchright-cli.ts` (fallback to `patchright-core`, argv `[cli,'install','chromium']`); detection Present/Missing/System browser only.
- [ ] 5.3 RED->GREEN: `ensure-browser.ts`, `linux-deps-hint.ts` commands say `patchright` (Success, Failure prints `pnpm exec patchright install chromium`, Offline, Missing libs).
- [ ] 5.4 GREEN: `.github/workflows/ci.yml` `pnpm exec patchright install chromium` (`--with-deps` Ubuntu); workflow lint test.

## WP6: TUI (worktree)

- [ ] 6.1 RED->GREEN: state/actions/intents/keymap: focus `name -> url -> browser -> profile`, `cycle-option`, `browsers-loaded/failed`, profile index reset (Pickers).
- [ ] 6.2 RED->GREEN: reducers + `recording-flow.ts`/`tui-controller.ts`: Enter refused with "Detecting browsers…", invalid/empty URL kept (Invalid URL, Empty URL).
- [ ] 6.3 RED->GREEN: `new-recording-screen.ts` pickers and notes (Only bundled).
- [ ] 6.4 RED->GREEN: recording/replay/setup screens: `Brave · managed`, warnings, inline lock error, detected browsers, bundled failure still allows another browser (Locked profile, Fallback warning).
- [ ] 6.5 REFACTOR: against fake `AppServices`.

## WP7: Integration (main, last)

- [ ] 7.1 RED->GREEN: `src/composition/browser-launch-plan.ts` planner + `toReplayEnvironment` (all four vars set, empty = unset; fallback warning; release once).
- [ ] 7.2 RED->GREEN: `browser-views.ts`, `create-app-services.ts`, `create-production-services.ts`, `resolve-paths.ts` (`appDataRoot`, startup sweep, `regenerateScript` before replay).
- [ ] 7.3 RED->GREEN: e2e roundtrip headless: v2 recording and migrated v1; managed login survives second recording and replay.
- [ ] 7.4 RED->GREEN: opt-in `describe.runIf(BROWSER_RECORDER_REAL_BROWSER_TESTS === '1')` copy-of-real, lock error, replay from `tests/fixtures/profiles/brave-like` (assert path under `tests/fixtures/`; headless).
- [ ] 7.5 GREEN: README (Patchright, profiles, opt-in env vars); full `pnpm quality`, coverage, depcruise, knip.
