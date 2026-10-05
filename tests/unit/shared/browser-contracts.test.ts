import { describe, expectTypeOf, it } from 'vitest';
import type { FileProbe } from '../../../src/browser-selection/application/ports/file-probe.ts';
import type {
  BrowserCatalog,
  InstalledBrowser,
} from '../../../src/browser-selection/application/browser-catalog.ts';
import type {
  Platform,
  PathRoots,
} from '../../../src/browser-selection/domain/expand-path.ts';
import type {
  BrowserCandidate,
  BrowserTables,
} from '../../../src/browser-selection/domain/browser-catalog-table.ts';
import type { ReplayBrowser } from '../../../src/browser-selection/domain/resolve-replay-browser.ts';
import type {
  LockState,
  ProfileLockDeps,
} from '../../../src/browser-profiles/application/check-profile-lock.ts';
import type {
  PreparedProfile,
  PrepareProfileRequest,
  ProfileStore,
  ProfileWarning,
} from '../../../src/browser-profiles/application/profile-store.ts';
import type {
  DirEntry,
  FileStamp,
  ProfileFileSystem,
} from '../../../src/browser-profiles/application/ports/profile-file-system.ts';
import type { ProcessProbe } from '../../../src/browser-profiles/application/ports/process-probe.ts';
import type { ProfileLayout } from '../../../src/browser-profiles/domain/profile-layout.ts';
import type {
  LocalStateInfo,
  RealProfile,
} from '../../../src/browser-profiles/domain/parse-local-state.ts';
import type { CaptureWorld } from '../../../src/recording-capture/application/ports/capture-world.ts';
import type {
  LaunchOptions,
  LaunchTarget,
} from '../../../src/recording-capture/application/ports/browser-launcher.ts';
import type { StartRecordingRequest } from '../../../src/recording-capture/application/recording-session.ts';
import type { StartReplayRequest } from '../../../src/replay/application/replay-runner.ts';
import type { LibraryService } from '../../../src/script-library/application/library-service.ts';
import type { RecordingRepository } from '../../../src/script-library/application/ports/recording-repository.ts';
import type {
  BrowserChoice,
  BrowserId,
  ProfileMode,
} from '../../../src/shared/domain/browser-choice.ts';
import type {
  Display,
  Recording,
} from '../../../src/shared/domain/recording.ts';
import type { AppServices } from '../../../src/tui/application/ports/app-services.ts';
import type { NewRecordingRequest } from '../../../src/tui/application/ports/app-services.ts';
import type { AppAction } from '../../../src/tui/domain/app-action.ts';
import type {
  BrowserOptionView,
  EnvironmentView,
  LiveRecordingView,
  LiveReplayView,
  ProfileOptionView,
} from '../../../src/tui/domain/app-views.ts';
import type { Intent } from '../../../src/tui/domain/intent.ts';

// Compile-time checks, like contract-types.test.ts: `pnpm typecheck` fails
// when a contract frozen for the browser engine and profiles change drifts.
describe('recording schema v2', () => {
  it('replaces the viewport with a display and a browser choice', () => {
    expectTypeOf<Recording['display']>().toEqualTypeOf<Display>();
    expectTypeOf<Recording['browser']>().toEqualTypeOf<BrowserChoice>();
    expectTypeOf<Recording>().not.toHaveProperty('viewport');
  });

  it('describes a display as a kind with a size', () => {
    expectTypeOf<Display>().toEqualTypeOf<{
      readonly kind: 'window' | 'emulated';
      readonly width: number;
      readonly height: number;
    }>();
  });
});

describe('browser-selection contracts', () => {
  it('describes platforms, path roots and the file probe', () => {
    expectTypeOf<Platform>().toEqualTypeOf<'darwin' | 'win32' | 'linux'>();
    expectTypeOf<PathRoots['home']>().toBeString();
    expectTypeOf<PathRoots['localAppData']>().toEqualTypeOf<string | null>();
    expectTypeOf<PathRoots['xdgConfigHome']>().toEqualTypeOf<string | null>();
    expectTypeOf<FileProbe['isFile']>().returns.resolves.toBeBoolean();
    expectTypeOf<FileProbe['isDirectory']>().returns.resolves.toBeBoolean();
  });

  it('describes candidates, installed browsers and the catalog', () => {
    expectTypeOf<BrowserCandidate['browserId']>().toEqualTypeOf<
      Exclude<BrowserId, 'bundled'>
    >();
    expectTypeOf<BrowserCandidate['userDataDir']>().toEqualTypeOf<
      string | null
    >();
    expectTypeOf<InstalledBrowser['executablePath']>().toEqualTypeOf<
      string | null
    >();
    expectTypeOf<
      BrowserCatalog['find']
    >().returns.resolves.toEqualTypeOf<InstalledBrowser | null>();
    expectTypeOf<BrowserCatalog['list']>().returns.resolves.toEqualTypeOf<
      readonly InstalledBrowser[]
    >();
  });

  it('keys the candidate tables by platform', () => {
    expectTypeOf<keyof BrowserTables>().toEqualTypeOf<Platform>();
    expectTypeOf<BrowserTables['linux']>().toEqualTypeOf<
      readonly BrowserCandidate[]
    >();
  });

  it('tells a replay browser apart from a fallback', () => {
    expectTypeOf<ReplayBrowser['kind']>().toEqualTypeOf<
      'as-recorded' | 'fallback'
    >();
    expectTypeOf<
      Extract<ReplayBrowser, { kind: 'fallback' }>['missing']
    >().toEqualTypeOf<BrowserId>();
  });
});

describe('browser-profiles contracts', () => {
  it('describes the file system and process ports', () => {
    expectTypeOf<DirEntry['kind']>().toEqualTypeOf<
      'file' | 'directory' | 'symlink' | 'other'
    >();
    expectTypeOf<FileStamp>().toEqualTypeOf<{
      readonly size: number;
      readonly mtimeMs: number;
    }>();
    expectTypeOf<ProfileFileSystem['copyFile']>().returns.resolves.toBeVoid();
    expectTypeOf<
      ProfileFileSystem['stamp']
    >().returns.resolves.toEqualTypeOf<FileStamp | null>();
    expectTypeOf<ProfileFileSystem['randomName']>().returns.toBeString();
    expectTypeOf<ProcessProbe['isAlive']>().returns.toBeBoolean();
    expectTypeOf<ProcessProbe['hostname']>().returns.toBeString();
  });

  it('describes the layout, the real profiles and the lock state', () => {
    expectTypeOf<ProfileLayout['managedDir']>().returns.toBeString();
    expectTypeOf<ProfileLayout['sessionsRoot']>().returns.toBeString();
    expectTypeOf<RealProfile>().toEqualTypeOf<{
      readonly directory: string;
      readonly displayName: string;
    }>();
    expectTypeOf<LocalStateInfo['hasAppBoundEncryption']>().toBeBoolean();
    expectTypeOf<LockState['kind']>().toEqualTypeOf<'free' | 'locked'>();
    expectTypeOf<ProfileLockDeps['fs']>().toEqualTypeOf<ProfileFileSystem>();
    expectTypeOf<ProfileLockDeps['processes']>().toEqualTypeOf<ProcessProbe>();
  });

  it('describes the profile store and what it prepares', () => {
    expectTypeOf<
      PrepareProfileRequest['profileMode']
    >().toEqualTypeOf<ProfileMode>();
    expectTypeOf<PrepareProfileRequest['realUserDataDir']>().toEqualTypeOf<
      string | null
    >();
    expectTypeOf<PreparedProfile['release']>().returns.resolves.toBeVoid();
    expectTypeOf<PreparedProfile['shouldUseRealKeychain']>().toBeBoolean();
    expectTypeOf<ProfileWarning['code']>().toEqualTypeOf<
      'source-running' | 'app-bound-encryption' | 'unstable-copy'
    >();
    expectTypeOf<
      ProfileStore['prepare']
    >().returns.resolves.toEqualTypeOf<PreparedProfile>();
    expectTypeOf<
      ProfileStore['listRealProfiles']
    >().returns.resolves.toEqualTypeOf<LocalStateInfo | null>();
    expectTypeOf<
      ProfileStore['sweepStaleSessions']
    >().returns.resolves.toBeVoid();
  });
});

describe('recording-capture contracts', () => {
  it('launches into a prepared target with a display', () => {
    expectTypeOf<LaunchTarget>().toEqualTypeOf<{
      readonly executablePath: string | null;
      readonly userDataDir: string;
      readonly browserArgs: readonly string[];
      readonly shouldUseRealKeychain: boolean;
    }>();
    expectTypeOf<LaunchOptions['display']>().toEqualTypeOf<Display>();
    expectTypeOf<LaunchOptions['target']>().toEqualTypeOf<LaunchTarget>();
    expectTypeOf<LaunchOptions>().not.toHaveProperty('viewport');
  });

  it('starts a recording with a browser choice and a target', () => {
    expectTypeOf<
      StartRecordingRequest['browser']
    >().toEqualTypeOf<BrowserChoice>();
    expectTypeOf<
      StartRecordingRequest['target']
    >().toEqualTypeOf<LaunchTarget>();
  });

  it('looks a frame world up asynchronously', () => {
    expectTypeOf<CaptureWorld['contextOf']>().toEqualTypeOf<
      (frameId: string) => Promise<number | undefined>
    >();
  });
});

describe('replay and script-library contracts', () => {
  it('passes the launch environment to a replay', () => {
    expectTypeOf<StartReplayRequest['launchEnv']>().toEqualTypeOf<
      Readonly<Record<string, string>>
    >();
  });

  it('writes and regenerates a script on its own', () => {
    expectTypeOf<RecordingRepository['writeScript']>().toEqualTypeOf<
      (slug: string, scriptMjs: string) => Promise<void>
    >();
    expectTypeOf<LibraryService['regenerateScript']>().toEqualTypeOf<
      (slug: string) => Promise<Recording>
    >();
  });
});

describe('tui contracts', () => {
  it('shows browsers with their profile options', () => {
    expectTypeOf<ProfileOptionView>().toEqualTypeOf<{
      readonly choice: BrowserChoice;
      readonly label: string;
      readonly note: string | null;
    }>();
    expectTypeOf<BrowserOptionView['profiles']>().toEqualTypeOf<
      readonly ProfileOptionView[]
    >();
    expectTypeOf<BrowserOptionView['browserId']>().toEqualTypeOf<BrowserId>();
  });

  it('lists browsers and starts a recording with a choice', () => {
    expectTypeOf<
      AppServices['browsers']['list']
    >().returns.resolves.toEqualTypeOf<readonly BrowserOptionView[]>();
    expectTypeOf<AppServices['recording']['start']>()
      .parameter(0)
      .toEqualTypeOf<
        NewRecordingRequest & { readonly browser: BrowserChoice }
      >();
  });

  it('carries warnings and detected browsers in the views', () => {
    expectTypeOf<LiveRecordingView['warnings']>().toEqualTypeOf<
      readonly string[]
    >();
    expectTypeOf<LiveReplayView['warnings']>().toEqualTypeOf<
      readonly string[]
    >();
    expectTypeOf<
      Extract<EnvironmentView, { kind: 'ready' }>['browsers']
    >().toEqualTypeOf<readonly string[]>();
  });

  it('adds the picker intent and the browser actions', () => {
    expectTypeOf<Extract<Intent, { kind: 'cycle-option' }>>().toEqualTypeOf<{
      readonly kind: 'cycle-option';
      readonly delta: number;
    }>();
    expectTypeOf<Extract<AppAction, { type: 'cycle-option' }>>().toEqualTypeOf<{
      readonly type: 'cycle-option';
      readonly delta: number;
    }>();
    expectTypeOf<
      Extract<AppAction, { type: 'browsers-loaded' }>['browsers']
    >().toEqualTypeOf<readonly BrowserOptionView[]>();
    expectTypeOf<
      Extract<AppAction, { type: 'browsers-failed' }>['message']
    >().toBeString();
  });
});
