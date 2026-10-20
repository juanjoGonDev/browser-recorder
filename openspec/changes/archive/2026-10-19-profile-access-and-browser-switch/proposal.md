# Proposal: Profile access errors and browser switch

## Intent

1. A `copy-of-real` replay fails with "profile could not be found" when macOS privacy protection (EPERM) blocks reading `Local State`. The message is wrong and gives no way out.
2. A saved recording keeps its creation browser/profile forever; the library offers no way to change it.

## Scope

### In Scope
- Distinguish permission denied (EPERM/EACCES) from missing in `readLocalState` and `copyProfile` (exists, list, read, copy) with a new `ProfileCopyError` code `source-unreadable`.
- Platform-aware message, no paths: macOS names Full Disk Access for the terminal app in System Settings › Privacy & Security, then restarting the terminal; other OSes give a generic permission hint. Shown in TUI and CLI replay.
- Library key `b`: change the selected recording's browser/profile with the same browser and profile cycle fields as the create form, preselected on the current choice; Enter saves, Esc cancels.
- `LibraryService.changeBrowser(slug, choice)`: rewrites `recording.json` and regenerates `script.mjs` atomically through the per-slug serializer.

### Out of Scope
- Changing system settings or opening System Settings.
- Picker warning for an unreadable profile. This is a cheap later option: today the copy options are simply missing.
- Changing the browser from the CLI.

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `browser-profiles`: an unreadable source is reported as permission denied, not missing.
- `script-library`: "Browser immutable" becomes "only an explicit browser change modifies it"; rename still leaves it unchanged.
- `tui`: a library action to change the browser; the permission message is shown.
- `cli`: a replay prints the permission message to stderr with a non-zero exit.

## Approach

- Permission detection lives in the adapter or application layer through the error `code`. `readLocalState` returns a tagged result (`ok | missing | unreadable`), so `listRealProfiles` keeps returning `null` for both.
- `explainProfileFailure` receives the platform from composition.
- `script.mjs` only embeds a `// Recorded with:` comment. The launch target comes from env vars at replay time, so regeneration is cosmetic. Replay already reads `recording.browser`, so TUI and CLI replays pick up the change.

## Affected Areas

| Area | Impact |
|------|--------|
| `src/browser-profiles/{domain/profile-errors,application/read-local-state,application/profile-store,application/copy-profile}.ts` | Modified |
| `src/composition/{profile-messages,browser-launch-plan,create-app-services}.ts` | Modified |
| `src/script-library/application/library-service.ts` | Modified |
| `src/tui/domain/{app-state,keymap,intent,reduce-library,reduce-form}.ts`, `src/tui/application/library-flow.ts`, `src/tui/render/screens/library-screen.ts` | Modified |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Some errno other than EPERM/EACCES is still masked | Low | Rethrow unknown errors unchanged |
| The picker is coupled to the create form | Med | Extract the pure cycle logic and share it |
| The current browser is no longer installed | Low | Preselect the first option |

## Rollback Plan

Revert the single squash commit. The recording schema is unchanged (v2), so edited recordings stay valid.

## Success Criteria

- [ ] EPERM on `Local State` or the profile produces the Full Disk Access message on macOS (TUI and CLI).
- [ ] A missing `Local State` still says "could not be found".
- [ ] After `b` → pick → Enter, the TUI and CLI replays use the new choice, and the name and events are unchanged.

## Proposal question round

These are assumptions for the owner to confirm. They were not asked directly because the mode is auto.
1. Key `b` for "browser" (it is free). OK?
2. Is changing the browser in the TUI only enough (no CLI flag)?
3. Should the picker warning for an unreadable profile stay deferred?
4. Release impact: a minor bump (fix + feature).
