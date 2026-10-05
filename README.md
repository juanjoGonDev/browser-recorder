# browser-recorder

Record a real browser session and get a faithful, plain
[Playwright](https://playwright.dev) script back, managed from a terminal UI.
You click, type, scroll, drag and answer dialogs in a real Chromium window; the
app writes a `script.mjs` that replays it with the same timing, and lets you
replay, rename and delete recordings from a library.

## Requirements

- Node.js 22.13 or newer.
- [pnpm](https://pnpm.io) 10.16 or newer.
- An interactive terminal (the UI refuses to start through a pipe).
- Chromium: installed for you on first start (about 150 MB, one time) through
  Playwright. If that install fails (for example offline), the screen shows
  the installer's exit code and the manual command
  (`pnpm exec playwright install chromium`); press `l` to keep using the
  library (list, rename, delete, timeline) while recording and replay stay
  disabled, or `enter` to retry.

On Linux, Chromium also needs system libraries. If the browser fails to launch
for missing libraries, the app prints the command and leaves running it to you:

```sh
sudo pnpm exec playwright install-deps chromium
```

## Install and run

```sh
pnpm install
pnpm start        # builds, then opens the terminal UI
```

Or build once and run the entry point directly:

```sh
pnpm build
node dist/main.js     # the same file the `browser-recorder` bin points to
```

## Usage

1. **New recording**: type a name and, optionally, a start URL (http or https).
   A Chromium window opens; use it as you normally would.
2. The timeline fills in live. Press `s` to stop and save, or `x` to discard.
   Closing the browser window also saves and ends the recording.
3. **Library**: pick a recording to replay, view its timeline, rename or delete
   it.
4. A replay opens a browser, runs the script and shows each step with how far
   it drifted from the recorded time.

Dialogs (`alert`, `confirm`, `prompt`) are answered from the recorder: press `a`
to accept, `d` to dismiss, or type the text for a prompt and press Enter. Answers
given in the browser's own dialog are recorded too.

What is captured: clicks (any button, with modifiers), double clicks, checkbox
and radio changes, typing, selects, key presses and shortcuts, scrolling, drag
and drop, file inputs (names only), dialogs, new tabs, page closes, hovers that
open menus, and navigation (goto, redirects, reload, back, forward), including
iframes and cross-origin iframes. Locators are chosen in this order: test id,
role and name, label, placeholder, a stable id, exact text, a CSS path.

### Keys

| Where             | Keys                                                                            |
| ----------------- | ------------------------------------------------------------------------------- |
| Everywhere        | `Ctrl+C` saves a live recording and quits                                       |
| Menus and lists   | `Up` / `Down` or `k` / `j`, `PgUp` / `PgDn`, `Enter` to open, `q` to quit       |
| New recording     | `Tab` / `Up` / `Down` switch field, `Enter` start, `Esc` back, `Ctrl+U` clear   |
| Recording         | `s` stop and save, `x` discard (then `y` / `n`)                                 |
| Recording dialogs | `a` accept, `d` dismiss; prompt: type the text, `Enter` accept, `Esc` dismiss   |
| Library           | `Enter` / `p` replay, `t` timeline, `r` rename, `d` delete (`y` / `n`), `n` new |
| Timeline          | `Up` / `Down`, `PgUp` / `PgDn`, `Esc` back                                      |
| Replay            | `c` or `Esc` cancel while running, `Esc` back when finished                     |

`NO_COLOR` turns colors off.

## Where things are stored

```
recordings/<slug>/recording.json   the recorded events (source of truth)
recordings/<slug>/script.mjs       the generated Playwright script
recordings/<slug>/files/           files for file inputs, picked by name
```

`script.mjs` is plain ESM that imports only `playwright`. It prints
`::step <index> <ms>` before each step, `::done <ms>` at the end and
`::error ...` on failure, and sleeps until each step's recorded offset, so a
slow step does not shift the ones after it. Run one yourself with
`node recordings/<slug>/script.mjs`; set `BROWSER_RECORDER_HEADLESS=1` to run
without a window.

## Recordings are plaintext

Typed values, including passwords, are stored as typed in `recording.json` and
`script.mjs`. Password fields are only flagged, never masked in the files.
`recordings/` is git-ignored: never commit, paste or log its contents. See
[SECURITY.md](SECURITY.md).

## Development

```sh
pnpm quality         # typecheck, lint, format, dead code, dependency rules, tests
pnpm test:coverage   # tests with coverage thresholds
pnpm build           # tsc plus the bundled in-page capture script
```

Every test and probe runs headless: nothing opens a browser window. A test that
genuinely needs a headed browser is skipped unless
`BROWSER_RECORDER_HEADED_TESTS=1` is set. The layout and the working agreements
are in [AGENTS.md](AGENTS.md).
