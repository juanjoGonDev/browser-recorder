import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BRAVE_LIKE_PROFILE,
  FIXTURE_PROFILES_ROOT,
} from '../../support/profile-fixtures.ts';

type Json = Readonly<Record<string, unknown>>;

async function localState(): Promise<Json> {
  const text = await readFile(
    path.join(BRAVE_LIKE_PROFILE, 'Local State'),
    'utf8',
  );
  return JSON.parse(text) as Json;
}

/** Reads one nested key of the parsed `Local State` without naming its shape. */
function at(state: Json, ...keys: string[]): unknown {
  return keys.reduce<unknown>(
    (value, key) => (value as Json | undefined)?.[key],
    state,
  );
}

describe('tests/fixtures/profiles/brave-like', () => {
  it('lives under tests/fixtures/profiles, never in a real home', () => {
    const relative = path.relative(FIXTURE_PROFILES_ROOT, BRAVE_LIKE_PROFILE);
    expect(relative).toBe('brave-like');
    expect(FIXTURE_PROFILES_ROOT).toContain(
      path.join('tests', 'fixtures', 'profiles'),
    );
  });

  it('describes two profiles in the order Chromium lists them', async () => {
    const state = await localState();
    expect(at(state, 'profile', 'profiles_order')).toEqual([
      'Default',
      'Profile 1',
    ]);
    const cache = at(state, 'profile', 'info_cache') as Json;
    expect(Object.keys(cache)).toEqual(['Default', 'Profile 1']);
    expect(at(state, 'profile', 'info_cache', 'Default', 'name')).toBe(
      'Person 1',
    );
  });

  it('has no app-bound encryption key', async () => {
    const crypt = at(await localState(), 'os_crypt') as Json;
    expect(Object.keys(crypt)).toEqual(['encrypted_key']);
  });

  it('gives Default the stores a copy has to carry or skip', async () => {
    const names = await readdir(path.join(BRAVE_LIKE_PROFILE, 'Default'));
    expect(names.sort()).toEqual([
      'Cache',
      'Cookies',
      'Cookies-wal',
      'Preferences',
    ]);
    const cache = await readdir(
      path.join(BRAVE_LIKE_PROFILE, 'Default', 'Cache'),
    );
    expect(cache).toEqual(['x']);
  });

  it('has a second profile with its own preferences and cookies', async () => {
    const names = await readdir(path.join(BRAVE_LIKE_PROFILE, 'Profile 1'));
    expect(names.sort()).toEqual(['Cookies', 'Preferences']);
  });

  it('holds placeholder bytes, never a real login', async () => {
    const cookies = path.join(BRAVE_LIKE_PROFILE, 'Default', 'Cookies');
    expect((await stat(cookies)).size).toBeLessThan(200);
    expect(await readFile(cookies, 'utf8')).toContain('FIXTURE');
  });
});
