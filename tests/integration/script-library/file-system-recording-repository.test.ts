import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createFileSystemRecordingRepository } from '../../../src/script-library/adapters/file-system-recording-repository.ts';
import { resolveInsideRoot } from '../../../src/script-library/adapters/resolve-inside-root.ts';
import type { RecordingRepository } from '../../../src/script-library/application/ports/recording-repository.ts';

let root = '';
let repository: RecordingRepository;

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  );
}

describe('FileSystemRecordingRepository', () => {
  beforeEach(async () => {
    root = join(await mkdtemp(join(tmpdir(), 'repo-')), 'recordings');
    repository = createFileSystemRecordingRepository({ root });
  });

  afterEach(async () => {
    await rm(join(root, '..'), { recursive: true, force: true });
  });

  it('lists nothing before the root exists', async () => {
    expect(await repository.listSlugs()).toEqual([]);
  });

  it('reserves a slug once and creates its directory', async () => {
    expect(await repository.reserve('login-flow')).toBe(true);
    expect(await exists(join(root, 'login-flow'))).toBe(true);
    expect(await repository.reserve('login-flow')).toBe(false);
  });

  it('writes both files and reads the JSON back', async () => {
    await repository.reserve('a');
    await repository.write('a', {
      recordingJson: '{"name":"A"}',
      scriptMjs: 'export {};',
    });
    expect(await repository.read('a')).toEqual({ name: 'A' });
    expect(await readFile(repository.scriptPath('a'), 'utf8')).toBe(
      'export {};',
    );
  });

  it('replaces script.mjs without touching recording.json', async () => {
    await repository.write('a', {
      recordingJson: '{"name":"A"}',
      scriptMjs: 'old',
    });
    const recordingPath = join(root, 'a', 'recording.json');
    const before = await stat(recordingPath);

    await repository.writeScript('a', 'export const fresh = 1;');

    expect(await readFile(repository.scriptPath('a'), 'utf8')).toBe(
      'export const fresh = 1;',
    );
    expect(await readFile(recordingPath, 'utf8')).toBe('{"name":"A"}');
    expect((await stat(recordingPath)).mtimeMs).toBe(before.mtimeMs);
  });

  it('refuses to write a script for an unsafe slug', async () => {
    await expect(repository.writeScript('../x', '')).rejects.toThrow(
      /invalid recording slug/i,
    );
  });

  it('writes into a slug that was never reserved', async () => {
    await repository.write('fresh', { recordingJson: '{}', scriptMjs: '' });
    expect(await repository.listSlugs()).toEqual(['fresh']);
  });

  it('exposes the script path inside the root', () => {
    expect(repository.scriptPath('a')).toBe(join(root, 'a', 'script.mjs'));
  });

  it('ignores orphan temp files and stray entries when listing and reading', async () => {
    await repository.write('a', { recordingJson: '{"v":1}', scriptMjs: '' });
    await writeFile(join(root, 'a', 'recording.json.1.abc.tmp'), 'torn');
    await writeFile(join(root, 'stray.txt'), 'x');
    await mkdir(join(root, 'Not A Slug'));
    expect(await repository.listSlugs()).toEqual(['a']);
    expect(await repository.read('a')).toEqual({ v: 1 });
  });

  it('rejects when recording.json is not valid JSON', async () => {
    await repository.reserve('bad');
    await writeFile(join(root, 'bad', 'recording.json'), '{nope');
    await expect(repository.read('bad')).rejects.toThrow();
  });

  it.each(['../x', 'a/b', 'C:\\x', 'has space', '', '..', 'A'])(
    'rejects the slug %j on every method',
    async (slug) => {
      await expect(repository.reserve(slug)).rejects.toThrow(/slug/i);
      await expect(repository.read(slug)).rejects.toThrow(/slug/i);
      await expect(
        repository.write(slug, { recordingJson: '{}', scriptMjs: '' }),
      ).rejects.toThrow(/slug/i);
      await expect(repository.remove(slug)).rejects.toThrow(/slug/i);
      await expect(repository.move(slug, 'ok')).rejects.toThrow(/slug/i);
      await expect(repository.move('ok', slug)).rejects.toThrow(/slug/i);
      expect(() => repository.scriptPath(slug)).toThrow(/slug/i);
    },
  );

  it('moves a directory with its files to a free slug', async () => {
    await repository.write('old', { recordingJson: '{}', scriptMjs: 's' });
    await mkdir(join(root, 'old', 'files'));
    await repository.move('old', 'new');
    expect(await repository.listSlugs()).toEqual(['new']);
    expect(await exists(join(root, 'new', 'files'))).toBe(true);
  });

  it('refuses to move onto an existing slug and changes nothing', async () => {
    await repository.write('a', { recordingJson: '{"n":"a"}', scriptMjs: '' });
    await repository.write('b', { recordingJson: '{"n":"b"}', scriptMjs: '' });
    await expect(repository.move('a', 'b')).rejects.toThrow(/exists/);
    expect(await repository.read('a')).toEqual({ n: 'a' });
    expect(await repository.read('b')).toEqual({ n: 'b' });
  });

  it('removes the whole folder: json, script, files/ and temp leftovers', async () => {
    await repository.write('gone', { recordingJson: '{}', scriptMjs: 's' });
    await mkdir(join(root, 'gone', 'files'));
    await writeFile(join(root, 'gone', 'files', 'upload.png'), 'png');
    await writeFile(join(root, 'gone', 'recording.json.9.zz.tmp'), 'torn');
    await repository.remove('gone');
    expect(await exists(join(root, 'gone'))).toBe(false);
    expect(await readdir(root)).toEqual([]);
  });

  it('removes a slug that does not exist without failing', async () => {
    await repository.remove('never-existed');
    expect(await repository.listSlugs()).toEqual([]);
  });
});

describe('resolveInsideRoot', () => {
  it('returns the resolved path of a nested segment', () => {
    expect(resolveInsideRoot('/data/recordings', 'a', 'script.mjs')).toBe(
      resolve('/data/recordings', 'a', 'script.mjs'),
    );
  });

  it.each([['..'], ['..', 'x'], ['a', '..', '..', 'x']])(
    'throws when %j escapes the root',
    (...segments) => {
      expect(() => resolveInsideRoot('/data/recordings', ...segments)).toThrow(
        /outside/,
      );
    },
  );

  it('throws for a sibling that merely shares the root prefix', () => {
    expect(() =>
      resolveInsideRoot('/data/recordings', '..', 'recordings-evil'),
    ).toThrow(/outside/);
  });
});
