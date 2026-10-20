# Apply progress: Profile access errors and browser switch

Mode: Strict TDD. All 28 tasks complete (28/28). Single PR; commit groups below.

## Commits

1. `fix: report unreadable browser profiles as permission errors` (1.1-1.8)
2. `fix: explain blocked profile access per platform and wrap long errors` (2.1-2.5)
3. `feat: change the browser of a saved recording in the library service` (3.1-3.3)
4. `feat: change the browser of a recording from the library` (4.1-4.7)
5. `docs: document profile access errors and changing the browser` (5.1, 5.3)
6. `chore: bump version to 0.2.0` (5.2, minor: `src/` changed per the release impact policy)
7. `docs: add the profile access and browser switch change` (this change folder, 6.x)

## TDD cycle evidence

| Task | RED | GREEN | Triangulation | Refactor |
|---|---|---|---|---|
| 1.1 | file-access-failure.test (module missing) | classify/errorCodeOf | 11 code x platform rows, 5 errorCodeOf inputs | errorCodeOf moved out of copy-file-group |
| 1.2 | profile-errors.test (text undefined) | new code and text | second subject | union reformatted |
| 1.3 | support test (`deniedPaths` undefined) | hook | second path, other path unaffected | denial helper (lint) |
| 1.4 | read-local-state.test (8 failed) | tagged result | ok/missing/json/3 denied/EIO | port doc |
| 1.5 | profile-store.test (15 failed after tagged result) | map result | darwin+linux, EIO list/prepare | `copyErrorFor`, `listRealProfiles` |
| 1.6/1.7 | copy-profile.test (9 failed) | `guardSourceRead`, `CopyContext.platform` | darwin/linux x EPERM/EACCES, 4 denial points, EIO, win32 retry kept | `copyInto` (40 line rule) |
| 1.8 | characterization of the unchanged adapter (passes at once, adapter already surfaces `code`) | n/a | EACCES list/exists/read + ENOENT | none |
| 2.1 | profile-messages.test (3 failed) | wording per platform | darwin/linux/win32, missing, unrelated | `unreadableMessage` |
| 2.2 | browser-launch-plan darwin case failed | `platform` dep | darwin and linux | fixtures updated |
| 2.3 | integration with the real store over the memory fs (passes after 2.1/2.2 wiring) | n/a | darwin denied, linux denied dir, missing, changed browser | none |
| 2.4 | wrap-text.test (module missing) | wrapText | 6 cases incl. wide chars | none |
| 2.5 | library-screen long error (1 failed) | `wrapped-error.ts` | short error stays inline, rows shrink | status line split |
| 3.1/3.2 | 6 failed (`changeBrowser` missing) | service method | two changes, unknown slug, invalid, concurrency, rename x2 | tests moved to their own file + shared repository support |
| 3.3 | typed port and composition; integration test | passthrough | success and missing slug | rig extracted to `tests/support/app-services-rig.ts` |
| 4.1 | browser-picker.test (module missing) | picker module | wrap both ways, preselect fallbacks | reduce-form uses `cyclePicker` |
| 4.2 | browser-options.test (module missing) | `loadBrowserOptions`, `chosenBrowser` | bundled kept/dropped, failure | recording-flow uses them |
| 4.3/4.4 | keymap + reduce-browser-change (13 failed) | intent, action, reducers | empty/invalid, refresh, failure, cancelled | handlers table |
| 4.5/4.7 | controller scenarios (9 failed) | `submit`, `beginBrowserChange`, `saveBrowser` | unchanged, changed, profile field, failure, Esc, undetected, detecting, empty | rename made private |
| 4.6 | library-screen mode tests + hints (7 failed) | renderers, shared `renderPickers` | detecting/none/note/long error | `library-browser-change.ts` |
| 5.1 | browser-docs tests (2 failed) | README, SECURITY | whitespace tolerant | none |

Test-after notes (honest): the `status-bar` compact-gap test and the
`create-app-services` `changeBrowser` test were written with their
implementation in one step; both cover the behavior and fail without it.

## Work unit evidence

| Evidence | Value |
|---|---|
| Focused tests | `pnpm exec vitest run tests/unit/browser-profiles tests/unit/composition tests/unit/script-library tests/unit/tui tests/integration/composition tests/integration/browser-profiles tests/unit/repository`: all pass |
| Runtime harness | Real profile store over the in-memory fs through `runCli` (stderr, exit 1, no stdout); `nodeProfileFileSystem` with `chmod 000` temp dir (skipped on win32/root); no browser window opened |
| Rollback boundary | Revert the squash commit; schema v2 is unchanged |

## Final gate

`pnpm quality` green (209 files passed, 2464 tests passed, 6 skipped),
`pnpm test:coverage` green, `pnpm build` green. One earlier full run showed
three real-headless-Chromium integration tests failing under load; they pass on
rerun and in the final runs (pre-existing flakiness, unrelated).

## Deviations from design

See "Reconciliation" in `design.md`. Spec fix: the `browser-profiles` scenario
"Unreadable Local State" now says no profiles are returned (it contradicted the
requirement text).
