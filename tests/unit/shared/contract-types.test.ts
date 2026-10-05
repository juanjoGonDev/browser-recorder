import { describe, expectTypeOf, it } from 'vitest';
import type { CapturedEvent } from '../../../src/recording-capture/domain/captured-event.ts';
import type {
  BrowserLauncher,
  SessionSignal,
} from '../../../src/recording-capture/application/ports/browser-launcher.ts';
import type { MonotonicClock } from '../../../src/recording-capture/application/ports/monotonic-clock.ts';
import type { RecordingSink } from '../../../src/recording-capture/application/ports/recording-sink.ts';
import type {
  LiveRecording,
  startRecording,
} from '../../../src/recording-capture/application/recording-session.ts';
import type { BrowserInstallation } from '../../../src/environment-setup/application/ports/browser-installation.ts';
import type {
  ensureBrowser,
  EnsureBrowserResult,
} from '../../../src/environment-setup/application/ensure-browser.ts';
import type { ProcessSpawner } from '../../../src/replay/application/ports/process-spawner.ts';
import type {
  LiveReplay,
  startReplay,
} from '../../../src/replay/application/replay-runner.ts';
import type { ReplayProgress } from '../../../src/replay/domain/replay-progress.ts';
import type { generateScript } from '../../../src/script-generation/domain/generate-script.ts';
import type { RecordingRepository } from '../../../src/script-library/application/ports/recording-repository.ts';
import type {
  createLibraryService,
  LibraryService,
} from '../../../src/script-library/application/library-service.ts';
import type { RecordingSummary } from '../../../src/script-library/domain/recording-summary.ts';
import type { Locator } from '../../../src/shared/domain/locator.ts';
import type { RecordingEventKind } from '../../../src/shared/domain/recording-event.ts';
import type { Recording } from '../../../src/shared/domain/recording.ts';
import type { AppServices } from '../../../src/tui/application/ports/app-services.ts';
import type { Terminal } from '../../../src/tui/application/ports/terminal.ts';
import type { Timers } from '../../../src/tui/application/ports/timers.ts';
import type { AppAction } from '../../../src/tui/domain/app-action.ts';
import type { AppState } from '../../../src/tui/domain/app-state.ts';
import type { Intent } from '../../../src/tui/domain/intent.ts';

// These are compile-time checks: `pnpm typecheck` fails when a frozen contract
// drifts. Vitest runs them only so the file stays a normal test entry.
describe('frozen contracts', () => {
  it('lists every recorded event kind', () => {
    expectTypeOf<RecordingEventKind>().toEqualTypeOf<
      | 'goto'
      | 'wait-for-url'
      | 'reload'
      | 'go-back'
      | 'go-forward'
      | 'page-closed'
      | 'click'
      | 'dblclick'
      | 'hover'
      | 'check'
      | 'fill'
      | 'select-option'
      | 'press'
      | 'scroll'
      | 'drag-and-drop'
      | 'set-input-files'
      | 'dialog'
      | 'page-opened'
    >();
  });

  it('keeps the recording schema version literal', () => {
    expectTypeOf<Recording['schemaVersion']>().toEqualTypeOf<1>();
    expectTypeOf<Recording['status']>().toEqualTypeOf<
      'recording' | 'complete'
    >();
  });

  it('keeps the locator kinds in priority order', () => {
    expectTypeOf<Locator['kind']>().toEqualTypeOf<
      'test-id' | 'role' | 'label' | 'placeholder' | 'text' | 'css'
    >();
  });

  it('describes the capture protocol and the signals built from it', () => {
    expectTypeOf<CapturedEvent['kind']>().toEqualTypeOf<
      | 'click'
      | 'dblclick'
      | 'hover'
      | 'input'
      | 'select'
      | 'check'
      | 'files'
      | 'key'
      | 'scroll'
      | 'drag'
    >();
    expectTypeOf<SessionSignal['kind']>().toEqualTypeOf<
      | 'dom'
      | 'navigation'
      | 'page-opened'
      | 'page-closed'
      | 'browser-closed'
      | 'dialog-opened'
    >();
  });

  it('declares the use case signatures', () => {
    expectTypeOf<
      typeof startRecording
    >().returns.resolves.toEqualTypeOf<LiveRecording>();
    expectTypeOf<typeof generateScript>().toEqualTypeOf<
      (recording: Recording) => string
    >();
    expectTypeOf<typeof startReplay>().returns.toEqualTypeOf<LiveReplay>();
    expectTypeOf<
      typeof createLibraryService
    >().returns.toEqualTypeOf<LibraryService>();
    expectTypeOf<
      typeof ensureBrowser
    >().returns.resolves.toEqualTypeOf<EnsureBrowserResult>();
  });

  it('exposes the driven ports', () => {
    expectTypeOf<BrowserLauncher['launch']>().returns.resolves.toHaveProperty(
      'close',
    );
    expectTypeOf<MonotonicClock['now']>().returns.toBeNumber();
    expectTypeOf<RecordingSink['save']>()
      .parameter(0)
      .toEqualTypeOf<Recording>();
    expectTypeOf<ProcessSpawner['spawn']>().returns.toHaveProperty('kill');
    expectTypeOf<
      RecordingRepository['reserve']
    >().returns.resolves.toBeBoolean();
    expectTypeOf<
      BrowserInstallation['isInstalled']
    >().returns.resolves.toBeBoolean();
    expectTypeOf<Terminal['size']>().returns.toHaveProperty('columns');
    expectTypeOf<Timers['defer']>().returns.toBeVoid();
  });

  it('wires the replay, library and TUI shapes together', () => {
    expectTypeOf<ReplayProgress['status']>().toEqualTypeOf<
      'running' | 'succeeded' | 'failed' | 'cancelled'
    >();
    expectTypeOf<RecordingSummary['stepCount']>().toBeNumber();
    expectTypeOf<
      AppServices['library']['rename']
    >().returns.resolves.toBeVoid();
    expectTypeOf<AppState['screen']['kind']>().toEqualTypeOf<
      | 'setup'
      | 'main-menu'
      | 'new-recording'
      | 'recording'
      | 'library'
      | 'timeline'
      | 'replay'
    >();
    expectTypeOf<Intent>().toHaveProperty('kind');
    expectTypeOf<AppAction>().toHaveProperty('type');
  });
});
