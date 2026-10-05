import {
  BROWSER_IDS,
  type BrowserId,
  type ProfileMode,
} from '../../shared/domain/browser-choice.ts';
import type { LocalStateInfo } from '../domain/parse-local-state.ts';
import {
  ProfileCopyError,
  ProfileInUseError,
} from '../domain/profile-errors.ts';
import { joinPath, type ProfileLayout } from '../domain/profile-layout.ts';
import {
  checkProfileLock,
  type ProfileLockDeps,
} from './check-profile-lock.ts';
import { copyProfile } from './copy-profile.ts';
import type { ProcessProbe } from './ports/process-probe.ts';
import type { ProfileFileSystem } from './ports/profile-file-system.ts';
import { readLocalState } from './read-local-state.ts';
import {
  type ReleaseDeps,
  releaseOnce,
  removeSession,
} from './release-session.ts';
import { createSessionGuard, type SessionGuard } from './session-guard.ts';

export type ProfileWarning =
  | { readonly code: 'source-running' }
  | { readonly code: 'app-bound-encryption' }
  | { readonly code: 'unstable-copy'; readonly files: readonly string[] };

export interface PrepareProfileRequest {
  readonly browserId: BrowserId;
  readonly profileMode: ProfileMode;
  readonly sourceProfile: string | null;
  /** The browser's own data directory; only read for `copy-of-real`. */
  readonly realUserDataDir: string | null;
}

export interface PreparedProfile {
  readonly userDataDir: string;
  readonly browserArgs: readonly string[];
  readonly shouldUseRealKeychain: boolean;
  readonly warnings: readonly ProfileWarning[];
  /** Deletes what the profile owns (a copy, an ephemeral profile). */
  release(): Promise<void>;
}

export interface ProfileStore {
  /** `null` when `Local State` is missing or unreadable. */
  listRealProfiles(realUserDataDir: string): Promise<LocalStateInfo | null>;
  prepare(request: PrepareProfileRequest): Promise<PreparedProfile>;
  sweepStaleSessions(): Promise<void>;
}

export interface ProfileStoreDeps {
  readonly fs: ProfileFileSystem;
  readonly processes: ProcessProbe;
  readonly platform: string;
  readonly layout: ProfileLayout;
  readonly sleep: (ms: number) => Promise<void>;
}

const NOTHING_TO_RELEASE = (): Promise<void> => Promise.resolve();

function lockDepsOf(deps: ProfileStoreDeps): ProfileLockDeps {
  return { fs: deps.fs, processes: deps.processes, platform: deps.platform };
}

function guardFor(deps: ProfileStoreDeps, browserId: BrowserId): SessionGuard {
  return createSessionGuard({
    fs: deps.fs,
    platform: deps.platform,
    sessionsRoot: deps.layout.sessionsRoot(browserId),
  });
}

function releaseDepsFor(
  deps: ProfileStoreDeps,
  browserId: BrowserId,
): ReleaseDeps {
  return { guard: guardFor(deps, browserId), sleep: deps.sleep };
}

async function prepareManaged(
  deps: ProfileStoreDeps,
  request: PrepareProfileRequest,
): Promise<PreparedProfile> {
  const userDataDir = deps.layout.managedDir(request.browserId);
  await deps.fs.makePrivateDir(userDataDir);
  const lock = await checkProfileLock(lockDepsOf(deps), userDataDir);
  if (lock.kind === 'locked') {
    throw new ProfileInUseError(request.browserId, userDataDir);
  }
  return {
    userDataDir,
    browserArgs: [],
    shouldUseRealKeychain: false,
    warnings: [],
    release: NOTHING_TO_RELEASE,
  };
}

async function prepareEphemeral(
  deps: ProfileStoreDeps,
  request: PrepareProfileRequest,
): Promise<PreparedProfile> {
  const releaseDeps = releaseDepsFor(deps, request.browserId);
  await deps.fs.makePrivateDir(deps.layout.sessionsRoot(request.browserId));
  const userDataDir = releaseDeps.guard.newSessionDir();
  await deps.fs.makePrivateDir(userDataDir);
  return {
    userDataDir,
    browserArgs: [],
    shouldUseRealKeychain: false,
    warnings: [],
    release: releaseOnce(releaseDeps, userDataDir),
  };
}

async function warningsBeforeCopy(
  deps: ProfileStoreDeps,
  realDir: string,
  info: LocalStateInfo,
): Promise<ProfileWarning[]> {
  const warnings: ProfileWarning[] = [];
  const lock = await checkProfileLock(lockDepsOf(deps), realDir);
  if (lock.kind === 'locked') warnings.push({ code: 'source-running' });
  if (deps.platform === 'win32' && info.hasAppBoundEncryption) {
    warnings.push({ code: 'app-bound-encryption' });
  }
  return warnings;
}

async function prepareCopy(
  deps: ProfileStoreDeps,
  request: PrepareProfileRequest,
): Promise<PreparedProfile> {
  const { realUserDataDir: realDir, sourceProfile } = request;
  if (realDir === null) {
    throw new ProfileCopyError('source-missing', request.browserId);
  }
  if (sourceProfile === null) {
    throw new ProfileCopyError('unknown-profile', 'null');
  }
  const info = await readLocalState(deps.fs, deps.platform, realDir);
  if (info === null)
    throw new ProfileCopyError('source-missing', 'Local State');
  const warnings = await warningsBeforeCopy(deps, realDir, info);
  const sessionsRoot = deps.layout.sessionsRoot(request.browserId);
  await deps.fs.makePrivateDir(sessionsRoot);
  const copy = await copyProfile(
    { fs: deps.fs, platform: deps.platform, sleep: deps.sleep },
    {
      sourceRoot: realDir,
      profile: sourceProfile,
      knownProfiles: info.profiles.map((profile) => profile.directory),
      sessionsRoot,
    },
  );
  if (copy.unstableFiles.length > 0) {
    warnings.push({ code: 'unstable-copy', files: copy.unstableFiles });
  }
  return {
    userDataDir: copy.directory,
    browserArgs: [`--profile-directory=${sourceProfile}`],
    shouldUseRealKeychain: true,
    warnings,
    release: releaseOnce(
      releaseDepsFor(deps, request.browserId),
      copy.directory,
    ),
  };
}

async function sweepBrowser(
  deps: ProfileStoreDeps,
  browserId: BrowserId,
): Promise<void> {
  const sessionsRoot = deps.layout.sessionsRoot(browserId);
  const entries = await deps.fs.list(sessionsRoot).catch(() => []);
  const releaseDeps = releaseDepsFor(deps, browserId);
  for (const entry of entries) {
    const path = joinPath(deps.platform, sessionsRoot, entry.name);
    // A browser still running on a session of another instance keeps it.
    const lock = await checkProfileLock(lockDepsOf(deps), path);
    if (lock.kind === 'free') await removeSession(releaseDeps, path);
  }
}

export function createProfileStore(deps: ProfileStoreDeps): ProfileStore {
  return {
    listRealProfiles: (realUserDataDir) =>
      readLocalState(deps.fs, deps.platform, realUserDataDir),
    prepare(request) {
      switch (request.profileMode) {
        case 'managed':
          return prepareManaged(deps, request);
        case 'ephemeral':
          return prepareEphemeral(deps, request);
        case 'copy-of-real':
          return prepareCopy(deps, request);
      }
    },
    async sweepStaleSessions() {
      for (const browserId of BROWSER_IDS) await sweepBrowser(deps, browserId);
    },
  };
}
