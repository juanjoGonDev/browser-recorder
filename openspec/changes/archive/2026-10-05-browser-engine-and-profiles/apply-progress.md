# Apply progress: browser-engine-and-profiles

Mode: Strict TDD. Delivery: single PR, `size:exception`. Branch `feat/bootstrap-browser-recorder`.
Status: 61/61 tasks (55 original + R.1-R.6 verify remediation).

Truthfulness note: WP2, WP3 and WP6 reports state "strict TDD" but do not itemise RED per task, so those rows say "not itemised". Rows marked TESTS AFTER CODE or MUTATION-BASED RED are exactly that.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | Triangulate | Refactor |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 0.1-0.3 | `tests/spike/runtime-binding.test.ts`, `isolated-world-reuse.test.ts`, `patchright-install.test.ts` | Spike (headless) | N/A (new) | Written first (tasks marked RED) | Passed; outcomes recorded in design addendum | Spike probes each cover several cases (same/new frame, after navigation) | None needed |
| 0.4 | existing suite (import rename) | Unit / Integration | Full suite before the swap | N/A: dependency swap, mechanical rename | Full suite green on `patchright` | Skipped: single structural change | None needed |
| 0.5 | N/A | N/A | N/A | N/A | Design addendum written | Skipped: documentation | N/A |
| 0.6-0.7 | `tests/unit/shared/**`, `tests/unit/script-library/parse-recording.test.ts` | Unit | N/A (new contracts) | Written first (task marked RED+GREEN) | Passed | Skipped for pure type exports; v1/v2 cases for `recording.ts` | None needed |
| 0.8 | `tests/support/isolated-home.test.ts` (4) | Unit | N/A (new) | Written first | Passed | 4 cases (each redirected variable) | None needed |
| 0.9 | `tests/unit/repository/depcruise-rules.test.ts`, `eslint-rules.test.ts`, `dependency-pins.test.ts` | Integration (tool run on fixtures) | N/A (new) | Written first | Passed | Multi-library `it.each` (3 names) | None needed |
| 0.10 | `tests/unit/recording-capture/guarded-cdp.test.ts` | Unit | N/A (new) | Written first | Passed | Both forbidden methods and allowed ones | None needed |
| 0.11 | full `pnpm quality` | Gate | Baseline = suite | N/A | Green | N/A | Refactor task |
| 1.1-1.8 | `tests/unit/browser-selection/{expand-path,browser-catalog-table,browser-catalog,resolve-replay-browser}.test.ts`, `tests/integration/browser-selection/*` | Unit + Integration (temp dir) | N/A (new module) | Written first (RED/GREEN task pairs, 6 commits per WP1 report) | Passed | 3 OS tables, missing/unknown id, managed vs copy-of-real | 1.8 barrel skipped on purpose (repo has none, knip would flag) |
| 2.1 | `tests/unit/recording-capture/launch-arguments.test.ts` | Unit | N/A (new) | Written first (WP2 report: strict TDD, no per-task detail) | Passed | window / emulated / real keychain | Not itemised in WP2 report |
| 2.2 | `tests/unit/recording-capture/is-profile-in-use-error.test.ts` | Unit | N/A (new) | Written first (per task) | Passed | lock vs other messages | Not itemised |
| 2.3 | `tests/unit/recording-capture/world-contexts.test.ts` | Unit (fake CDP) | N/A (new) | Written first (per task) | Passed | navigate/detach drop | Not itemised |
| 2.4 | `tests/unit/recording-capture/isolated-world-capture.test.ts`, `guarded-session.test.ts` | Unit (fake CDP) | Existing capture suite re-run | Written first for the audit-facing rules (WP2 report does not itemise) | Passed | miss -> refresh -> retry -> drop | Not itemised |
| 2.5 | `tests/integration/recording-capture/*` (launcher, `managed-profile-login.test.ts`) | Integration (headless) | Existing launcher tests | Rename + persistent-context behaviour: not itemised | Passed | Stored browser, lock mapping | Not itemised. NOTE: the "Fallback" scenario was claimed here but not implemented; fixed by R.1 |
| 2.6 | `tests/unit/recording-capture/recording-session.test.ts` | Unit | Existing tests | Per task | Passed | Saved fields, lock at start | Not itemised |
| 2.7 | `tests/integration/cdp-method-audit.test.ts` (6) | Integration (headless) | N/A (new) | Per task | Passed (trace non-empty companion) | same/cross-origin, navigation, dialog, scroll | Not itemised |
| 2.8 | existing capture suite | Integration | Suite | N/A | Green on Patchright | N/A | Refactor task |
| 3.1-3.8 | `tests/unit/browser-profiles/*` (9 files), `tests/integration/browser-profiles/*` | Unit (in-memory fs) + Integration (fixture) | N/A (new module) | Written first (WP3 report: strict TDD, 7 commits; no per-task detail) | Passed | retry, EBUSY, unstable copy, path refusals, stale lock | Not itemised |
| 4.1 | `tests/unit/script-generation/generate-script.test.ts` + goldens | Unit (golden) | Existing generator tests | Written first | Passed | `it.each` over CASES (5 goldens) | Prelude split into `launch-prelude.ts` |
| 4.2 | `tests/unit/script-generation/script-prelude.test.ts`, parity fixture | Unit | Existing prelude tests | Written first | Passed | env handling cases, parity JSON | None needed |
| 4.3 | `generate-script.test.ts` | Unit | Existing | Written first | Passed | multi-tab, unknown type, legacy | None needed |
| 4.4 | `tests/unit/script-library/parse-recording.test.ts` | Unit | Existing | TESTS AFTER CODE: implemented in WP0, WP4 added verification tests | Passed | v1 -> v2, required fields, bad mode | None needed |
| 4.5 | `tests/unit/script-library/library-service.test.ts` | Unit | Existing | TESTS AFTER CODE: pre-implemented by WP0, extra tests added in WP4 | Passed | round trip, v1 bytes untouched, rename | None needed |
| 4.6 | existing | Unit | Suite | N/A | Green | N/A | Constants deduplicated |
| 5.1 | `tests/unit/replay/replay-runner.test.ts` | Unit (real spawner for env cases) | Existing | TESTS AFTER CODE: `launchEnv` merge already existed (WP0); WP5 added tests | Passed | 4 variables, empty override, spaces/JSON | None needed |
| 5.2 | `tests/unit/environment-setup/*`, `tests/integration/environment-setup/*` | Unit + Integration | Existing | Rename done with `git mv` + tests (WP5 report) | Passed | CLI fallback to `patchright-core` | None needed |
| 5.3 | `tests/unit/environment-setup/ensure-browser.test.ts`, `linux-deps-hint.test.ts` | Unit | Existing | Written first (assert no `/playwright/i`) | Passed | success/failure/offline/libs | None needed |
| 5.4 | CI workflow test | Unit | Existing | TESTS AFTER CODE: ci.yml already patchright from WP0; workflow test added | Passed | Single scenario | None needed |
| 6.1-6.5 | `tests/unit/tui/{app-reducer,keymap,menu-setup-form-screens,recording-screen,timeline-replay-screens,tui-controller}.test.ts`, `browser-summary.test.ts` | Unit (fake AppServices) | Existing TUI suite | Written first (WP6 report: strict TDD, no per-task detail) | Passed | picker cycling, profile reset, errors, fallback warning | Not itemised |
| 7.1 | `tests/unit/composition/browser-launch-plan.test.ts` | Unit | N/A (new) | RED by missing module (WP7 report) | Passed | 4 env variables, fallback, release once | None needed |
| 7.2 | `tests/unit/composition/*`, `tests/integration/composition/create-app-services.test.ts` | Unit + Integration | Existing | RED by missing module / failing assertions (WP7 report) | Passed | views per browser, release paths, replay env | None needed |
| 7.3 | `tests/e2e/managed-profile-roundtrip.test.ts` | E2E (headless) | N/A (new) | MUTATION-BASED RED: `USER_DATA_DIR` forced to '' made the cookie assertion fail, then reverted | Passed | login survives 2nd recording and replay; ephemeral does not share; v1 replay | None needed |
| 7.4 | `tests/integration/real-browser/real-browser.test.ts` + guard tests | Integration (opt-in) | N/A (new) | RED by missing guard module (WP7 report) | Guards pass by default; suite skipped (never run on real profiles) | Guard cases | None needed |
| 7.5 | `tests/unit/repository/browser-docs.test.ts` | Unit | N/A (new) | RED by failing doc assertions | Passed | README/SECURITY wording | None needed |
| R.1 | `tests/unit/composition/browser-launch-plan.test.ts` (2 new, 1 replaced), `tests/integration/composition/create-app-services.test.ts` (1 new) | Unit + Integration | 20/20 + 42/42 before | RED run: the 2 new planner tests failed ("Brave is not installed on this machine.") after the refusal test was replaced | 22/22 and 43/43 | managed and copy-of-real fallback, saved choice, live warning | Shared `planWithFallback` for both paths |
| R.2 | N/A | Documentation | N/A | N/A | Table written | N/A | N/A |
| R.3 | `copy-profile.test.ts` / `copy-filter.test.ts` (existing `-shm` assertions kept) | Spec text | Both files green | N/A: spec wording only | Still green | Shared-memory scenario added to the spec | N/A |
| R.4 | N/A | Decision | N/A | N/A | Spec amended to warning-only (no SQLite reader; zero count can be legitimate) | N/A | N/A |
| R.5 | `tests/unit/tui/tui-controller-pickers.test.ts` (2) | Unit | 53/53 in `tui-controller.test.ts` | TEST AFTER CODE: the behaviour already existed, so the first run was GREEN (a coverage gap, not new behaviour) | 2/2 | Chrome + Profile 2, default managed | None needed |
| R.6 | `tests/unit/repository/depcruise-rules.test.ts` (+5) | Integration (tool run) | 16/16 before | RED run: 4 of 5 new tests failed (config missing) | 21/21 | installed/uninstalled `playwright`, `@playwright/test`, patchright allowed | `hasPlaywright` stub parameter. ESLint ban already covered `tests/**` (typedFiles) |

### Per-WP sources (engram)

`sdd/browser-engine-and-profiles/apply-progress` (#1276, consolidated) and `-wp1` to `-wp6` (#1279, #1282, #1281, #1278, #1280, #1283).

### Verify remediation work-unit evidence

| Evidence | Value |
|---|---|
| Focused tests | `pnpm vitest run tests/unit/composition tests/integration/composition tests/unit/tui/tui-controller-pickers.test.ts tests/unit/repository/depcruise-rules.test.ts`: all pass |
| Runtime harness | N/A for R.1 beyond the composition integration test (fake launcher); no browser opened, real-browser suite not run |
| Rollback boundary | `src/composition/browser-launch-plan.ts`, spec/design edits, `.dependency-cruiser.tests.json` and the `deps:check` script |
