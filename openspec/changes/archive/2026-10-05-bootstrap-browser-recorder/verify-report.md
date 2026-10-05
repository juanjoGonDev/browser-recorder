<!-- validator unavailable (gentle-ai 3.7.0); persisted by orchestrator override -->
```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:673557eda8c02bf4210e13cc2d1407a66d8d8d0b3a2a5a6dbc3283dfd30b126d
verdict: pass
blockers: 0
critical_findings: 0
requirements: 38/40
scenarios: 75/77
test_command: pnpm test:coverage
test_exit_code: 0
test_output_hash: sha256:673557eda8c02bf4210e13cc2d1407a66d8d8d0b3a2a5a6dbc3283dfd30b126d
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:d2e592f642fcb706b08a760a3f8d415fb9d46c4e18c5b023d3d4432756c7df3a
```

## Verification Report (re-verify after remediation R.1-R.6)

**Change**: bootstrap-browser-recorder
**Version**: N/A (delta specs, 7 capabilities)
**Mode**: Strict TDD
**Branch / HEAD**: feat/bootstrap-browser-recorder @ b9780ed (clean tree)
**Verdict**: PASS WITH WARNINGS (0 CRITICAL, 2 WARNING, 4 SUGGESTION)

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 77 (0.1-0.16, 1.1-1.8, 2.1-2.12, 3.1-3.6, 4.1-4.7, 5.1-5.8, 6.1-6.7, 7.1-7.7, R.1-R.6) |
| Tasks complete | 77 |
| Tasks incomplete | 0 |

### Build & Tests Execution (run by the verifier, headless)
| Gate | Command | Exit | Result | Output hash |
|------|---------|------|--------|-------------|
| Quality | `pnpm quality` (typecheck x3, lint:strict, format:check, knip, deps:check, vitest) | 0 | 109 files, 1306 passed, 2 skipped; depcruise 156 modules / 0 violations | sha256:ada776c6e5286033561e0952f0074d871105ced1d836f93faf644565c5ef12ab |
| Coverage | `pnpm test:coverage` | 0 | 1306 passed, 2 skipped; All files 96.81 stmts / 92.69 branches / 97.15 funcs / 97.97 lines; thresholds met | sha256:673557eda8c02bf4210e13cc2d1407a66d8d8d0b3a2a5a6dbc3283dfd30b126d |
| Build | `pnpm build` | 0 | dist emitted | sha256:d2e592f642fcb706b08a760a3f8d415fb9d46c4e18c5b023d3d4432756c7df3a |
| Audit | `pnpm audit` (`--audit-level=moderate`) | 0 | No known vulnerabilities found | sha256:cd6bee28552e5bab1070e6b001312600c7db815bf2b6a30eb5ee2c5a083ca8c7 |

The 2 skipped tests are the headed-dialog checks in `tests/integration/recording-capture/headed-dialog.test.ts`, opt-in only through `BROWSER_RECORDER_HEADED_TESTS=1` (not set). No browser window was opened by any run.

### Previous findings re-checked
| Previous finding | Status | Evidence |
|---|---|---|
| CRITICAL-1 install exit code not shown | RESOLVED | `src/environment-setup/application/ensure-browser.ts` `failed` carries `exitCode: number \| null`; `src/tui/render/screens/setup-screen.ts` prints "The installer failed with exit code N." plus `pnpm exec playwright install chromium`; `tests/unit/tui/menu-setup-form-screens.test.ts` (7, 137, null), `tests/unit/environment-setup/ensure-browser.test.ts` pass |
| CRITICAL-2 library unusable after failed install | RESOLVED | `AppState.isBrowserAvailable` (`src/tui/domain/reduce-setup.ts`); setup `l` opens the library; controller refuses new recording and replay with `BROWSER_REQUIRED_REASON`; `tests/unit/tui/tui-controller.test.ts` offline block covers list, rename, delete, timeline, refused replay (enter and p), refused new from menu and library, retry restore |
| WARNING-1 replay scroll in main world | RESOLVED | `rt.scrollTo` in `src/script-generation/domain/script-prelude.ts` uses `Page.createIsolatedWorld` + `Runtime.callFunctionOn`; element paths via Playwright selector engine (utility world); handle adoption is `DOM.resolveNode` only (no script). `tests/integration/script-generation/generated-script.test.ts` asserts exact window/element/iframe positions and 0 spy calls, no new globals or own properties in both frames; `scroll-runtime.test.ts` covers OOPIF (`--site-per-process`), nth, missing element; unit guard in `generate-script.test.ts` bans evaluate-family APIs in every golden |
| WARNING-2 duplicate-id assertion | PARTIALLY RESOLVED | See WARNING-2 below |
| WARNING-4 hover noise before check | RESOLVED | `dropHoverBeforeAction` covers click/dblclick/check/fill/select-option; in-page `isLabelOf` treats the control's label as the target; e2e asserts exactly `['goto','fill','check','click']` |
| WARNING-5 uniqueness assertion | RESOLVED | `build-locator.test.ts` "never offers a candidate Playwright finds more than once" checks `count() === 1` for every candidate, guarded by `expect(checked).toBeGreaterThan(20)` (no ghost loop) |
| SUGGESTION `.npmrc` Electron comment | RESOLVED | b9a1f5d |

### Hard requirements
| Requirement | Status | Evidence |
|---|---|---|
| Recording uses CDP + isolated world only | PASS | `grep` over `src/`: no `evaluate`, `evaluateHandle`, `addInitScript`, `exposeBinding`, `exposeFunction`, `waitForFunction`, `$eval`, `Runtime.evaluate`. Capture uses `Page.addScriptToEvaluateOnNewDocument{worldName}` + `Runtime.addBinding{executionContextName}` (`isolated-world-capture.ts`); `frame-path-resolver.ts` calls into the isolated context id only |
| Replay-generated code uses CDP + isolated world only | PASS | prelude above; golden guard test; main-world spy integration test |
| Tests headless only | PASS | every `chromium.launch` in tests is `headless: true`, `options.isHeadless` (true in callers), or the opt-in headed gate; generated scripts run with `BROWSER_RECORDER_HEADLESS=1`; the composition test uses a fake launcher |

### Spec Compliance Matrix (requirement level; 40 requirements, 77 scenarios)
| Capability | Requirement | Scenarios | Covering tests (all passed) | Result |
|---|---|---|---|---|
| environment-setup | Chromium detection | Present, Missing | `unit/environment-setup/ensure-browser`, `integration/environment-setup/playwright-browser-installation` | COMPLIANT 2/2 |
| environment-setup | Automatic install | Success, Failure, Offline | `ensure-browser`, `unit/tui/{menu-setup-form-screens,tui-controller,app-reducer,keymap,library-screen}`, `integration/composition/create-app-services` | Failure, Offline COMPLIANT; Success PARTIAL (lands on main menu, see SUGGESTION-1) |
| environment-setup | Linux system dependencies | Missing libs | `unit/environment-setup/linux-deps-hint` | COMPLIANT 1/1 |
| environment-setup | Cross-OS portability | Old Node, Windows spawn | `assert-supported-node`, `resolve-playwright-cli`, `playwright-browser-installation`, `repository/build` | COMPLIANT 2/2 |
| recording-capture | Event coverage | Modified right click, Checkbox state, Dialog, Dialog answered in browser window, Cross-origin iframe | `integration/recording-capture/{pointer-listener,input-listener,playwright-browser-session,out-of-process-frames}`, `unit/.../to-recording-event`, `dialog-registry` | COMPLIANT 5/5 (browser-window answer proven headless through a second CDP client; headed variant opt-in) |
| recording-capture | Navigation fidelity | Reload, Back and forward, Action-triggered navigation | `classify-navigation`, `playwright-browser-session` | COMPLIANT 3/3 |
| recording-capture | Coalescing | Typing, Interleaved target, Hover on the acted-on element | `coalesce-events`, `hover-tracker`, e2e | COMPLIANT 3/3 |
| recording-capture | Locator selection | Duplicate id fallback, Dynamic id | `build-locator`, `locator-verifier`, `is-dynamic-id` | Dynamic id COMPLIANT; Duplicate id PARTIAL (WARNING-2) |
| recording-capture | Monotonic offsets | Clock jump | `stamp-offset`, `session-timeline` | COMPLIANT 1/1 |
| recording-capture | Deterministic hover | CSS menu, No noise | `select-hover-targets`, `hover-tracker` | COMPLIANT 2/2 |
| recording-capture | Interrupted recording safety | Ctrl+C, Browser closed, Crash mid-write | `recording-session`, `composition/exit-after-saving`, `script-library/atomic-write-file` | COMPLIANT 3/3 |
| recording-capture | Sensitive input flag | Password | `input-listener`, `to-recording-event` | COMPLIANT 1/1 |
| replay | Replay by spawning the script | Windows path, Missing script | `resolve-script-path`, `script-checking-spawner`, `replay-runner` | COMPLIANT 2/2 |
| replay | Progress parsing | Split chunk, Noise | `split-lines`, `parse-progress-line` | COMPLIANT 2/2 |
| replay | Timing tolerance | Timing check | e2e drift <= 100 ms, `generated-script` | COMPLIANT 1/1 |
| replay | Exit handling | Failing step, Cancel | `replay-progress`, `replay-runner`, `node-process-spawner` | COMPLIANT 2/2 |
| repository-quality | Dependency hygiene | Audit, Range detected | `dependency-pins`, `pnpm audit` exit 0 | COMPLIANT 2/2 |
| repository-quality | Static analysis | Long function, Bad filename, Layer violation | `eslint-rules`, `depcruise-rules` | COMPLIANT 3/3 |
| repository-quality | Git hooks | Bad commit message, Hooks installed | `commitlint`, `install-hooks`, `install-hooks-entrypoint` | COMPLIANT 2/2 |
| repository-quality | CI and automation | Secret contract, Release | `workflows`, `release-workflow-impact` | COMPLIANT 2/2 |
| repository-quality | Agent documentation | Import | `agent-docs` | COMPLIANT 1/1 |
| repository-quality | Gitignore and local-only | Ignored | `gitignore` | COMPLIANT 1/1 |
| script-generation | Plain Playwright ESM output | Runnable, Deterministic | `generate-script` (goldens, `node --check`) | COMPLIANT 2/2 |
| script-generation | Absolute-offset scheduling | Offset wait, Late step | `script-prelude` (incl. early-timer case), `generated-script` | COMPLIANT 2/2 |
| script-generation | Progress markers | Markers | `script-prelude`, `generated-script` | COMPLIANT 1/1 |
| script-generation | Event-to-code mapping | Multi-tab, Unknown event type | `render-step`, `generate-script`, `generated-script` | COMPLIANT 2/2 |
| script-generation | Safe literals | Injection | `js-literal`, hostile golden | COMPLIANT 1/1 |
| script-generation | Atomic generation | Write failure | `atomic-write-file`, `library-service` | COMPLIANT 1/1 |
| script-library | Storage layout | Create | `file-system-recording-repository`, `library-service` | COMPLIANT 1/1 |
| script-library | Slug generation | Unsafe characters, Collision, Reserved name | `slugify`, `allocate-slug`, `validate-name` | COMPLIANT 3/3 |
| script-library | Listing | Corrupt entry | `library-service` | COMPLIANT 1/1 |
| script-library | Rename | Collision, Same slug | `library-service`, `file-system-recording-repository` | COMPLIANT 2/2 |
| script-library | Delete | Declined, Confirmed | `library-service`, `keymap`, `tui-controller` | COMPLIANT 2/2 |
| script-library | Crash-safe writes | Orphan temp, Schema version | `file-system-recording-repository`, `parse-recording` | COMPLIANT 2/2 |
| tui | Terminal lifecycle | Exit restore, Non-TTY | `node-terminal`, `repository/build` (emitted entry refuses non-TTY) | COMPLIANT 2/2 |
| tui | Library screen | Navigate, Empty library | `app-reducer`, `list-window`, `library-screen` | COMPLIANT 2/2 |
| tui | Create flow | Invalid URL, Empty URL | `validate-start-url`, `tui-controller` | COMPLIANT 2/2 |
| tui | Rename and delete UX | Enter on delete prompt | `keymap`, `tui-controller` | COMPLIANT 1/1 |
| tui | Self-refresh and live timeline | Live recording, Replay highlight, Resize | `frame-scheduler`, `recording-screen`, `timeline-replay-screens`, `list-window` | COMPLIANT 3/3 |
| tui | Pure rendering | Snapshot | `render-app` | COMPLIANT 1/1 |

**Compliance summary**: 75/77 scenarios COMPLIANT, 2 PARTIAL, 0 FAILING, 0 UNTESTED. 38/40 requirements fully compliant.

### Coherence (Design)
| Decision | Followed? | Notes |
|---|---|---|
| No code in the page main world (addendum) | Yes | recording and replay both |
| Isolated-world replay scroll (remediation addendum) | Yes | shadow-tree refusal and 10 s element wait documented |
| Setup failure keeps the library (remediation addendum) | Yes | |
| Hover coalescing incl. label-as-control (remediation addendum) | Yes | |
| Hexagonal layers / screaming structure | Yes | depcruise 0 violations |

### TDD Compliance
| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | Yes | Remediation table in engram `sdd/bootstrap-browser-recorder/apply-progress` (#1257); WP tables in apply-progress-wp1..wp6 |
| All tasks have tests | Yes | R.1-R.5 have tests; R.6 is a comment-only edit (n/a) |
| RED confirmed (tests exist) | Yes | all 16 listed remediation test files exist |
| GREEN confirmed (tests pass) | Yes | all pass in the verifier's runs |
| Triangulation adequate | Yes | exit codes 7/137/0/null; offline list/rename/delete/timeline/refusals; window/element/iframe/OOPIF/nth/missing/shadow; check/fill/select/other-target/press |
| Safety Net for modified files | Yes | full suite green before and after |

**TDD Compliance**: 6/6 checks passed

### Test Layer Distribution
| Layer | Files | Tools |
|---|---|---|
| Unit | 80 | Vitest |
| Integration | 28 | Vitest + headless Playwright Chromium, fixture server |
| E2E | 1 | Vitest + headless Playwright, real composition |
| **Total** | **109** (1306 passed, 2 skipped opt-in headed) | |

### Changed File Coverage
Global: 96.81 stmts / 92.69 branches / 97.15 funcs / 97.97 lines, all thresholds met. Files below 95 % lines or 85 % branches (informational): `scripts/build.ts` 87.5 % lines (L107-109), `scripts/install-hooks.ts` 92.3 % (L69), `page-wiring.ts` 75 % branches (L61-62), `page-registry.ts` 83 % branches, `replay-runner.ts` 83 % branches, `split-lines.ts` 50 % branches (L20), `library-flow.ts` 80 % branches, `replay-flow.ts` 50 % branches (L50, L63), `app-reducer.ts` 82 % branches. None below 80 % lines.

### Assertion Quality
Remediation tests audited: no tautologies, no ghost loops (the uniqueness loop is guarded by `checked > 20`), empty-array assertions in the main-world spy test have companion position assertions in the same fixture, offline refusals pair `replayed: []` with positive inline-error assertions.

**Assertion quality**: 0 CRITICAL, 0 WARNING

### Quality Metrics
**Linter**: No errors (`eslint . --max-warnings 0`)
**Type Checker**: No errors (node, in-page, tests projects)

### Issues Found

**CRITICAL**: None

**WARNING**
1. **Scroll inside a shadow tree is neither recorded nor replayable (fidelity gap against "replicate everything").** The replay runtime refuses it ("Cannot scroll an element inside a shadow tree", `script-prelude.ts` `elementPath`). More importantly, the recorder never captures it: `scroll` events are not composed, so the window capture listener (`in-page/listen.ts`, `scroll-listener.ts`) never sees a scroll of an element inside a shadow root. A headless probe confirmed it: a shadow-root box scrolled to 400 px while the window capture listener received 0 events. Consequence: R.3 removed no capability that was reachable from a real recording (the old `locator.evaluate` path could not be fed by recorded data either), but web-component scroll containers (Lit, Shoelace, Salesforce LWC and similar) silently lose their scroll steps, and the design addendum documents only the replay refusal, not the silent recording gap. No spec scenario covers shadow DOM scroll, so this does not block archive. If shadow scroll is in scope for "replicate everything", add a spec scenario and fix both sides inside the isolated-world constraint: attach the scroll listener to each open shadow root from the isolated world, and resolve the target through `shadowRoot` hops (or via CDP `DOM.describeNode`/`DOM.resolveNode` into the isolated context instead of an XPath index path). Closed shadow roots need CDP `DOM` with `pierce: true`.
2. **Duplicate id fallback is PARTIAL.** The scenario says "the label locator is stored, not `#x`". The test (`build-locator.test.ts` "finds a labelled input behind a duplicated id by its label, not by the id") proves `#x` is absent and a label candidate exists, but the stored locator (`Target.locator`, a single locator) is `role textbox "Second field"`, because role+name ranks above label. The scenario contradicts the requirement's own priority order for any element with an implicit role, and it is exercised through candidate building, not a recorded click. Either amend the scenario to "a label-derived locator (role+name or label) is stored, not `#x`", or use a fixture element without a role and assert the stored target from a recorded click.

**SUGGESTION**
1. Environment-setup "Success" says the app proceeds to the library; `setupReady` lands on the main menu (design keymap has a main menu with Library). Amend the spec text or land on the library.
2. When the installer exits 0 but Chromium is still missing, the screen says "The installer failed with exit code 0." Say "The installer exited 0 but Chromium is still missing." instead.
3. Replay scroll waits 10 s for its element while other steps use Playwright's 30 s default; a slow page fails earlier on a scroll step. Align the defaults or document it in the README.
4. Element-path resolution issues `depth + 3` Playwright selector queries per chain element (two sequential, the rest in parallel); on deep DOMs a scroll step may add latency against the 100 ms drift budget. Consider a single CDP round trip if drift is observed.

### Verdict
PASS WITH WARNINGS. All 77 tasks complete, all four gates exit 0 headless, both previous CRITICAL issues resolved, and no main-world code on the recording or replay path. Two non-blocking warnings remain; the shadow-tree scroll gap needs a user decision on scope.
