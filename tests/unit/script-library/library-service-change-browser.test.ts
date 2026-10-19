import { describe, expect, it } from 'vitest';

import { createLibraryService } from '../../../src/script-library/application/library-service.ts';
import type { Recording } from '../../../src/shared/domain/recording.ts';
import {
  BASIC_RECORDING,
  recordingOf,
} from '../../support/golden-recordings.ts';
import { MemoryRepository } from '../../support/logging-recording-repository.ts';

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
  describe('changeBrowser', () => {
    const chrome = {
      browserId: 'chrome',
      profileMode: 'managed',
      sourceProfile: null,
    } as const;
    const braveCopy = {
      browserId: 'brave',
      profileMode: 'copy-of-real',
      sourceProfile: 'Profile 2',
    } as const;

    function setupWithBrowserScript(): ReturnType<typeof setup> {
      const repository = new MemoryRepository();
      const service = createLibraryService({
        repository,
        renderScript: (recording: Recording) =>
          `// browser ${recording.browser.browserId} ${recording.browser.profileMode}\n`,
        now: () => NOW,
      });
      return { repository, service };
    }

    it('writes the browser, mode and profile and keeps everything else', async () => {
      const { repository, service } = setupWithBrowserScript();
      await seed(service, { ...BASIC_RECORDING, browser: chrome });
      const changed = await service.changeBrowser('golden', braveCopy);
      expect(changed.browser).toEqual(braveCopy);
      const reloaded = await service.load('golden');
      expect(reloaded.browser).toEqual(braveCopy);
      expect(reloaded).toMatchObject({
        name: BASIC_RECORDING.name,
        slug: BASIC_RECORDING.slug,
        startUrl: BASIC_RECORDING.startUrl,
        createdAt: BASIC_RECORDING.createdAt,
        events: BASIC_RECORDING.events,
      });
      expect(repository.files.get('golden')?.scriptMjs).toBe(
        '// browser brave copy-of-real\n',
      );
    });

    it('changes again and returns to a managed profile', async () => {
      const { repository, service } = setupWithBrowserScript();
      await seed(service, { ...BASIC_RECORDING, browser: chrome });
      await service.changeBrowser('golden', braveCopy);
      await service.changeBrowser('golden', chrome);
      expect((await service.load('golden')).browser).toEqual(chrome);
      expect(repository.files.get('golden')?.scriptMjs).toBe(
        '// browser chrome managed\n',
      );
    });

    it('fails for an unknown slug and writes nothing', async () => {
      const { repository, service } = setup();
      await expect(service.changeBrowser('ghost', chrome)).rejects.toThrow();
      expect(repository.writeLog).toEqual([]);
      expect(repository.files.size).toBe(0);
    });

    it('rejects an invalid choice and leaves the recording as it was', async () => {
      const { repository, service } = setup();
      await seed(service, { ...BASIC_RECORDING, browser: chrome });
      const before = repository.files.get('golden');
      const invalid = { ...chrome, profileMode: 'bogus' } as never;
      await expect(service.changeBrowser('golden', invalid)).rejects.toThrow(
        /profileMode|browser/,
      );
      expect(repository.files.get('golden')).toBe(before);
    });

    it('runs a change and a rename on one slug one after the other', async () => {
      const { repository, service } = setup();
      await seed(service, recordingOf([], { slug: 'a', name: 'A' }));
      repository.writeDelayMs = 5;
      repository.writeLog.length = 0;
      await Promise.all([
        service.changeBrowser('a', braveCopy),
        service.rename('a', 'B'),
      ]);
      expect(repository.writeLog).toEqual([
        'start a',
        'end a',
        'start b',
        'end b',
      ]);
      const final = await service.load('b');
      expect(final).toMatchObject({ name: 'B', browser: braveCopy });
    });

    it('keeps the new browser through a later rename and a rename alone leaves it', async () => {
      const { service } = setup();
      await seed(service, recordingOf([], { slug: 'a', browser: chrome }));
      const renamed = await service.rename('a', 'Plain');
      expect(renamed.browser).toEqual(chrome);
      await service.changeBrowser('plain', braveCopy);
      const again = await service.rename('plain', 'Other');
      expect(again.browser).toEqual(braveCopy);
      expect((await service.load('other')).browser).toEqual(braveCopy);
    });
  });
});
