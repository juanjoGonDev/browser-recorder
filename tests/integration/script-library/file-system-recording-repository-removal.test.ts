import * as fsPromises from 'node:fs/promises';
import { mkdir, mkdtemp, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { createFileSystemRecordingRepository } from '../../../src/script-library/adapters/file-system-recording-repository.ts';
import { removeDir } from '../../support/remove-dir.ts';

vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof fsPromises>();
  return { ...original, rm: vi.fn(original.rm) };
});

// A replay's browser may still hold a file under the recording for a moment
// on Windows; Node retries EBUSY/EPERM/ENOTEMPTY with these options.
const BROWSER_DIR_REMOVAL = {
  recursive: true,
  force: true,
  maxRetries: 10,
  retryDelay: 100,
};

describe('FileSystemRecordingRepository remove', () => {
  it('deletes a recording folder with the retries a just-closed browser needs', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'repo-removal-'));
    const root = join(parent, 'recordings');
    const folder = join(root, 'busy');
    await mkdir(join(folder, 'files'), { recursive: true });
    await writeFile(join(folder, 'files', 'upload.txt'), 'x');
    try {
      await createFileSystemRecordingRepository({ root }).remove('busy');
      expect(vi.mocked(fsPromises.rm)).toHaveBeenCalledWith(
        folder,
        BROWSER_DIR_REMOVAL,
      );
      await expect(stat(folder)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await removeDir(parent);
    }
  });
});
