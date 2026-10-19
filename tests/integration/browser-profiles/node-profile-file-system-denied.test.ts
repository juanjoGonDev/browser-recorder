import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nodeProfileFileSystem as fsAdapter } from '../../../src/browser-profiles/adapters/node-profile-file-system.ts';
import { classifyFileError } from '../../../src/browser-profiles/domain/file-access-failure.ts';

const isRoot = process.getuid?.() === 0;
const isUnsupported = process.platform === 'win32' || isRoot;

let dir = '';
let locked = '';

async function codeOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code;
  }
  return null;
}

describe.skipIf(isUnsupported)('nodeProfileFileSystem denied directory', () => {
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'browser-recorder-denied-'));
    locked = join(dir, 'locked');
    await mkdir(locked);
    await writeFile(join(locked, 'Local State'), '{}');
    await chmod(locked, 0o000);
  });

  afterEach(async () => {
    await chmod(locked, 0o700);
    await rm(dir, { recursive: true, force: true });
  });

  it('surfaces EACCES when reading inside a directory it cannot open', async () => {
    const code = await codeOf(fsAdapter.readText(join(locked, 'Local State')));
    expect(code).toBe('EACCES');
    expect(classifyFileError(code as string, process.platform)).toBe('denied');
  });

  it('surfaces EACCES when listing or probing the directory contents', async () => {
    expect(await codeOf(fsAdapter.list(locked))).toBe('EACCES');
    expect(await codeOf(fsAdapter.exists(join(locked, 'Local State')))).toBe(
      'EACCES',
    );
  });

  it('keeps reporting ENOENT for a path that does not exist', async () => {
    const code = await codeOf(fsAdapter.readText(join(dir, 'nope')));
    expect(code).toBe('ENOENT');
  });
});
