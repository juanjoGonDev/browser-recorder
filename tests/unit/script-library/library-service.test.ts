import { describe, expect, it, vi } from 'vitest';

import type {
  RecordingFiles,
  RecordingRepository,
} from '../../../src/script-library/application/ports/recording-repository.ts';
import { createLibraryService } from '../../../src/script-library/application/library-service.ts';
import type { Recording } from '../../../src/shared/domain/recording.ts';
import {
  BASIC_RECORDING,
  recordingOf,
} from '../../support/golden-recordings.ts';

class MemoryRepository implements RecordingRepository {
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

const NOW = new Date('2026-03-04T05:06:07.000Z');

function setup(): {
  repository: MemoryRepository;
  service: ReturnType<typeof createLibraryService>;
} {
  const repository = new MemoryRepository();
  const service = createLibraryService({
    repository,
    renderScript: (recording: Recording) => `// script for ${recording.slug}\n`,
    now: () => NOW,
  });
  return { repository, service };
}

async function seed(
  service: ReturnType<typeof createLibraryService>,
  recording: Recording,
): Promise<void> {
  await service.save(recording);
}

describe('createLibraryService', () => {
  describe('createDraft', () => {
    it('stores an empty recording with slug, name, start URL and createdAt', async () => {
      const { repository, service } = setup();
      const draft = await service.createDraft(
        'Login Flow',
        'https://example.com',
      );
      expect(draft).toMatchObject({
        schemaVersion: 2,
        name: 'Login Flow',
        slug: 'login-flow',
        startUrl: 'https://example.com',
        createdAt: NOW.toISOString(),
        status: 'recording',
        display: { kind: 'window', width: 1280, height: 800 },
        browser: {
          browserId: 'bundled',
          profileMode: 'ephemeral',
          sourceProfile: null,
        },
        events: [],
      });
      const stored = repository.files.get('login-flow');
      expect(JSON.parse(stored?.recordingJson ?? '')).toMatchObject({
        name: 'Login Flow',
      });
      expect(stored?.scriptMjs).toBe('// script for login-flow\n');
    });

    it('treats an empty start URL as none', async () => {
      const { service } = setup();
      expect((await service.createDraft('A', '')).startUrl).toBeNull();
    });

    it('suffixes the slug on collision', async () => {
      const { service } = setup();
      await service.createDraft('Login Flow', '');
      expect((await service.createDraft('Login Flow', '')).slug).toBe(
        'login-flow-2',
      );
      expect((await service.createDraft('login flow', '')).slug).toBe(
        'login-flow-3',
      );
    });

    it('rejects an invalid name or URL without reserving anything', async () => {
      const { repository, service } = setup();
      await expect(service.createDraft('', '')).rejects.toThrow(/name/i);
      await expect(service.createDraft('ok', 'ftp://x')).rejects.toThrow(
        /http/i,
      );
      expect(repository.files.size).toBe(0);
    });

    it('moves on to the next slug when a concurrent creator wins the reservation', async () => {
      const { repository, service } = setup();
      vi.spyOn(repository, 'listSlugs').mockResolvedValue([]);
      await repository.reserve('race');
      expect((await service.createDraft('Race', '')).slug).toBe('race-2');
    });
  });

  describe('save and load', () => {
    it('round trips a recording and stamps updatedAt from the clock', async () => {
      const { service } = setup();
      await service.save(BASIC_RECORDING);
      expect(await service.load('golden')).toEqual({
        ...BASIC_RECORDING,
        updatedAt: NOW.toISOString(),
      });
    });

    it('rejects loading an unsupported schema version', async () => {
      const { repository, service } = setup();
      repository.files.set('old', {
        recordingJson: '{"schemaVersion":9}',
        scriptMjs: '',
      });
      await expect(service.load('old')).rejects.toThrow(
        /unsupported schemaVersion 9/i,
      );
      expect(repository.files.get('old')?.recordingJson).toBe(
        '{"schemaVersion":9}',
      );
    });

    it('serialises concurrent saves of one slug', async () => {
      const { repository, service } = setup();
      repository.writeDelayMs = 5;
      await Promise.all([
        service.save(BASIC_RECORDING),
        service.save(BASIC_RECORDING),
      ]);
      expect(repository.writeLog).toEqual([
        'start golden',
        'end golden',
        'start golden',
        'end golden',
      ]);
    });

    it('lets different slugs write in parallel', async () => {
      const { repository, service } = setup();
      repository.writeDelayMs = 5;
      await Promise.all([
        service.save(recordingOf([], { slug: 'a' })),
        service.save(recordingOf([], { slug: 'b' })),
      ]);
      expect(repository.writeLog.slice(0, 2)).toEqual(['start a', 'start b']);
    });

    it('keeps the queue usable after a failed save', async () => {
      const { repository, service } = setup();
      repository.shouldFailNextWrite = true;
      await expect(service.save(BASIC_RECORDING)).rejects.toThrow('disk full');
      await service.save(BASIC_RECORDING);
      expect(repository.files.has('golden')).toBe(true);
    });
  });

  describe('list', () => {
    it('sorts by createdAt descending', async () => {
      const { service } = setup();
      await seed(
        service,
        recordingOf([], { slug: 'old', createdAt: '2026-01-01T00:00:00.000Z' }),
      );
      await seed(
        service,
        recordingOf([], { slug: 'new', createdAt: '2026-02-01T00:00:00.000Z' }),
      );
      const listing = await service.list();
      expect(
        listing.map((entry) =>
          entry.kind === 'valid' ? entry.summary.slug : entry.slug,
        ),
      ).toEqual(['new', 'old']);
    });

    it('reports a corrupt entry as invalid and keeps the valid ones', async () => {
      const { repository, service } = setup();
      await seed(service, BASIC_RECORDING);
      repository.files.set('broken', { recordingJson: '{nope', scriptMjs: '' });
      const listing = await service.list();
      expect(listing).toHaveLength(2);
      expect(listing[0]).toMatchObject({
        kind: 'valid',
        summary: { slug: 'golden', stepCount: BASIC_RECORDING.events.length },
      });
      expect(listing[1]).toMatchObject({ kind: 'invalid', slug: 'broken' });
      expect(listing[1]).toHaveProperty('reason');
    });

    it('lists an unsupported schema version as invalid with its reason', async () => {
      const { repository, service } = setup();
      repository.files.set('future', {
        recordingJson: '{"schemaVersion":3}',
        scriptMjs: '',
      });
      const [entry, ...rest] = await service.list();
      expect(rest).toEqual([]);
      expect(entry).toMatchObject({ kind: 'invalid', slug: 'future' });
      expect(JSON.stringify(entry)).toMatch(/schemaVersion 3/);
    });
  });

  describe('rename', () => {
    it('moves to the new slug, updates name and regenerates the script', async () => {
      const { repository, service } = setup();
      await seed(service, recordingOf([], { slug: 'a', name: 'A' }));
      const renamed = await service.rename('a', 'Brand New');
      expect(renamed).toMatchObject({ slug: 'brand-new', name: 'Brand New' });
      expect([...repository.files.keys()]).toEqual(['brand-new']);
      expect(repository.files.get('brand-new')?.scriptMjs).toBe(
        '// script for brand-new\n',
      );
      expect((await service.load('brand-new')).name).toBe('Brand New');
    });

    it('keeps the browser and the mode of the recording', async () => {
      const { service } = setup();
      const chrome = {
        browserId: 'chrome',
        profileMode: 'managed',
        sourceProfile: null,
      } as const;
      await seed(service, recordingOf([], { slug: 'a', browser: chrome }));
      const renamed = await service.rename('a', 'Other');
      expect(renamed.browser).toEqual(chrome);
      expect((await service.load('other')).browser).toEqual(chrome);
    });

    it('refuses a name whose slug is taken and leaves both recordings unchanged', async () => {
      const { repository, service } = setup();
      await seed(service, recordingOf([], { slug: 'a', name: 'A' }));
      await seed(service, recordingOf([], { slug: 'b', name: 'B' }));
      const before = structuredClone([...repository.files.entries()]);
      await expect(service.rename('a', 'B')).rejects.toThrow(/already exists/);
      expect([...repository.files.entries()]).toEqual(before);
    });

    it('changes only the display name when the slug is the same', async () => {
      const { repository, service } = setup();
      await seed(
        service,
        recordingOf([], { slug: 'my-test', name: 'My Test' }),
      );
      const moveSpy = vi.spyOn(repository, 'move');
      const renamed = await service.rename('my-test', 'My Test!');
      expect(renamed).toMatchObject({ slug: 'my-test', name: 'My Test!' });
      expect(moveSpy).not.toHaveBeenCalled();
    });

    it('rejects an invalid name before touching storage', async () => {
      const { repository, service } = setup();
      await seed(service, recordingOf([], { slug: 'a' }));
      const moveSpy = vi.spyOn(repository, 'move');
      await expect(service.rename('a', '')).rejects.toThrow(/name/i);
      expect(moveSpy).not.toHaveBeenCalled();
    });

    it('moves the folder back when rewriting the renamed recording fails', async () => {
      const { repository, service } = setup();
      await seed(service, recordingOf([], { slug: 'a', name: 'A' }));
      repository.shouldFailNextWrite = true;
      await expect(service.rename('a', 'Zed')).rejects.toThrow('disk full');
      expect([...repository.files.keys()]).toEqual(['a']);
    });
  });

  describe('regenerateScript', () => {
    it('rewrites only script.mjs and returns the recording', async () => {
      const { repository, service } = setup();
      await seed(service, recordingOf([], { slug: 'a', name: 'A' }));
      repository.writeLog.length = 0;
      const jsonBefore = repository.files.get('a')?.recordingJson;
      repository.files.set('a', {
        recordingJson: jsonBefore ?? '',
        scriptMjs: '// stale\n',
      });

      const recording = await service.regenerateScript('a');

      expect(recording).toMatchObject({ slug: 'a', name: 'A' });
      expect(repository.files.get('a')).toEqual({
        recordingJson: jsonBefore,
        scriptMjs: '// script for a\n',
      });
      expect(repository.writeLog).toEqual(['script a']);
    });

    it('does not upgrade a version 1 file on disk', async () => {
      const { repository, service } = setup();
      const legacy = JSON.stringify({
        ...BASIC_RECORDING,
        schemaVersion: 1,
        display: undefined,
        browser: undefined,
        viewport: { width: 1280, height: 800 },
      });
      repository.files.set('golden', { recordingJson: legacy, scriptMjs: '' });

      const recording = await service.regenerateScript('golden');

      expect(recording.schemaVersion).toBe(2);
      expect(repository.files.get('golden')?.recordingJson).toBe(legacy);
      expect(repository.files.get('golden')?.scriptMjs).toBe(
        '// script for golden\n',
      );
    });

    it('fails for a recording that cannot be read', async () => {
      const { service } = setup();
      await expect(service.regenerateScript('missing')).rejects.toThrow();
    });
  });

  describe('remove', () => {
    it('deletes the recording from the repository', async () => {
      const { repository, service } = setup();
      await seed(service, BASIC_RECORDING);
      await service.remove('golden');
      expect(repository.files.size).toBe(0);
    });

    it('runs after a save in flight so the delete wins', async () => {
      const { repository, service } = setup();
      repository.writeDelayMs = 5;
      const saving = service.save(BASIC_RECORDING);
      await service.remove('golden');
      await saving;
      expect(repository.writeLog).toEqual(['start golden', 'end golden']);
      expect(repository.files.has('golden')).toBe(false);
    });
  });
});
