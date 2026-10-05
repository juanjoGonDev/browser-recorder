import { defineConfig } from 'vitest/config';

const SLOW_TEST_THRESHOLD_MS = 300;
const UNIT_TIMEOUT_MS = 15_000;
// Integration tests spawn real browsers and processes.
const INTEGRATION_TIMEOUT_MS = 30_000;
// A record, generate and replay round trip waits on real page timing.
const E2E_TIMEOUT_MS = 90_000;

export default defineConfig({
  test: {
    reporters: ['tree', 'hanging-process'],
    // Generated scripts and browsers spawned by tests stay off-screen.
    env: { BROWSER_RECORDER_HEADLESS: '1' },
    slowTestThreshold: SLOW_TEST_THRESHOLD_MS,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          globalSetup: ['tests/support/isolated-home.ts'],
          include: ['tests/unit/**/*.test.ts'],
          testTimeout: UNIT_TIMEOUT_MS,
          hookTimeout: UNIT_TIMEOUT_MS,
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          globalSetup: [
            'tests/support/isolated-home.ts',
            'tests/support/build-in-page-bundle.ts',
          ],
          include: ['tests/integration/**/*.test.ts'],
          testTimeout: INTEGRATION_TIMEOUT_MS,
          hookTimeout: INTEGRATION_TIMEOUT_MS,
        },
      },
      {
        extends: true,
        test: {
          // Probes that pin how the browser engine behaves; they run headless.
          name: 'spike',
          globalSetup: [
            'tests/support/isolated-home.ts',
            'tests/support/build-in-page-bundle.ts',
          ],
          include: ['tests/spike/**/*.test.ts'],
          testTimeout: INTEGRATION_TIMEOUT_MS,
          hookTimeout: INTEGRATION_TIMEOUT_MS,
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          globalSetup: [
            'tests/support/isolated-home.ts',
            'tests/support/build-in-page-bundle.ts',
          ],
          include: ['tests/e2e/**/*.test.ts'],
          testTimeout: E2E_TIMEOUT_MS,
          hookTimeout: E2E_TIMEOUT_MS,
        },
      },
    ],
    coverage: {
      // v8 is the runtime's own coverage: no instrumentation pass.
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/**/*.ts', 'scripts/**/*.ts'],
      exclude: [
        'tests/**',
        'dist/**',
        '**/*.d.ts',
        '*.config.ts',
        // The composition root: wiring only, exercised by the e2e round trip.
        'src/main.ts',
        // Type-only contracts: zero executable statements, so v8 reports 0%
        // forever no matter what the tests do.
        '**/ports/*.ts',
        'src/shared/domain/recording-event.ts',
        'src/shared/domain/locator.ts',
        'src/shared/domain/recording.ts',
        'src/recording-capture/domain/captured-event.ts',
        'src/tui/domain/app-state.ts',
        'src/tui/domain/app-action.ts',
        'src/tui/domain/intent.ts',
        // Runs inside Chromium, so v8 in Node cannot see it: it is covered
        // by the integration tests against the fixture site.
        'src/recording-capture/in-page/**',
      ],
      thresholds: {
        // Every file carries its own weight for statements and lines, so a
        // new module cannot ride in on the average of the ones around it.
        perFile: { statements: 85, lines: 85 },
        // Branches and functions are judged on the whole: one defensive
        // `catch` that cannot be provoked is not a reason to fail a file.
        branches: 80,
        functions: 85,
      },
    },
  },
});
