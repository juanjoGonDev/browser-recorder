import { describe, expect, it } from 'vitest';

import { readLocalState } from '../../../src/browser-profiles/application/read-local-state.ts';
import {
  errorWithCode,
  MemoryProfileFileSystem,
} from '../../support/memory-profile-file-system.ts';

const ROOT = '/real/Brave';
const STATE_PATH = `${ROOT}/Local State`;
const VALID = '{"profile":{"info_cache":{"Default":{"name":"Me"}}}}';

function failReads(fs: MemoryProfileFileSystem, code: string): void {
  fs.readText = () => Promise.reject(errorWithCode(code));
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  return null;
}

describe('readLocalState', () => {
  it('returns the parsed profiles when Local State is valid', async () => {
    const fs = new MemoryProfileFileSystem();
    fs.addFile(STATE_PATH, VALID);
    expect(await readLocalState(fs, 'linux', ROOT)).toEqual({
      kind: 'ok',
      info: {
        profiles: [{ directory: 'Default', displayName: 'Me' }],
        hasAppBoundEncryption: false,
      },
    });
  });

  it('reports a missing file as missing', async () => {
    const fs = new MemoryProfileFileSystem();
    expect(await readLocalState(fs, 'linux', ROOT)).toEqual({
      kind: 'missing',
    });
  });

  it('reports unparsable JSON as missing', async () => {
    const fs = new MemoryProfileFileSystem();
    fs.addFile(STATE_PATH, 'not json');
    expect(await readLocalState(fs, 'linux', ROOT)).toEqual({
      kind: 'missing',
    });
  });

  it.each([
    ['darwin', 'EPERM'],
    ['linux', 'EACCES'],
    ['linux', 'EPERM'],
  ])('reports %s %s as unreadable', async (platform, code) => {
    const fs = new MemoryProfileFileSystem();
    fs.addFile(STATE_PATH, VALID);
    failReads(fs, code);
    expect(await readLocalState(fs, platform, ROOT)).toEqual({
      kind: 'unreadable',
    });
  });

  it('reports a denied path from the memory hook as unreadable', async () => {
    const fs = new MemoryProfileFileSystem();
    fs.addFile(STATE_PATH, VALID);
    fs.deniedPaths.add(STATE_PATH);
    expect(await readLocalState(fs, 'darwin', ROOT)).toEqual({
      kind: 'unreadable',
    });
  });

  it('rethrows an unrelated errno unchanged', async () => {
    const fs = new MemoryProfileFileSystem();
    fs.addFile(STATE_PATH, VALID);
    failReads(fs, 'EIO');
    expect(await rejection(readLocalState(fs, 'linux', ROOT))).toMatchObject({
      code: 'EIO',
    });
  });
});
