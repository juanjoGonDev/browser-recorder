import { shouldCopy, SQLITE_COMPANIONS } from '../domain/copy-filter.ts';
import { ProfileCopyError } from '../domain/profile-errors.ts';
import { joinPath, SAFE_PROFILE_DIR } from '../domain/profile-layout.ts';
import {
  type CopyContext,
  copyFileGroup,
  type FileGroup,
} from './copy-file-group.ts';
import type {
  DirEntry,
  ProfileFileSystem,
} from './ports/profile-file-system.ts';
import { createSessionGuard } from './session-guard.ts';

const LOCAL_STATE = 'Local State';

export interface CopyProfileDeps {
  readonly fs: ProfileFileSystem;
  readonly platform: string;
  readonly sleep: (ms: number) => Promise<void>;
}

export interface CopyProfileRequest {
  /** The browser's own user data directory: only ever read. */
  readonly sourceRoot: string;
  readonly profile: string;
  /** Profiles listed by `Local State`; anything else is refused. */
  readonly knownProfiles: readonly string[];
  readonly sessionsRoot: string;
}

export interface CopiedProfile {
  /** The new user data directory, inside the sessions root. */
  readonly directory: string;
  /** Files that kept changing while they were copied (relative paths). */
  readonly unstableFiles: readonly string[];
}

interface Walk {
  readonly ctx: CopyContext;
  readonly platform: string;
  readonly unstable: string[];
}

interface Location {
  readonly source: string;
  readonly destination: string;
  readonly segments: readonly string[];
}

function isCopyableFile(entry: DirEntry, segments: readonly string[]): boolean {
  return entry.kind === 'file' && shouldCopy([...segments, entry.name]);
}

/** Pairs each database with the companions that exist next to it. */
function groupFiles(
  entries: readonly DirEntry[],
  here: Location,
  platform: string,
): FileGroup[] {
  const names = new Set(
    entries.filter((e) => isCopyableFile(e, here.segments)).map((e) => e.name),
  );
  const isCompanionOfPresent = (name: string): boolean =>
    SQLITE_COMPANIONS.some(
      (suffix) =>
        name.endsWith(suffix) && names.has(name.slice(0, -suffix.length)),
    );
  const at = (root: string, name: string): string =>
    joinPath(platform, root, name);
  return [...names]
    .filter((name) => !isCompanionOfPresent(name))
    .map((name) => {
      const members = [
        name,
        ...SQLITE_COMPANIONS.map((suffix) => `${name}${suffix}`).filter((n) =>
          names.has(n),
        ),
      ];
      return {
        label: [...here.segments, name].join('/'),
        from: members.map((n) => at(here.source, n)),
        to: members.map((n) => at(here.destination, n)),
      };
    });
}

async function copyDirectory(walk: Walk, here: Location): Promise<void> {
  const entries = await walk.ctx.fs.list(here.source);
  for (const group of groupFiles(entries, here, walk.platform)) {
    const isStable = await copyFileGroup(walk.ctx, group);
    if (!isStable) walk.unstable.push(group.label);
  }
  for (const entry of entries) {
    const segments = [...here.segments, entry.name];
    if (entry.kind !== 'directory' || !shouldCopy(segments)) continue;
    const destination = joinPath(walk.platform, here.destination, entry.name);
    await walk.ctx.fs.makePrivateDir(destination);
    const source = joinPath(walk.platform, here.source, entry.name);
    await copyDirectory(walk, { source, destination, segments });
  }
}

function assertKnown(request: CopyProfileRequest): void {
  const isKnown =
    SAFE_PROFILE_DIR.test(request.profile) &&
    request.knownProfiles.includes(request.profile);
  if (!isKnown) throw new ProfileCopyError('unknown-profile', request.profile);
}

async function assertSourcePresent(
  deps: CopyProfileDeps,
  request: CopyProfileRequest,
): Promise<void> {
  const at = (name: string): string =>
    joinPath(deps.platform, request.sourceRoot, name);
  for (const name of [LOCAL_STATE, request.profile]) {
    if (!(await deps.fs.exists(at(name)))) {
      throw new ProfileCopyError('source-missing', name);
    }
  }
}

/**
 * Copies `Local State` and one profile of a real browser into a new directory
 * under the sessions root. The source is opened read-only and never written.
 * On any failure the partial copy is deleted before the error escapes.
 */
export async function copyProfile(
  deps: CopyProfileDeps,
  request: CopyProfileRequest,
): Promise<CopiedProfile> {
  assertKnown(request);
  await assertSourcePresent(deps, request);
  const { fs, platform } = deps;
  const guard = createSessionGuard({
    fs,
    platform,
    sessionsRoot: request.sessionsRoot,
  });
  const directory = guard.newSessionDir();
  const walk: Walk = {
    ctx: { fs, sleep: deps.sleep, remove: (path) => guard.remove(path) },
    platform,
    unstable: [],
  };
  try {
    await fs.makePrivateDir(directory);
    const at = (root: string, name: string): string =>
      joinPath(platform, root, name);
    await copyFileGroup(walk.ctx, {
      label: LOCAL_STATE,
      from: [at(request.sourceRoot, LOCAL_STATE)],
      to: [at(directory, LOCAL_STATE)],
    });
    const destination = at(directory, request.profile);
    await fs.makePrivateDir(destination);
    await copyDirectory(walk, {
      source: at(request.sourceRoot, request.profile),
      destination,
      segments: [request.profile],
    });
  } catch (error) {
    await guard.remove(directory);
    throw error;
  }
  return { directory, unstableFiles: walk.unstable };
}
