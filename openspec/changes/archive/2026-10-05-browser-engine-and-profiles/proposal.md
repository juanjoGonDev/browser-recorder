# Proposal: Browser engine and profiles

## Intent

Sites detect Playwright and every recording starts logged out. Switch to Patchright, let the user pick the browser (Brave included) and keep logins through persistent or copied profiles, without ever touching the real profile.

## Scope

### In Scope
- `patchright` (exact pin) replaces `playwright` in recorder, installer and generated `script.mjs`; `playwright` removed.
- Our CDP sessions never send `Runtime.enable` / `Console.enable` (today `isolated-world-capture.ts` does).
- Per-OS detection of Chromium-based browsers (Brave, Chrome, Edge, Chromium, Vivaldi, Opera) plus bundled Chromium.
- Profile modes: `managed` (default, tool-owned, 0700, per browser), `copy-of-real` (profile picked from `Local State`, copied read-only), `ephemeral`.
- Recording stores browser id and profile mode; replay reuses them, falling back to bundled Chromium with a warning.
- Profile-lock detection with a clear error.
- TUI browser and profile pickers on New recording.

### Out of Scope
- Firefox/WebKit; live attach to the real profile (Chrome 136+ blocks it).
- Storing or decrypting cookies; syncing copies back.
- Changing an existing recording's browser.

## Capabilities

### New Capabilities
- `browser-selection`: browser catalogue, detection, fallback.
- `browser-profiles`: modes, directories, copy rules, lock detection, read-only source.

### Modified Capabilities
- `recording-capture`: Patchright persistent context, no `Runtime.enable`/`Console.enable`.
- `script-generation`: script imports Patchright, launches stored browser and profile.
- `replay`: passes browser and profile; reports locks and fallback.
- `script-library`: recording schema gains browser id and profile mode; old recordings read as bundled + ephemeral.
- `environment-setup`: `patchright install chromium`; detection at startup.
- `tui`: pickers, lock and fallback messages.
- `repository-quality`: dependency rules name Patchright; lint forbids the two CDP calls; real-browser tests opt-in.

## Approach

Per explore.md: pure catalogue and path tables per OS over an injected file-system port; profile resolver and copier as adapters; `launchPersistentContext` with `executablePath`, `viewport: null`. Frame-to-world mapping moves off `Runtime.executionContextCreated` (design picks the mechanism, e.g. `Page.createIsolatedWorld` per frame).

## Affected Areas

| Area | Impact |
|------|--------|
| `src/recording-capture/adapters/` | Modified |
| `src/script-generation/domain/` | Modified |
| `src/replay/`, `src/environment-setup/` | Modified |
| `src/shared/domain/recording.ts`, `src/script-library/domain/parse-recording.ts` | Modified |
| `src/tui/`, `src/composition/` | Modified |
| `src/browser-selection/`, `src/browser-profiles/` | New |
| `package.json`, `.dependency-cruiser.json`, ESLint | Modified |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Capture breaks without `Runtime.enable` | High | Spike first; headless capture tests |
| Patchright supply chain | Med | Exact pin, 3-day cooldown, audit |
| Live SQLite copy torn | Med | Copy `-wal`/`-journal` together; retry |
| Windows app-bound encryption rejects copy | Med | Detect and report |
| Recorded `viewport` vs `viewport: null` | Low | Design decides |

## Rollback Plan

Revert the commit group; old recordings still parse. Managed and copied profile directories are tool-owned and removable; real profiles are never written.

## Dependencies

- `patchright@1.63.0`.

## Success Criteria

- [ ] No `playwright` import or dependency remains; generated scripts run on Patchright.
- [ ] No `Runtime.enable`/`Console.enable` sent by our code (lint plus test).
- [ ] A managed-profile login survives a second recording and its replay.
- [ ] Copy-of-real reuses a Brave session; source profile unchanged (hash check on a fixture).
- [ ] Locked profile reports an error instead of hanging.
- [ ] Default test suite is headless and never reads a real profile.
