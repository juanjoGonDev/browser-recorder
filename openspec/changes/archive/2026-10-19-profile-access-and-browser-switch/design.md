# Design: Profile access errors and browser switch

## Technical Approach

Two independent slices in one PR. (1) `browser-profiles` classifies errno codes with a pure domain function; `readLocalState` returns a tagged result and the copy path raises `ProfileCopyError('source-unreadable')`, which composition words per platform. (2) A pure `browser-picker` module is extracted from the new-recording form and reused by a new library mode `change-browser`; saving calls `LibraryService.changeBrowser`, which reuses the existing serialized `writeFiles` path (so `script.mjs` is regenerated).

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|---|---|---|---|
| How the port reports denial | Port unchanged: methods reject with the Node error whose `code` is the errno name (documented on `ProfileFileSystem`). Application classifies with `classifyFileError(code, platform)` in `domain/file-access-failure.ts` -> `'missing' \| 'denied' \| 'busy' \| 'other'` | New port return types per method; adapter throwing a domain error | Zero adapter churn, fake already throws `errorWithCode`; classification is pure and testable |
| Errno mapping | `ENOENT`->missing; `EBUSY`->busy; `EPERM`->busy on `win32` (sharing lock), denied elsewhere; `EACCES`->denied; anything else->other (rethrown unchanged) | EPERM always busy (today) | On POSIX EPERM is never a lock; it is the macOS privacy block |
| `readLocalState` result | `{kind:'ok',info} \| {kind:'missing'} \| {kind:'unreadable'}`; unparsable JSON counts as `missing`; `other` rethrows | Boolean flags; null | `prepareCopy` needs the distinction; `listRealProfiles` maps missing/unreadable and also catches `other` -> `null` so the picker never breaks |
| Copy errors | New code `source-unreadable` (`"<name>" could not be read: permission denied`). `assertSourcePresent` wraps `exists`; `copyDirectory` wraps `list`; `copyFileGroup.attempt` maps `denied` to an immediate throw (no retry). Partial copy is still removed by the existing `catch` | Retrying denied files | Permission never clears by waiting |
| Platform-aware wording | `explainProfileFailure(error, browserId, platform)`; `LaunchPlannerDeps.platform` added, passed from `createProductionDeps`. darwin: "macOS blocked reading the {label} profile. Give your terminal app Full Disk Access in System Settings › Privacy & Security, then restart the terminal and try again." Other: "The {label} profile to copy cannot be read: permission denied. Check that your user can read it and try again." No paths | Message built in domain | Wording is a composition concern (existing pattern) |
| Long TUI errors | New pure `render/wrap-text.ts`; when a library error does not fit the status line it renders as wrapped lines between status line and rows | Shortening the message | The status line clips at ~80 cells today |
| Shared picker | `tui/domain/browser-picker.ts`: `BrowserPicker {browsers, browserIndex, profileIndex}`, `PickerField`, `cyclePicker`, `pickedChoice`, `preselectPicker(browsers, current)`. `NewRecordingScreen` satisfies `BrowserPicker` structurally (no field rename) | Nested `picker` field in the form | Minimal churn; existing form tests keep passing |
| Library mode | `{kind:'change-browser', slug, current: BrowserChoice, focus: PickerField} & BrowserPicker`, `browsers: null` while detecting. Slug captured at begin, so refreshes cannot retarget | Separate screen | Rename/delete already use modes; refresh is already browse-only |
| Preselection | Browser index by `browserId`; profile by deep-equal choice; fall back to `0`. Entry without `browser` uses `BUNDLED_EPHEMERAL` | Error when missing | Proposal default |
| Save | Unchanged choice -> just close. Otherwise `changeBrowser`; on success `cancel-mode` + reload; on failure `library-error`, mode stays | Always write | Avoids a needless `updatedAt` bump |
| `LibraryService.changeBrowser(slug, choice): Promise<Recording>` | Inside `serializer.run(slug)`: load, `parseRecording({...recording, browser: choice})` to validate, `writeFiles` | New repository method | Same atomic, per-slug path as `save` |

## Data Flow

    b -> keymap -> 'begin-browser-change' -> dispatch begin (mode, browsers:null)
      -> LibraryFlow.beginBrowserChange -> loadBrowserOptions (bundled filter)
      -> 'browsers-loaded' -> preselectPicker
    left/right -> 'cycle-option' -> cyclePicker     tab/up/down -> 'switch-field'
    Enter -> submit -> LibraryFlow.saveBrowser -> AppServices.library.changeBrowser
      -> LibraryService.changeBrowser -> writeFiles (recording.json + script.mjs)
    Esc -> 'cancel-mode'

    replay -> planner.prepare -> readLocalState/copyProfile -> ProfileCopyError
      -> explainProfileFailure(platform) -> TUI library-error | CLI stderr, exit != 0

## File Changes

| File | Action | Description |
|---|---|---|
| `src/browser-profiles/domain/file-access-failure.ts` | Create | `errorCodeOf` (moved from copy-file-group), `classifyFileError` |
| `src/browser-profiles/domain/profile-errors.ts` | Modify | `source-unreadable` code and text |
| `src/browser-profiles/application/read-local-state.ts` | Modify | Tagged `LocalStateRead` |
| `src/browser-profiles/application/profile-store.ts` (209 lines) | Modify | Map tagged result in `listRealProfiles`/`prepareCopy` |
| `src/browser-profiles/application/copy-profile.ts`, `copy-file-group.ts` | Modify | Denied handling; `CopyContext.platform` |
| `src/browser-profiles/application/ports/profile-file-system.ts` | Modify | Doc: rejections carry errno `code` |
| `src/composition/profile-messages.ts`, `browser-launch-plan.ts`, `create-production-services.ts` | Modify | Platform wording and wiring |
| `src/composition/create-app-services.ts` | Modify | `library.changeBrowser` |
| `src/script-library/application/library-service.ts` | Modify | `changeBrowser` |
| `src/tui/domain/browser-picker.ts`, `reduce-browser-change.ts` | Create | Shared picker; library mode reducers |
| `src/tui/domain/{app-state,app-action,intent,keymap,reduce-form,app-reducer}.ts` | Modify | Mode, action `begin-browser-change`, intent, key `b`, picker keys in mode |
| `src/tui/application/browser-options.ts` | Create | `loadBrowserOptions` shared by both flows |
| `src/tui/application/{library-flow,recording-flow,tui-controller}.ts`, `ports/app-services.ts` | Modify | Begin/save; `pickedChoice`; handler; port method |
| `src/tui/render/wrap-text.ts` | Create | Word wrap by cell width |
| `src/tui/render/screens/{library-screen,browser-pickers}.ts` | Modify | Mode prompt, pickers, hints, wrapped error; `renderPickers(picker, focus, context)` |
| `tests/support/memory-profile-file-system.ts` | Modify | `deniedPaths` hook throwing `EPERM` |
| `package.json` | Modify | Minor bump |

Budget: `tui-controller.ts` is 304 raw lines (~265 counted); add one handler line group only, move `submit`/`cancel` branching into `LibraryFlow` if it nears 300.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | `classifyFileError` per code x platform | Pure table test |
| Unit | `readLocalState` ok/missing/unparsable/EPERM/EIO | `MemoryProfileFileSystem` + `deniedPaths` |
| Unit | `copyProfile`: denied Local State, profile dir, nested list, file copy -> `source-unreadable`, no retry, copy removed; existing EPERM case moves to `win32` | Memory fs |
| Unit | `profile-store`: `listRealProfiles` null for both; `prepareCopy` codes | Memory fs |
| Unit | `explainProfileFailure` darwin vs linux, no path | Pure |
| Unit | `browser-picker`, `reduce-browser-change`, keymap `b`, library-screen rendering, `wrapText` | Pure; assert text, not styles |
| Unit | `LibraryService.changeBrowser`: writes browser, name/events intact, script regenerated, invalid choice rejected, serialized with rename | Fake repository |
| Unit | Controller/library-flow: b -> cycle -> Enter calls service; Esc writes nothing | Fake `AppServices` |
| Integration | `nodeProfileFileSystem` surfaces `EACCES` code (chmod 000 temp dir, skipped on win32/root) | Temp dir under isolated home, never real profiles |
| Integration | CLI replay of a `copy-of-real` with denied source prints message, non-zero exit | Fake planner deps, headless |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required: schema stays v2; edited recordings remain valid.

## Reconciliation (recorded during apply)

- `readLocalState` also treats a lock (`EBUSY`, `EPERM` on Windows) as
  `unreadable`: the user still gets "permission denied" guidance instead of the
  wrong "could not be found".
- `LaunchPlannerDeps.platform` only words the permission hint; `copyProfile`
  already received the platform through `ProfileStoreDeps`. The copy path gained
  `CopyContext.platform` and a small `guardSourceRead` helper (denied -> `source-unreadable`).
- `LibraryFlow.rename` became `submit`, which dispatches on the open mode
  (rename or change-browser); the controller keeps one `submit` branch.
- Detection for the change-browser mode runs in the background (like the new
  recording form), so Esc stays responsive and Enter before the list arrives
  answers "Detecting browsers…".
- Hint line: the library hints no longer fit 80 cells with `b`, so the status
  bar uses single-space gaps before it clips and the `t` hint reads `steps`.
- The previous integration case that expected a raw `EACCES` from a denied file
  now expects `source-unreadable`, which is the specified behavior.
- A browse-mode error that does not fit beside the position (and every error in
  the change-browser mode) wraps below the status line through
  `render/screens/wrapped-error.ts`.

## Open Questions

None blocking.
