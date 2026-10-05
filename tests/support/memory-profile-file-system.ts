import type {
  DirEntry,
  FileStamp,
  ProfileFileSystem,
} from '../../src/browser-profiles/application/ports/profile-file-system.ts';
import type { ProcessProbe } from '../../src/browser-profiles/application/ports/process-probe.ts';

type MemoryNode =
  | { readonly kind: 'directory' }
  | { readonly kind: 'file'; content: string; mtimeMs: number }
  | { readonly kind: 'symlink'; readonly target: string };

const FIRST_MTIME_MS = 1_000;

export function errorWithCode(code: string): Error {
  return Object.assign(new Error(code), { code });
}

/** Understands both separators so Windows-style paths work too. */
function parentOf(path: string): string {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return index <= 0 ? '' : path.slice(0, index);
}

/**
 * A POSIX-style in-memory `ProfileFileSystem` with hooks to simulate a source
 * that changes or locks up while it is being copied. Paths use `/`.
 */
export class MemoryProfileFileSystem implements ProfileFileSystem {
  readonly nodes = new Map<string, MemoryNode>();
  readonly privateDirs = new Set<string>();
  readonly removed: string[] = [];
  readonly copied: Array<readonly [string, string]> = [];
  /** Runs before every `copyFile`; may mutate the source or throw. */
  onCopy: (from: string, to: string) => void = () => undefined;
  /** Runs before every `remove`; may throw to simulate a busy directory. */
  onRemove: (path: string) => void = () => undefined;
  private counter = 0;

  addDirectory(path: string): void {
    if (path === '' || this.nodes.has(path)) return;
    this.addDirectory(parentOf(path));
    this.nodes.set(path, { kind: 'directory' });
  }

  addFile(path: string, content: string, mtimeMs = FIRST_MTIME_MS): void {
    this.addDirectory(parentOf(path));
    this.nodes.set(path, { kind: 'file', content, mtimeMs });
  }

  addSymlink(path: string, target: string): void {
    this.addDirectory(parentOf(path));
    this.nodes.set(path, { kind: 'symlink', target });
  }

  /** Simulates the owning browser writing to the file. */
  touch(path: string, content: string): void {
    const node = this.nodes.get(path);
    if (node?.kind !== 'file') throw new Error(`Not a file: ${path}`);
    node.content = content;
    node.mtimeMs += 1;
  }

  contentOf(path: string): string | null {
    const node = this.nodes.get(path);
    return node?.kind === 'file' ? node.content : null;
  }

  pathsUnder(root: string): string[] {
    return [...this.nodes.keys()]
      .filter((p) => p.startsWith(`${root}/`))
      .sort();
  }

  makePrivateDir(path: string): Promise<void> {
    this.addDirectory(path);
    this.privateDirs.add(path);
    return Promise.resolve();
  }

  readText(path: string): Promise<string> {
    const content = this.contentOf(path);
    if (content === null) return Promise.reject(errorWithCode('ENOENT'));
    return Promise.resolve(content);
  }

  list(dir: string): Promise<readonly DirEntry[]> {
    if (this.nodes.get(dir)?.kind !== 'directory') {
      return Promise.reject(errorWithCode('ENOENT'));
    }
    const entries: DirEntry[] = [];
    for (const [path, node] of this.nodes) {
      if (path === dir || parentOf(path) !== dir) continue;
      entries.push({
        name: path.slice(dir.length + 1),
        kind: node.kind,
      });
    }
    return Promise.resolve(
      entries.sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  stamp(path: string): Promise<FileStamp | null> {
    const node = this.nodes.get(path);
    if (node?.kind !== 'file') return Promise.resolve(null);
    return Promise.resolve({
      size: node.content.length,
      mtimeMs: node.mtimeMs,
    });
  }

  readLink(path: string): Promise<string | null> {
    const node = this.nodes.get(path);
    return Promise.resolve(node?.kind === 'symlink' ? node.target : null);
  }

  exists(path: string): Promise<boolean> {
    return Promise.resolve(this.nodes.has(path));
  }

  copyFile(from: string, to: string): Promise<void> {
    return Promise.resolve().then(() => {
      this.onCopy(from, to);
      const source = this.nodes.get(from);
      if (source?.kind !== 'file') throw errorWithCode('ENOENT');
      if (this.nodes.has(to)) throw errorWithCode('EEXIST');
      this.addFile(to, source.content, source.mtimeMs);
      this.copied.push([from, to]);
    });
  }

  remove(path: string): Promise<void> {
    return Promise.resolve().then(() => {
      this.onRemove(path);
      this.removed.push(path);
      for (const key of [...this.nodes.keys()]) {
        if (key === path || key.startsWith(`${path}/`)) this.nodes.delete(key);
        if (key.startsWith(`${path}\\`)) this.nodes.delete(key);
      }
    });
  }

  randomName(): string {
    this.counter += 1;
    return `random${this.counter}`;
  }
}

/** A `ProcessProbe` over a fixed set of live pids. */
export function fakeProcesses(
  host: string,
  alivePids: readonly number[],
): ProcessProbe {
  return {
    hostname: () => host,
    isAlive: (pid) => alivePids.includes(pid),
  };
}
