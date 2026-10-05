# browser-recorder

[![CI](https://github.com/juanjoGonDev/browser-recorder/actions/workflows/ci.yml/badge.svg)](https://github.com/juanjoGonDev/browser-recorder/actions/workflows/ci.yml)
[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-blue)](LICENSE)

Record a real browser session and get a faithful, plain
[Patchright](https://www.npmjs.com/package/patchright) script back
(Patchright is a Playwright-compatible engine), managed from a terminal UI. You
click, type, scroll, drag and answer dialogs in a real Chromium-based browser
window; the app writes a `script.mjs` that replays it with the same timing, and
lets you replay, rename and delete recordings from a library.

## Requirements

- Node.js 22.13 or newer.
- [pnpm](https://pnpm.io) 10.16 or newer.
- An interactive terminal for the UI (it refuses to start through a pipe). The
  `replay` command line below works without one.
- Chromium: installed for you on first start (about 150 MB, one time) through
  Patchright. If that install fails (for example offline), the screen shows
  the installer's exit code and the manual command
  (`pnpm exec patchright install chromium`). If another browser was detected
  you can still record with it; press `l` to keep using the library (list,
  rename, delete, timeline), or `enter` to retry.

On Linux, Chromium also needs system libraries. If the browser fails to launch
for missing libraries, the app prints the command and leaves running it to you:

```sh
sudo pnpm exec patchright install-deps chromium
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

1. **New recording**: type a name and, optionally, a start URL (http or https),
   then pick a browser and a profile (see below). A browser window opens; use
   it as you normally would.
2. The timeline fills in live. Press `s` to stop and save, or `x` to discard.
   Closing the browser window also saves and ends the recording.
3. **Library**: pick a recording to replay, view its timeline, rename or delete
   it.
4. A replay opens a browser, runs the script and shows each step with how far
   it drifted from the recorded time. Press `h` in the library first to replay
   with human-like pauses instead (see below); the choice is for that replay
   only and is never remembered.

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

| Where             | Keys                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Everywhere        | `Ctrl+C` saves a live recording and quits                                                                                     |
| Menus and lists   | `Up` / `Down` or `k` / `j`, `PgUp` / `PgDn`, `Enter` to open, `q` to quit                                                     |
| New recording     | `Tab` / `Up` / `Down` switch field, `Left` / `Right` change the browser or profile, `Enter` start, `Esc` back, `Ctrl+U` clear |
| Recording         | `s` stop and save, `x` discard (then `y` / `n`)                                                                               |
| Recording dialogs | `a` accept, `d` dismiss; prompt: type the text, `Enter` accept, `Esc` dismiss                                                 |
| Library           | `Enter` / `p` replay, `h` human or recorded timing, `t` timeline, `r` rename, `d` delete (`y` / `n`), `n` new                 |
| Timeline          | `Up` / `Down`, `PgUp` / `PgDn`, `Esc` back                                                                                    |
| Replay            | `c` or `Esc` cancel while running, `Esc` back when finished                                                                   |

`NO_COLOR` turns colors off.

## Command line

Replay one saved recording without opening the UI:

```sh
browser-recorder replay <name|slug> [options]
pnpm replay <name|slug> [options]      # builds first, then the same command
```

The argument is matched against the recording's slug first, then against its
name ignoring case. No match, or a name that two recordings share, exits with
code 2 and (for a shared name) lists the slugs to choose from. Running
`browser-recorder` with no argument still opens the terminal UI.

| Option                  | What it does                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| `-r, --random`          | Human-like pauses between steps (see below), using the default range `250-900`.                 |
| `-d, --delay <min-max>` | The pause range in milliseconds, whole numbers, `0 <= min <= max <= 60000`; implies `--random`. |
| `--headless`            | Run without a visible browser window.                                                           |
| `-h, --help`            | Print the usage and exit 0.                                                                     |
| `-v, --version`         | Print the version of `package.json` and exit 0.                                                 |

Without `-r` or `-d` the replay keeps the recorded timing, exactly as the UI
does. Options go after the recording: `pnpm replay demo -r -d 100-300`.

**Output.** Each step prints one line on stdout (`[3/12] click Save button
(1.2s)`) and the run ends with `✔ <name> replayed in <s>`. Warnings, such as
falling back to the bundled Chromium, errors and the usage after a mistake go
to stderr. A failure prints `✖ <name> failed at step <n> (<kind>): <message>`
and the last stderr lines of the script, also on stderr. Typed values, passwords
included, are never printed: a step shows what it acts on, not what it types.
Colors appear only on a terminal and never with `NO_COLOR`; a pipe gets plain
text. The command never installs a browser: when Chromium is missing it prints
the manual command (`pnpm exec patchright install chromium`) and exits 1.

| Exit code | Meaning                                                           |
| --------- | ----------------------------------------------------------------- |
| 0         | The replay succeeded                                              |
| 1         | The replay failed, could not start, or the recording is invalid   |
| 2         | Usage error, recording not found or ambiguous                     |
| 130       | Interrupted with Ctrl+C (143 when the process received `SIGTERM`) |

Ctrl+C cancels cleanly: the script closes the browser, the temporary profile is
deleted and the command prints `■ <name> cancelled` before it exits. On Windows
Ctrl+C and Ctrl+Break take the same path; the automated Ctrl+C test is skipped
there because Node cannot send `SIGINT` to a child process on that platform.

### Human timing

By default a replay waits until each step's recorded offset. In human mode it
instead waits a random delay in the range after the previous step finished: no
wait before the first step, and none before a step that only observes a
consequence (a URL change, a dialog, a file chooser or a tab opened by an
action). Typing is done key by key with a pause of a tenth of the range between
keys, and the field always ends with the exact recorded value. Drift is not
reported in human mode, because the recorded offsets no longer apply.

The mode is chosen at replay time and is not saved in the recording. The script
reads it from the environment, so you can also run it by hand:

| Variable                       | Value                                                         |
| ------------------------------ | ------------------------------------------------------------- |
| `BROWSER_RECORDER_TIMING`      | `recorded` (default; any other value means recorded), `human` |
| `BROWSER_RECORDER_HUMAN_DELAY` | `<min>-<max>` in milliseconds, default `250-900`              |
| `BROWSER_RECORDER_SEED`        | Optional, up to ten digits: the same seed repeats the pauses  |

## Browsers and profiles

The browser picker lists what is installed on this machine, in this order:
Brave, Chrome, Edge, Chromium, Vivaldi and Opera, then the bundled Chromium
(always available, installed on first start). The first detected browser with
a managed profile is preselected. Firefox and Safari are not supported: the
recorder drives Chromium-based browsers only.

Each recording remembers its browser and profile mode, and a replay uses the
same ones. If that browser is gone, the replay runs on the bundled Chromium and
shows a warning that names the missing browser.

| Profile           | What it is                                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| Managed           | One profile per browser that this tool owns and keeps between recordings and replays: log in once and stay logged in. |
| Copy of a profile | A snapshot of one of the browser's own profiles (`Default`, `Profile 2`, ...), made on every launch.                  |
| Ephemeral         | An empty profile that is deleted when the session ends.                                                               |

Managed, copied and ephemeral profiles live under the tool's own app-data
folder (`~/Library/Application Support/browser-recorder` on macOS,
`%LOCALAPPDATA%\browser-recorder` on Windows, `$XDG_DATA_HOME/browser-recorder`
or `~/.local/share/browser-recorder` on Linux), never next to your browser's
own data.

### Copy of a real profile, explained honestly

- It **copies the profile on every launch** into a fresh private folder and
  deletes the copy afterwards. It never modifies the original: the copy opens
  files read-only, and a test checks that the source stays byte for byte the
  same. Close the browser first when you can; if it is running, the snapshot
  may miss its latest changes and the screen says so.
- Why a copy and not the profile itself: since Chrome 136 a browser refuses to
  expose remote debugging on its default profile directory, and two browsers
  cannot share one profile folder anyway.
- A copy keeps your logins only if the browser can decrypt the cookies again.
  On macOS the browser reads its key from the keychain, so the system may ask
  for permission the first time. On Windows, Chrome, Brave and Edge protect new
  cookies with app-bound encryption that only the original install can open:
  the recorder warns before launching, and the copy probably will not be logged
  in.
- Opera keeps its profile directly in its data folder, so copying a profile is
  not offered for it; use managed or ephemeral.
- A profile that another browser process holds cannot be launched twice: the
  recorder shows an error naming the browser instead of hanging.

## Where things are stored

```
recordings/<slug>/recording.json   the recorded events (source of truth)
recordings/<slug>/script.mjs       the generated Patchright script
recordings/<slug>/files/           files for file inputs, picked by name
```

`script.mjs` is plain ESM that imports only `patchright`. The replay passes it
the browser through four environment variables
(`BROWSER_RECORDER_EXECUTABLE_PATH`, `BROWSER_RECORDER_USER_DATA_DIR`,
`BROWSER_RECORDER_BROWSER_ARGS`, `BROWSER_RECORDER_REAL_KEYCHAIN`); run on its
own it uses the bundled Chromium on a temporary profile. A script written by an
older version is regenerated before every replay. It prints
`::step <index> <ms>` before each step, `::done <ms>` at the end and
`::error ...` on failure. In the default recorded mode it sleeps until each
step's recorded offset, so a slow step does not shift the ones after it; see
Human timing for the other mode. Run one yourself with
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
`BROWSER_RECORDER_HEADED_TESTS=1` is set. The tests never read or write your
real browser profiles or app-data folders: they run on an isolated home.

Tests that launch your installed browser are opt-in, because they depend on
what is installed on the machine:

```sh
BROWSER_RECORDER_REAL_BROWSER_TESTS=1 pnpm test
```

They copy only from the made-up profiles under `tests/fixtures/profiles` (a
test asserts that), launch the detected browser headless and check that the
fixture stays unchanged. On macOS they may trigger a keychain prompt, because
a copy of a profile uses the real keychain. Set
`BROWSER_RECORDER_REAL_BROWSER_PATH` to point them at a browser that is not
in the catalogue. The layout and the working agreements are in
[AGENTS.md](AGENTS.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities privately, as
described in [SECURITY.md](SECURITY.md).

## License

browser-recorder is source-available under the
[PolyForm Noncommercial License 1.0.0](LICENSE). It is free to use, modify and
share for non-commercial purposes. Commercial use requires permission from the
author: contact the owner through
[GitHub](https://github.com/juanjoGonDev). This is not an OSI-approved open
source license (it is not an OSI open-source license), so the software is
source-available rather than open source.
