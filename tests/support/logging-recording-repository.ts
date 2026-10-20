import type {
  RecordingFiles,
  RecordingRepository,
} from '../../src/script-library/application/ports/recording-repository.ts';

/** An in-memory repository that logs writes and can delay or fail them. */
export class MemoryRepository implements RecordingRepository {
  readonly files = new Map<string, RecordingFiles>();
  readonly writeLog: string[] = [];
  writeDelayMs = 0;
  shouldFailNextWrite = false;

  listSlugs(): Promise<readonly string[]> {
    return Promise.resolve([...this.files.keys()]);
  }

  reserve(slug: string): Promise<boolean> {
    if (this.files.has(slug)) return Promise.resolve(false);
    this.files.set(slug, { recordingJson: '', scriptMjs: '' });
    return Promise.resolve(true);
  }

  read(slug: string): Promise<unknown> {
    const files = this.files.get(slug);
    if (files === undefined) return Promise.reject(new Error('ENOENT'));
    return Promise.resolve(JSON.parse(files.recordingJson));
  }

  writeScript(slug: string, scriptMjs: string): Promise<void> {
    const files = this.files.get(slug);
    if (files === undefined) return Promise.reject(new Error('ENOENT'));
    this.files.set(slug, { ...files, scriptMjs });
    this.writeLog.push(`script ${slug}`);
    return Promise.resolve();
  }

  async write(slug: string, files: RecordingFiles): Promise<void> {
    this.writeLog.push(`start ${slug}`);
    await new Promise((resolve) => setTimeout(resolve, this.writeDelayMs));
    if (this.shouldFailNextWrite) {
      this.shouldFailNextWrite = false;
      throw new Error('disk full');
    }
    this.files.set(slug, files);
    this.writeLog.push(`end ${slug}`);
  }

  move(from: string, to: string): Promise<void> {
    const files = this.files.get(from);
    if (files === undefined || this.files.has(to)) {
      return Promise.reject(new Error('target exists'));
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
    return `/lib/${slug}/script.mjs`;
  }
}
