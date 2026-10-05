import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createNodeFileProbe } from '../../../src/browser-selection/adapters/node-file-probe.ts';

const EXECUTABLE_MODE = 0o755;
const READ_ONLY_MODE = 0o644;

let dir = '';

async function fileWithMode(name: string, mode: number): Promise<string> {
  const file = join(dir, name);
  await writeFile(file, '#!/bin/sh\n');
  await chmod(file, mode);
  return file;
}

describe('createNodeFileProbe', () => {
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'file-probe-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('sees an executable file as a file and not as a directory', async () => {
    const probe = createNodeFileProbe('linux');
    const file = await fileWithMode('browser', EXECUTABLE_MODE);
    expect(await probe.isFile(file)).toBe(true);
    expect(await probe.isDirectory(file)).toBe(false);
  });

  it('sees a directory as a directory and not as a file', async () => {
    const probe = createNodeFileProbe('linux');
    const folder = join(dir, 'App.app');
    await mkdir(folder);
    expect(await probe.isDirectory(folder)).toBe(true);
    expect(await probe.isFile(folder)).toBe(false);
  });

  it('answers false for a path that does not exist', async () => {
    const probe = createNodeFileProbe('darwin');
    const missing = join(dir, 'nothing');
    expect(await probe.isFile(missing)).toBe(false);
    expect(await probe.isDirectory(missing)).toBe(false);
  });

  it.skipIf(process.platform === 'win32')(
    'does not count a file without the execute bit on POSIX',
    async () => {
      const probe = createNodeFileProbe('linux');
      const file = await fileWithMode('plain', READ_ONLY_MODE);
      expect(await probe.isFile(file)).toBe(false);
    },
  );

  it('accepts a file without the execute bit on Windows, which has none', async () => {
    const probe = createNodeFileProbe('win32');
    const file = await fileWithMode('browser.exe', READ_ONLY_MODE);
    expect(await probe.isFile(file)).toBe(true);
  });
});
