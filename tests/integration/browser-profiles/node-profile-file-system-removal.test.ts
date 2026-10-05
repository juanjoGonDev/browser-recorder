import * as fsPromises from 'node:fs/promises';
import { mkdtemp, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { nodeProfileFileSystem as fsAdapter } from '../../../src/browser-profiles/adapters/node-profile-file-system.ts';

vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof fsPromises>();
  return { ...original, rm: vi.fn(original.rm) };
});

// A browser that just exited can hold a file such as chrome_debug.log for a
// moment on Windows; Node retries EBUSY/EPERM/ENOTEMPTY with these options.
const BROWSER_DIR_REMOVAL = {
  recursive: true,
  force: true,
  maxRetries: 10,
  retryDelay: 100,
};

describe('nodeProfileFileSystem remove', () => {
  it('deletes a directory with the retries a just-closed browser needs', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'browser-recorder-removal-'));
    await writeFile(join(dir, 'chrome_debug.log'), 'log');
    await fsAdapter.remove(dir);
    expect(vi.mocked(fsPromises.rm)).toHaveBeenCalledWith(
      dir,
      BROWSER_DIR_REMOVAL,
    );
    await expect(stat(dir)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
