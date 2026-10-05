import { mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import { BROWSER_DIRECTORY_REMOVAL } from '../../shared/domain/browser-directory-removal.ts';
import type {
  RecordingFiles,
  RecordingRepository,
} from '../application/ports/recording-repository.ts';
import { isValidSlug } from '../domain/slugify.ts';
import {
  atomicWriteFile,
  renameWithRetry,
  type AtomicWriteOptions,
} from './atomic-write-file.ts';
import { resolveInsideRoot } from './resolve-inside-root.ts';

const RECORDING_FILE = 'recording.json';
const SCRIPT_FILE = 'script.mjs';

export interface FileSystemRecordingRepositoryOptions {
  readonly root: string;
  readonly io?: AtomicWriteOptions;
}

function isCode(error: unknown, code: string): boolean {
  return (error as { code?: unknown } | null)?.code === code;
}

async function pathExists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  );
}

/** Stores each recording under `<root>/<slug>/`, one safe path segment. */
export function createFileSystemRecordingRepository(
  options: FileSystemRecordingRepositoryOptions,
): RecordingRepository {
  return new FileSystemRecordingRepository(options);
}

class FileSystemRecordingRepository implements RecordingRepository {
  private readonly root: string;
  private readonly io: AtomicWriteOptions | undefined;

  constructor(options: FileSystemRecordingRepositoryOptions) {
    this.root = resolve(options.root);
    this.io = options.io;
  }

  async listSlugs(): Promise<readonly string[]> {
    const entries = await readdir(this.root, { withFileTypes: true }).catch(
      (error: unknown) => {
        if (isCode(error, 'ENOENT')) return [];
        throw error;
      },
    );
    return entries
      .filter((entry) => entry.isDirectory() && isValidSlug(entry.name))
      .map((entry) => entry.name)
      .sort();
  }

  async reserve(slug: string): Promise<boolean> {
    const dir = this.slugDir(slug);
    await mkdir(this.root, { recursive: true });
    try {
      await mkdir(dir);
      return true;
    } catch (error) {
      if (isCode(error, 'EEXIST')) return false;
      throw error;
    }
  }

  async read(slug: string): Promise<unknown> {
    const text = await readFile(this.fileOf(slug, RECORDING_FILE), 'utf8');
    return JSON.parse(text) as unknown;
  }

  async write(slug: string, files: RecordingFiles): Promise<void> {
    await mkdir(this.slugDir(slug), { recursive: true });
    const json = this.fileOf(slug, RECORDING_FILE);
    await atomicWriteFile(json, files.recordingJson, this.io);
    const script = this.fileOf(slug, SCRIPT_FILE);
    await atomicWriteFile(script, files.scriptMjs, this.io);
  }

  async writeScript(slug: string, scriptMjs: string): Promise<void> {
    await mkdir(this.slugDir(slug), { recursive: true });
    await atomicWriteFile(this.fileOf(slug, SCRIPT_FILE), scriptMjs, this.io);
  }

  async move(from: string, to: string): Promise<void> {
    const source = this.slugDir(from);
    const target = this.slugDir(to);
    if (await pathExists(target)) {
      throw new Error(`Recording "${to}" already exists.`);
    }
    await renameWithRetry(source, target, this.io);
  }

  async remove(slug: string): Promise<void> {
    await rm(this.slugDir(slug), BROWSER_DIRECTORY_REMOVAL);
  }

  scriptPath(slug: string): string {
    return this.fileOf(slug, SCRIPT_FILE);
  }

  private slugDir(slug: string): string {
    if (!isValidSlug(slug)) {
      throw new Error(`Invalid recording slug: ${JSON.stringify(slug)}.`);
    }
    return resolveInsideRoot(this.root, slug);
  }

  private fileOf(slug: string, name: string): string {
    this.slugDir(slug);
    return resolveInsideRoot(this.root, slug, name);
  }
}
