# Security Policy

## Supported versions

| Version                | Supported |
| ---------------------- | --------- |
| Latest release (`0.x`) | Yes       |
| Older releases         | No        |

Only the latest release receives security fixes. Update to it before
reporting.

## Reporting a vulnerability

Please do not open a public issue. Report it privately through
[GitHub's private vulnerability reporting](https://github.com/juanjoGonDev/browser-recorder/security/advisories/new).

Include the browser-recorder version, your OS and Node.js version, the steps to
reproduce, and the impact you observed. You will get a reply within 7 days.
Once a fix is released, the advisory is published with credit to you unless you
prefer otherwise.

## Scope

In scope: code execution through generated scripts, leaking recorded values
outside the local `recordings/` folder, privilege escalation, and unsafe
handling of untrusted pages or recordings. Recordings are plaintext by design
(see below): that alone is documented behavior, not a vulnerability, but a way
to leak them unexpectedly is. Out of scope: vulnerabilities in Chromium or
Playwright themselves (report those upstream) and issues that need an already
compromised local machine.

## What to know about the data it handles

- **Recordings are plaintext.** Everything typed during a session, including
  passwords, is stored as typed in `recordings/<slug>/recording.json` and in the
  generated `script.mjs`. Password fields are only flagged (`isSensitive`), not
  masked in the file; the terminal UI never shows their value. `recordings/` is
  git-ignored. Do not commit, share or paste its contents, and delete a
  recording once it has served its purpose.
- **Replay runs generated code.** A replay is `node recordings/<slug>/script.mjs`.
  Every recorded value reaches that file through `JSON.stringify`, so a hostile
  page cannot inject code into it, but treat a `recordings/` folder from someone
  else like any other script before running it.
- **Nothing runs in the recorded page's own context.** The capture script runs
  in a separate Chromium isolated world: page scripts cannot see it, its channel
  or its globals, and the page's Content-Security-Policy does not apply to it.
  The same holds for replay: generated scripts set scroll positions through a
  DevTools isolated world and never call `evaluate` in the page.
- **No network service and no telemetry.** The app listens on no port and sends
  nothing anywhere. The only network access is Playwright downloading Chromium
  on first use.
- **No privilege escalation.** The app never runs `sudo` or an installer with
  elevated rights. On Linux it prints the command for missing system libraries
  and leaves running it to you.
