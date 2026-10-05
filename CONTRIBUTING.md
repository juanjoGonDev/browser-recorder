# Contributing

Thanks for helping. By participating you agree to the
[Code of Conduct](CODE_OF_CONDUCT.md). Contributions are accepted under the
terms of the [LICENSE](LICENSE) (PolyForm Noncommercial 1.0.0).

## Setup

Requirements: Node.js 22.13 or newer and [pnpm](https://pnpm.io) 10.16 or
newer. pnpm is the only supported package manager: do not use npm or Yarn.

```sh
git clone https://github.com/juanjoGonDev/browser-recorder.git
cd browser-recorder
pnpm install     # also installs the git hooks
```

- macOS: nothing else is needed.
- Windows: use PowerShell or Git Bash. Line endings are normalized to LF by
  `.gitattributes`.
- Linux: Chromium needs system libraries; run
  `sudo pnpm exec patchright install-deps chromium` yourself when asked.

## Scripts

| Script               | Purpose                                              |
| -------------------- | ---------------------------------------------------- |
| `pnpm start`         | Build and open the terminal UI                       |
| `pnpm build`         | Compile and bundle the in-page capture script        |
| `pnpm test`          | Run the Vitest suite                                 |
| `pnpm test:coverage` | Tests with coverage thresholds                       |
| `pnpm quality`       | Typecheck, lint, format, dead code, deps rules, test |
| `pnpm format`        | Format everything with Prettier                      |
| `pnpm audit`         | Dependency audit                                     |

## Git hooks

Lefthook runs Prettier, ESLint, typecheck and build on commit, commitlint on
the message, and the format check and coverage on push. Never bypass them with
`--no-verify`; fix the cause instead.

## Workflow

Work is spec-driven (SDD) and test-first (strict TDD: write a failing test,
make it pass, then refactor). Every behavior change starts with a failing test.
The full working agreement, architecture and naming rules are in
[AGENTS.md](AGENTS.md); read it before your first change.

- Branches: `<type>/<slug>`, for example `feat/replay-speed` or
  `fix/dialog-timeout`.
- Commits and PR titles: [Conventional Commits](https://www.conventionalcommits.org)
  in English. No AI attribution or `Co-Authored-By` trailers.
- Do not rebase or force push; merge `main` into your branch. Pull requests
  are squash-merged.
- Run `pnpm quality` and `pnpm build` before opening a pull request.

## Tests are headless

Every test runs headless: nothing may open a browser window. A test that
genuinely needs a headed browser is skipped unless
`BROWSER_RECORDER_HEADED_TESTS=1` is set.

## Security

Never open a public issue for a vulnerability. Follow [SECURITY.md](SECURITY.md)
and use a private advisory. Never paste a `recordings/` folder: recordings are
plaintext and may contain passwords.
