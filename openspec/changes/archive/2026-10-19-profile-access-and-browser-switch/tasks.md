# Tasks: Profile access errors and browser switch

Sequential, single writer, single PR (commit groups per phase). Every task is
RED (failing test, seen failing for the right reason) -> GREEN (minimum code,
then a second case to triangulate) -> REFACTOR (tests green). No browser
windows, no real profiles, nothing under `recordings/`. Limits: 40 lines per
function, 300 per source file, 3 parameters.

## Phase 1: browser-profiles permission classification (spec: browser-profiles)

- [x] 1.1 RED/GREEN/REFACTOR `domain/file-access-failure.ts`: table test of `classifyFileError(code, platform)`: ENOENT->missing, EBUSY->busy, EACCES->denied, EPERM->busy on win32 and denied on darwin/linux, EIO/undefined->other. Move `errorCodeOf` from `copy-file-group.ts`. (Unknown error propagates unchanged)
- [x] 1.2 RED/GREEN `domain/profile-errors.ts`: new `source-unreadable` code, message `"<name>" could not be read: permission denied`; test it differs from the missing text and has no path.
- [x] 1.3 RED/GREEN `tests/support/memory-profile-file-system.ts`: `deniedPaths` hook throwing an error with `code: 'EPERM'` (support test first, with a second path case).
- [x] 1.4 RED/GREEN `application/read-local-state.ts`: tagged `LocalStateRead` (`ok | missing | unreadable`). Cases: valid -> ok, ENOENT -> missing, unparsable JSON -> missing, EPERM/EACCES -> unreadable, EIO -> rethrown. Document errno `code` rejections on `ports/profile-file-system.ts`.
- [x] 1.5 RED/GREEN `application/profile-store.ts`: `listRealProfiles` returns null for missing, unreadable and `other` (no throw, nothing written); `prepareCopy` raises `source-unreadable` for unreadable and the existing missing error for missing. Keep file under 300 lines (REFACTOR).
- [x] 1.6 RED/GREEN `copy-profile.ts` + `copy-file-group.ts`: add `CopyContext.platform`; denied on `exists`, profile dir `list`, nested `list`, and file copy -> `source-unreadable`, no retry, partial copy removed. Triangulate with darwin EPERM and linux EACCES; EIO propagates unchanged.
- [x] 1.7 Move the existing `it.each(['EBUSY','EPERM'])` retry case in `tests/unit/browser-profiles/copy-profile.test.ts` (line ~155) so EPERM runs only with platform `win32` (retry), keeping EBUSY on all platforms; add a darwin EPERM case asserting no retry. Do this together with 1.6 so the suite stays green.
- [x] 1.8 Integration `tests/integration/browser-profiles`: `nodeProfileFileSystem` surfaces `EACCES` code (chmod 000 temp dir under the isolated home; skip on win32 or root).

## Phase 2: platform-aware wording and wiring (spec: browser-profiles, tui, cli)

- [x] 2.1 RED/GREEN `composition/profile-messages.ts`: `explainProfileFailure(error, browserId, platform)`. darwin names Full Disk Access, System Settings > Privacy & Security and restarting the terminal; linux/win32 give the generic permission hint; no path; missing still says "could not be found".
- [x] 2.2 RED/GREEN `composition/browser-launch-plan.ts` and `create-production-services.ts`: `LaunchPlannerDeps.platform` passed from production deps and into `copyProfile`; test planner with fake deps (darwin and linux).
- [x] 2.3 RED/GREEN CLI integration (fake planner deps, headless): `replay demo` with denied `copy-of-real` prints the darwin message to stderr, empty stdout, exit 1; missing `Local State` prints "could not be found"; a recording whose browser changed launches the new browser/profile.
- [x] 2.4 RED/GREEN `tui/render/wrap-text.ts`: word wrap by cell width (long text, exact fit, word longer than width, empty).
- [x] 2.5 RED/GREEN library screen: a long `library-error` renders as wrapped lines between status line and rows; the TUI shows the Full Disk Access message on a denied replay and the library stays usable (controller test with fake services).

## Phase 3: LibraryService.changeBrowser (spec: script-library)

- [x] 3.1 RED/GREEN `script-library/application/library-service.ts` `changeBrowser(slug, choice)`: writes browser id, mode and profile dir through `serializer.run(slug)` + `writeFiles`; name, slug, start URL, createdAt and events unchanged; `script.mjs` regenerated. Triangulate chrome+managed -> brave+copy-of-real+Profile 2 and a second change.
- [x] 3.2 RED/GREEN failure paths: unknown slug rejects and writes nothing; invalid choice rejected by `parseRecording`; concurrent change and rename on one slug run sequentially and leave a valid recording; rename after a change keeps the new browser; rename alone leaves browser unchanged.
- [x] 3.3 RED/GREEN `composition/create-app-services.ts` + `tui/application/ports/app-services.ts`: expose `library.changeBrowser`.

## Phase 4: shared picker and TUI change-browser mode (spec: tui)

- [x] 4.1 RED/GREEN `tui/domain/browser-picker.ts`: `BrowserPicker`, `PickerField`, `cyclePicker`, `pickedChoice`, `preselectPicker(browsers, current)` (index by browserId, profile by deep-equal, fallback 0, missing browser -> first option). REFACTOR `reduce-form.ts`/`recording-flow.ts` to use it; existing new-recording form tests stay green untouched.
- [x] 4.2 RED/GREEN `tui/application/browser-options.ts`: extract `loadBrowserOptions` (bundled filter), shared by recording and library flows.
- [x] 4.3 RED/GREEN keymap/intent/action: key `b` -> `begin-browser-change` in library browse mode; hints list `b`; empty library does nothing.
- [x] 4.4 RED/GREEN `tui/domain/reduce-browser-change.ts` + `app-state`/`app-reducer`: mode `change-browser` (slug captured at begin, `browsers: null` while detecting), `browsers-loaded` preselects (BUNDLED_EPHEMERAL when entry has no browser), `cycle-option`, `switch-field`, Esc `cancel-mode`.
- [x] 4.5 RED/GREEN `LibraryFlow.beginBrowserChange` / `saveBrowser` + `tui-controller.ts` handler: unchanged choice just closes; changed choice calls `changeBrowser`, then closes and reloads; failure -> `library-error`, mode stays; Esc writes nothing. Keep controller under 300 lines (move branching into `LibraryFlow` if needed).
- [x] 4.6 RED/GREEN `render/screens/library-screen.ts` + `browser-pickers.ts`: mode prompt, `renderPickers(picker, focus, context)`, hints; profile picker appears for `copy-of-real` preselected on current profile. Assert text, not styles. REFACTOR new-recording screen onto the shared renderer.
- [x] 4.7 Controller scenarios end to end with fake `AppServices`: chrome -> `b` -> pick brave -> Enter saves brave and library shows it; Esc leaves recording unchanged; current browser not detected preselects first.

## Phase 5: docs and release

- [x] 5.1 README: add `b` change browser to the Library key table (line ~90) and the library description (line ~63); document the macOS Full Disk Access message and that the browser is changed in the TUI only (no CLI flag). Mention in SECURITY.md only if a profile-access section exists. Check docs/ for other key listings.
- [x] 5.2 `package.json`: minor bump 0.1.3 -> 0.2.0 (fix + feature, per `scripts/release-impact-policy.ts`; run its test if present). Do not tag or create releases.
- [x] 5.3 Reconciliation: if any design/spec mismatch surfaced during apply, fix docs and record it in apply-progress notes.

## Phase 6: final quality gate

- [x] 6.1 `pnpm format`, then `pnpm quality` (typecheck, lint:strict, format:check, deadcode, deps:check, test); fix without weakening `.dependency-cruiser.json` or lint rules.
- [x] 6.2 `pnpm test:coverage` and `pnpm build`; confirm nothing opened a browser window and no hooks were bypassed.

## Requirement traceability

| Requirement | Tasks |
|---|---|
| browser-profiles: Permission-denied source reporting | 1.1-1.8, 2.1 |
| browser-profiles: Real profile listing (MODIFIED) | 1.4, 1.5 |
| script-library: Change browser; Browser immutable | 3.1-3.3 |
| tui: Change browser action | 4.1-4.7 |
| tui: Profile permission message | 2.4, 2.5 |
| cli: Profile permission error output | 2.1-2.3 |
