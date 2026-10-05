import type {
  RecordingFiles,
  RecordingRepository,
} from '../../src/script-library/application/ports/recording-repository.ts';

const SCRIPT_ROOT = '/library';

/** An in-memory `RecordingRepository`: slugs map to the files written. */
export class MemoryRecordingRepository implements RecordingRepository {
  readonly files = new Map<string, RecordingFiles>();

  listSlugs(): Promise<readonly string[]> {
    return Promise.resolve([...this.files.keys()].sort());
  }

  reserve(slug: string): Promise<boolean> {
    if (this.files.has(slug)) return Promise.resolve(false);
    this.files.set(slug, { recordingJson: '', scriptMjs: '' });
    return Promise.resolve(true);
  }

  read(slug: string): Promise<unknown> {
    const files = this.files.get(slug);
    if (files === undefined) return Promise.reject(new Error('No such slug'));
    return Promise.resolve(JSON.parse(files.recordingJson));
  }

  write(slug: string, files: RecordingFiles): Promise<void> {
    this.files.set(slug, files);
    return Promise.resolve();
  }

  writeScript(slug: string, scriptMjs: string): Promise<void> {
    const files = this.files.get(slug);
    if (files === undefined) return Promise.reject(new Error('No such slug'));
    this.files.set(slug, { ...files, scriptMjs });
    return Promise.resolve();
  }

  move(from: string, to: string): Promise<void> {
    const files = this.files.get(from);
    if (files === undefined || this.files.has(to)) {
      return Promise.reject(new Error('Target exists'));
    }
    this.files.delete(from);
    this.files.set(to, files);
    return Promise.resolve();
  }

  remove(slug: string): Promise<void> {
    this.files.delete(slug);
    return Promise.resolve();
  }

  scriptPath(slug: string): string {
    return `${SCRIPT_ROOT}/${slug}/script.mjs`;
  }
}
