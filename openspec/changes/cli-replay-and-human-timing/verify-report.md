validator unavailable (gentle-ai 3.7.0); persisted by orchestrator override

```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:a8ed4923f3a76dbce0154400e67435c6a0b2ee477c361ee5b2779f3bcaead3ab
verdict: fail
blockers: 1
critical_findings: 1
requirements: 15/16
scenarios: 37/40
test_command: pnpm test:coverage
test_exit_code: 0
test_output_hash: sha256:dc4348f6cea4974900331805895a3b01332c1ab2b572a8979749e392ac2bc508
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:ba41b571ad7aeb5a053a3afd1ac7fbd95c43f8708ac2e384f12e4ff2a4f957b8
```

## Verification Report

**Change**: cli-replay-and-human-timing
**Version**: N/A (delta specs: cli, replay, script-generation, tui, repository-quality)
**Mode**: Strict TDD (Vitest)
**Candidate**: HEAD `d73203d` on `feat/bootstrap-browser-recorder`, base `9a3b8af`, clean worktree

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 26 |
| Tasks complete | 26 |
| Tasks incomplete | 0 |

### Build & Tests Execution
All gates ran headless (`BROWSER_RECORDER_HEADLESS=1` from vitest config; opt-in real-browser suite skipped).

| Command | Exit | Result |
|---------|------|--------|
| `pnpm quality` (typecheck x3, lint:strict, format:check, knip, depcruise, test) | 0 | 186 files passed, 1 skipped; 2180 tests passed, 6 skipped |
| `pnpm test:coverage` | 0 | 2180 passed, 6 skipped; Stmts 97.48 %, Branches 93.18 %, Funcs 97.77 %, Lines 98.36 % |
| `pnpm build` | 0 | dist built |
| `pnpm audit` | 0 | No known vulnerabilities found |

Skipped: `tests/integration/real-browser/real-browser.test.ts` (4, opt-in real profile) and 2 in `headed-dialog.test.ts` (headed). Not run, by instruction.

`quality` output hash: sha256:02d0f4e025b8d7f77f7a55c87298e4e77734d4528a89584acbdba5d32392556b; `audit` output hash: sha256:15950a68a7ed99c59779717acefdceb3f69cfd31bde67d2c954f2a3cea4d7955.

### CLI smokes (`node dist/main.js`, isolated package root in the scratchpad, isolated HOME, headless)
| Argv | Exit | Observed |
|------|------|----------|
| `--version` | 0 | `0.1.0` on stdout |
| `-h` | 0 | usage on stdout |
| `replay demo --headless` | 0 | 4 step lines + `✔ My Flow replayed in 0.5s`, stderr empty |
| `replay "my flow" --headless -r` | 0 | case-insensitive name, human pauses (250-900) visible in elapsed |
| `replay "MY FLOW" --headless -d 10-20` (seed 7) | 0 | human timing with custom range |
| `replay broken --headless` (locator gone) | 1 | stdout steps; stderr `✖ Broken failed at step 4 (click): locator.click: Timeout 30000ms exceeded.` + call-log tail |
| `replay LOGIN` (slugs login-a, login-b) | 2 | stderr lists both slugs |
| `replay nope` / `replay` / `replay demo -d` / `replay demo --nope` / `foo` | 2 | reason + usage on stderr, stdout empty |
| `-d abc`, `1.5-3`, `900-250`, `0-60001`, `500`, `--delay=-5-10` | 2 | each names the broken rule |
| `-d -5-10` | 2 | Node's "argument is ambiguous ... use --delay=-XYZ" message |
| spawned `replay demo -d 8000-8000` + SIGINT / SIGTERM | 130 / 143 | `■ My Flow cancelled`, no browser left, profile copy removed |
| `NO_COLOR=1 ... | cat -v` | 0 | 0 escape sequences |
| bundled Chromium absent (isolated HOME without `PLAYWRIGHT_BROWSERS_PATH`) | 1 | `✖ My Flow failed: The replay exited with code 1.` then Patchright's banner tail recommending `npx playwright install`; the project command `pnpm exec patchright install chromium` is NOT printed (see CRITICAL 1) |
| `pnpm replay --help`, `pnpm replay demo -r -d 900-250` (repo root) | 0, 2 | arguments are forwarded; pnpm adds its own `> ...` banner and `ELIFECYCLE` line |
| `recording.json` sha1 before/after all replays | n/a | unchanged (`7acf6fc8...`) |

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| cli: Command dispatch | No subcommand | `tests/e2e/cli-replay.test.ts > still refuses to open the interactive recorder without a terminal`; `run-tui-app.test.ts` | ✅ COMPLIANT |
| cli: Command dispatch | Help and version | `cli-replay.test.ts > prints the usage and the package version with exit 0`; `run-cli-app.test.ts`, `run-cli.test.ts` | ✅ COMPLIANT |
| cli: Command dispatch | Unknown subcommand | `cli-replay.test.ts > exits 2 for ["foo"]`; `run-cli.test.ts` | ✅ COMPLIANT |
| cli: Argument validation | Unknown flag | `cli-replay.test.ts > exits 2 for [...,"--nope"]`; `run-cli.test.ts > names a refused option and spawns nothing` | ✅ COMPLIANT |
| cli: Argument validation | Missing argument | `cli-replay.test.ts > exits 2 for ["replay"]`; `run-cli-app.test.ts > exits 2 for a missing recording name and a missing -d value` | ✅ COMPLIANT |
| cli: Delay range | Valid ranges | `parse-delay-range.test.ts > accepts %s` | ✅ COMPLIANT |
| cli: Delay range | Invalid ranges | `parse-delay-range.test.ts`, `run-cli-app.test.ts` (each exit 2), `tokenize-argv.test.ts` (`-d -5-10`) | ✅ COMPLIANT |
| cli: Delay range | Defaults | `interpret-arguments.test.ts`, `run-replay-command.test.ts > starts the replay with the timing...`, `timing-environment.test.ts`, `launch-replay.test.ts` | ✅ COMPLIANT |
| cli: Recording lookup | Slug vs display name | `find-recording.test.ts > prefers an exact slug over a display name` | ✅ COMPLIANT |
| cli: Recording lookup | Case-insensitive name | `find-recording.test.ts`; `cli-replay.test.ts` human-mode run uses `Typing Flow` | ✅ COMPLIANT |
| cli: Recording lookup | Ambiguous | `run-replay-command.test.ts > exits 2 and lists every candidate slug`; `find-recording.test.ts` | ✅ COMPLIANT |
| cli: Recording lookup | Not found | `cli-replay.test.ts > exits 2 for ["replay","does-not-exist"]` | ✅ COMPLIANT |
| cli: Output streams | Success | `cli-replay.test.ts > replays in recorded mode, prints each step and exits 0 with an empty stderr` | ✅ COMPLIANT |
| cli: Output streams | Failure | `run-replay-command.test.ts > names the failing step on stderr with the script tail and exits 1`; `cli-replay.test.ts > reports a failing step on stderr and exits 1` | ✅ COMPLIANT |
| cli: Output streams | Fallback warning | `run-replay-command.test.ts > keeps the warnings on stderr and still replays` | ✅ COMPLIANT |
| cli: Color handling | Plain output | `stream-output.test.ts` (NO_COLOR, per-stream TTY); `cli-replay.test.ts` (pipe, no `\x1b[`) | ✅ COMPLIANT |
| cli: Exit codes and cancellation | Ctrl+C | `cli-replay.test.ts > cancels on SIGINT`; `run-replay-command.test.ts` (130, 143) | ✅ COMPLIANT |
| replay: Timing mode in replay request | Human env | `timing-environment.test.ts`, `replay-runner.test.ts > hands human timing to the script` | ✅ COMPLIANT |
| replay: Timing mode in replay request | Default | `timing-environment.test.ts` (recorded); `recording.json` unchanged only by verify smoke | ⚠️ PARTIAL |
| replay: Timing mode in replay request | Seed forwarded | `timing-environment.test.ts`, `replay-runner.test.ts > forwards the seed`, `launch-replay.test.ts` | ✅ COMPLIANT |
| replay: Timing tolerance | Timing check | `tests/e2e/record-replay-roundtrip.test.ts` (DRIFT_TOLERANCE_MS 100, headless) | ✅ COMPLIANT |
| replay: Timing tolerance | No drift in human mode | `replay-runner.test.ts > reports no drift in human mode`, `launch-replay.test.ts`, `timeline-replay-screens.test.ts` | ✅ COMPLIANT |
| repository-quality: Replay script alias | Alias | `replay-script.test.ts` (string pin only); forwarding proven by verify smoke | ⚠️ PARTIAL |
| repository-quality: Replay script alias | Version untouched | no committed test (design choice); `git diff 9a3b8af -- package.json` shows only the `replay` script, version `0.1.0` | ⚠️ PARTIAL |
| repository-quality: Dependency direction for CLI | Layer violation | `depcruise-rules.test.ts > keeps the cli feature pure...` | ✅ COMPLIANT |
| repository-quality: Dependency direction for CLI | Console use | `eslint-rules.test.ts` (`cli/uses-console.ts` -> `no-console`) | ✅ COMPLIANT |
| script-generation: Timing environment contract | Unknown mode | `timing-prelude.test.ts`, `script-prelude.test.ts`, `generate-script.test.ts` (byte-identical for recorded/human/banana) | ✅ COMPLIANT |
| script-generation: Human timing mode | Range respected | `timing-prelude.test.ts > keeps every inter-step wait inside the range` | ✅ COMPLIANT |
| script-generation: Human timing mode | First step | `timing-prelude.test.ts > does not wait before the first step...` | ✅ COMPLIANT |
| script-generation: Human timing mode | Typed fill | `script-prelude-fill.test.ts`; `cli-replay.test.ts > types in human mode ... exact value` | ✅ COMPLIANT |
| script-generation: Human timing mode | Sensitive value | `script-prelude-fill.test.ts`; `cli-replay.test.ts > prints a sensitive value nowhere` | ✅ COMPLIANT |
| script-generation: Human timing mode | Seeded determinism | `timing-prelude.test.ts`, `script-prelude.test.ts > draws the same human delays twice` | ✅ COMPLIANT |
| script-generation: Absolute-offset scheduling | Offset wait | `script-prelude.test.ts > sleeps until the absolute offset` | ✅ COMPLIANT |
| script-generation: Absolute-offset scheduling | Late step | `script-prelude.test.ts > runs a late step immediately` | ✅ COMPLIANT |
| tui: Replay timing toggle | Toggle | `app-reducer.test.ts`, `keymap.test.ts`, `tui-controller-timing.test.ts` | ✅ COMPLIANT |
| tui: Replay timing toggle | Not remembered | `app-reducer.test.ts`, `tui-controller-timing.test.ts > goes back to recorded timing` | ✅ COMPLIANT |
| tui: Replay timing toggle | Mode display | `timeline-replay-screens.test.ts`, `library-screen.test.ts` | ✅ COMPLIANT |
| tui: Terminal lifecycle | Exit restore | `node-terminal.test.ts > restores raw mode, the cursor and the primary screen` | ✅ COMPLIANT |
| tui: Terminal lifecycle | Non-TTY | `cli-replay.test.ts`, `run-tui-app.test.ts > refuses a pipe` | ✅ COMPLIANT |
| tui: Terminal lifecycle | Non-TTY replay | `cli-replay.test.ts` (every replay runs with piped stdio) | ✅ COMPLIANT |

**Compliance summary**: 37/40 scenarios compliant, 3 partial, 0 failing, 0 untested.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| cli: Command dispatch | ✅ Implemented | `src/main.ts`: no argv -> TUI, any argv -> `runCliApp` |
| cli: Argument validation | ✅ Implemented | `tokenize-argv.ts` wraps `parseArgs` (strict) |
| cli: Delay range | ✅ Implemented | `parse-delay-range.ts`, `interpret-arguments.ts` |
| cli: Recording lookup | ✅ Implemented | `find-recording.ts`, input never becomes a path |
| cli: Output streams | ❌ Partly | Missing bundled Chromium is not reported with the manual install command (CRITICAL 1) |
| cli: Color handling | ✅ Implemented | `stream-output.ts` per-stream TTY + NO_COLOR |
| cli: Exit codes and cancellation | ✅ Implemented | 0/1/2/130/143 verified at runtime |
| replay: Timing mode in replay request | ✅ Implemented | `timing-environment.ts`; timing never persisted |
| replay: Timing tolerance | ✅ Implemented | `isDriftTracked` |
| repository-quality: Replay script alias | ✅ Implemented | only `replay` script added vs `9a3b8af` |
| repository-quality: Dependency direction for CLI | ✅ Implemented | generic depcruise rules + `no-console` |
| script-generation: Timing environment contract | ✅ Implemented | `timing-prelude.ts` |
| script-generation: Human timing mode | ✅ Implemented | mulberry32, `rt.fill` with `pressSequentially` + reconcile |
| script-generation: Absolute-offset scheduling | ✅ Implemented | `rt.at(offset, { isFollowUp })` |
| tui: Replay timing toggle | ✅ Implemented | `h` on library, reset on open |
| tui: Terminal lifecycle | ✅ Implemented | TTY required only without subcommand |

Standing hard requirements:
| Rule | Result |
|------|--------|
| Patchright only | ✅ `dependencies` = `{ patchright: 1.63.0 }`; no `playwright` import; generate-script test restricts imports to `patchright` and `node:` |
| No `Runtime.enable` / `Console.enable` | ✅ none in `src`; `script-prelude.test.ts > never sends the enable calls` passes |
| No main-world code | ✅ diff adds no `evaluate`, `addInitScript`, `exposeBinding`/`exposeFunction`; new calls are `fill`, `pressSequentially`, `inputValue` (Patchright isolated injected script) |
| Headless tests only | ✅ vitest env `BROWSER_RECORDER_HEADLESS=1`; opt-in real-browser suite skipped |
| Zero vulnerabilities | ✅ `pnpm audit` clean |
| Exact pins | ✅ all versions exact; `pnpm-lock.yaml` unchanged vs base |
| Strict lint/knip/depcruise | ✅ inside `pnpm quality` (exit 0) |
| No version change | ✅ `git diff 9a3b8af..HEAD -- package.json` adds only `"replay"`; version `0.1.0` |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| `parseArgs` in adapter, pure `interpret-arguments` | ✅ Yes | |
| Shared `replay-timing.ts` / `terminal-text.ts` | ✅ Yes | TUI imports updated |
| `launch-replay.ts` shared, "checks bundled Chromium (manual command, no install)" | ⚠️ Partly | Check only runs when the planner throws; the planner never throws for `bundled` (catalog always lists it) |
| `CommandOutput` port, EPIPE ignored, `flush` | ✅ Yes | |
| Color only when stdout is a TTY | ⚠️ Deviation | Implemented per stream (stderr colored when stderr is a TTY even if stdout is piped) |
| Human scheduling, follow-ups never wait | ✅ Yes | first `page-opened` treated as follow-up (documented) |
| mulberry32 PRNG, seed `^\d{1,10}$` | ✅ Yes | |
| `rt.fill` with reconcile, key pause = range/10 | ✅ Yes | |
| Cancellation (SIGINT/SIGTERM/SIGBREAK, 130/143, `handleSIGINT/handleSIGTERM: false`) | ✅ Yes | verified at runtime |
| Drift null in human mode | ✅ Yes | |
| Dispatch in `main.ts`, lazy services | ✅ Yes | |
| No new depcruise rule | ✅ Yes | characterization tests added |

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | Table in `apply-progress.md` / engram `sdd/cli-replay-and-human-timing/apply-progress` |
| All tasks have tests | ✅ | 22/26 rows have test files; 1.0 is a spike, 1.8/2.5/3.10 are refactor gates |
| RED confirmed (tests exist) | ✅ | every listed test file exists |
| GREEN confirmed (tests pass) | ✅ | all listed files pass in this run |
| Triangulation adequate | ✅ | multiple cases per behavior; 3.8 depcruise/eslint cases are characterization tests (declared) |
| Safety Net for modified files | ✅ | modified files report prior passing counts |

**TDD Compliance**: 6/6 checks passed

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | most of the 50 changed test files | 47 | Vitest |
| Integration | composition services | 2 | Vitest + fakes |
| E2E | 13 (cli-replay) + existing round trips | 1 new | Vitest, headless Patchright, temp package root |

### Changed File Coverage
All changed executable `src` files are at or above 90 % lines. Lowest: `tui/application/replay-flow.ts` 90.47 % lines / 50 % branches, `tui/application/tui-controller.ts` 91.89 % / 81.63 %, `composition/run-cli-app.ts` 100 % / 50 % branches, `cli/application/run-replay-command.ts` 97.61 % / 78.57 %. Type-only ports and `src/main.ts` are excluded by config.

**Average changed file coverage**: about 99 % lines.

### Assertion Quality
| File | Line | Assertion | Issue | Severity |
|------|------|-----------|-------|----------|
| `tests/unit/repository/replay-script.test.ts` | 33-36 | ``expect(`${script} demo -r`).toBe('... replay demo -r')`` | Restates the script string; does not prove that pnpm forwards arguments | WARNING |

No tautologies, ghost loops (all loops iterate literal arrays or non-empty fixtures), or mock-heavy files.

**Assertion quality**: 0 CRITICAL, 1 WARNING

### Quality Metrics
**Linter**: ✅ No errors (`eslint . --max-warnings 0`)
**Type Checker**: ✅ No errors (node, in-page, tests)

### Issues Found
**CRITICAL**:
1. Missing bundled Chromium is not reported with the manual install command (cli: Output streams, "MUST report the manual install command on stderr"; README promises `pnpm exec patchright install chromium` and exit 1). `src/composition/launch-replay.ts` `planReplay` only calls `installation.isInstalled()` when `planner.forReplay` throws, but `createBrowserCatalog` always lists `bundled`, so for a bundled recording (the default) the plan succeeds and the script fails at launch. Reproduced: `node dist/main.js replay demo` with an isolated HOME and no browsers path prints `✖ My Flow failed: The replay exited with code 1.` followed by Patchright's banner tail recommending `npx playwright install` (wrong tool); the real reason line is cut by the 10-line tail. `launch-replay.test.ts > names the manual install command when Chromium is missing` only covers a planner failure that production never raises for `bundled`. Fix: when the plan target is bundled (`executablePath === null`) and `isInstalled()` is false, reject before spawning with `MANUAL_INSTALL_COMMAND`; add a test where `forReplay` succeeds with a bundled target and `isInstalled` is false.

**WARNING**:
1. Scenario "Default" (replay) is partial: no automated test asserts `recording.json` is unchanged after a replay (verified only by smoke hash).
2. Scenario "Alias" is partial: the test pins the script text; argument forwarding is proven only by a manual smoke.
3. Scenario "Version untouched" has no committed test (documented design choice); verified by `git diff 9a3b8af -- package.json`.
4. `proposal.md` still lists "Minor version bump (feature)" in scope, contradicting the spec, design, tasks and the owner rule; the code is correct (no bump).
5. Color is decided per stream (`hasErrColor` uses `stderr.isTTY`), while the design says color is on only when stdout is a TTY; with stdout piped and stderr on a terminal, stderr lines are colored. Align the design/spec wording or the code.

**SUGGESTION**:
1. `-d -5-10` (space form) is rejected by `parseArgs` with Node's "argument is ambiguous" text rather than a range rule; consider mapping it to the range message.
2. `pnpm replay` prints pnpm's `> browser-recorder@0.1.0 replay ...` banner and an `ELIFECYCLE` line on failure; document `pnpm -s replay` for clean output.
3. When the script fails before any step, the summary is the generic `The replay exited with code 1.`; consider promoting the script's first error line into the summary.
4. Branch coverage of `run-cli-app.ts` and `replay-flow.ts` is 50 %; add the missing branch cases.

### Verdict
FAIL
One CRITICAL: the CLI does not report the manual install command when bundled Chromium is missing, which a spec MUST and the README both promise; every gate, test and the rest of the requirements pass.
