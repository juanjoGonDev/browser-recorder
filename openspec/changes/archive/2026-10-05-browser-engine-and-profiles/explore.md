# Exploration: browser-engine-and-profiles

## User request (2026-10-05)

1. Replace Playwright with Patchright so automation is harder to detect.
2. Persist the session: the user is asked to log in every time.
3. Optionally use the real browser profile (cookies, logins) so an existing
   session in the user's browser is reused without logging in again.
4. The user uses Brave; let the TUI pick among the compatible browsers.

## Verified facts

- `patchright@1.63.0` (published 2026-09-08, depends only on
  `patchright-core@1.63.0`) is a drop-in fork of Playwright 1.63, which is the
  version this repo already pins. Chromium-based browsers only.
- Patchright avoids `Runtime.enable` and `Console.enable` (it evaluates in
  isolated execution contexts), adds `--disable-blink-features=AutomationControlled`
  and drops `--enable-automation`. Its init scripts go through routes. Its
  README recommends `launchPersistentContext` with a real browser channel,
  `headless: false`, `viewport: null` and no custom user agent or headers.
  Our own CDP sessions must therefore never call `Runtime.enable` or
  `Console.enable` either, or they reintroduce the leak.
- Chrome 136+ ignores `--remote-debugging-port/pipe` when the user data
  directory is the default one
  (https://developer.chrome.com/blog/remote-debugging-port). Brave 1.96 on
  this machine (Chromium 154) inherits it. So a live attach to the user's real
  profile directory is not possible.
- Cookies are encrypted with a key owned by the browser (macOS keychain
  "<Browser> Safe Storage", Windows DPAPI / app-bound encryption, Linux
  keyring/basic). They decrypt only when the same browser binary opens them,
  so a copied profile must be launched with that browser's executable, not
  with Patchright's bundled Chromium.
- Installed here: `/Applications/Brave Browser.app` (1.96.60) with a
  `Default` profile.

## Decisions

1. Engine: `patchright` replaces `playwright` everywhere (recorder, installer,
   generated `script.mjs`). Playwright is removed; one runtime dependency
   remains. `patchright install chromium` provides the bundled browser.
2. Browser catalogue: detect installed Chromium-based browsers per OS from
   well-known install paths (Brave, Chrome, Edge, Chromium, Vivaldi, Opera)
   plus the bundled Patchright Chromium. Pure detection over an injected
   file-system port; one table per OS.
3. Profile modes, chosen in the TUI per recording:
   - `managed` (default): a persistent profile owned by the tool under the OS
     user data directory (`~/Library/Application Support/browser-recorder`,
     `%LOCALAPPDATA%\browser-recorder`, `$XDG_DATA_HOME/browser-recorder`),
     one per browser, created with 0700 permissions. Logins persist across
     recordings and replays.
   - `copy-of-real`: before each launch, copy the selected real profile
     (`Default`, `Profile N`, read from the browser's `Local State`) plus
     `Local State` into a tool-owned directory and launch the real browser
     executable on it. Read-only on the source; never write to the user's
     profile. Skip lock files and caches. Warn when the browser is running
     (the snapshot may be slightly stale).
   - `ephemeral`: a temporary profile deleted afterwards (today's behaviour).
4. Recordings store the browser id and profile mode (not cookies). Replay
   launches the same browser and profile; if the browser is missing on this
   machine, fall back to the bundled Chromium with a visible warning.
5. A profile can be used by one process at a time; recording and replay must
   detect the lock and report it clearly instead of hanging.
6. Tests stay headless. Real-browser tests are opt-in
   (`BROWSER_RECORDER_REAL_BROWSER_TESTS=1`) and never touch the user's real
   profile directory: they copy from a fixture profile.

## Risks

- Patchright is a smaller community fork (supply chain): pin exactly, keep
  the 3-day release cooldown, audit.
- Patchright's route-based init scripts can conflict with our CDP
  `Page.addScriptToEvaluateOnNewDocument` isolated world; verify capture still
  works on Patchright with real tests.
- Copying a live profile while the browser runs can catch a SQLite file
  mid-write; copy `-wal`/`-journal` siblings together and retry on failure.
- Windows app-bound cookie encryption may refuse a copied profile in some
  browsers; detect and report instead of failing silently.
