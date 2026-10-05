import { describe, expect, it } from 'vitest';

import { parseLocalState } from '../../../src/browser-profiles/domain/parse-local-state.ts';

/** Raw JSON text: the keys are Chromium's, not ours to rename. */
function localState(profileJson: string, osCryptJson = '{}'): string {
  return `{"profile":${profileJson},"os_crypt":${osCryptJson}}`;
}

function directories(text: string): string[] {
  return parseLocalState(text).profiles.map((profile) => profile.directory);
}

describe('parseLocalState', () => {
  it('lists the profiles with their display names', () => {
    const text = localState(
      '{"info_cache":{"Default":{"name":"Person 1"},"Profile 2":{"name":"Work"}}}',
    );
    expect(parseLocalState(text).profiles).toEqual([
      { directory: 'Default', displayName: 'Person 1' },
      { directory: 'Profile 2', displayName: 'Work' },
    ]);
  });

  it('follows profiles_order and appends the unlisted ones, Default first', () => {
    const cache =
      '"info_cache":{"Profile 3":{"name":"C"},"Default":{"name":"A"},"Profile 2":{"name":"B"}}';
    expect(
      directories(
        localState(`{${cache},"profiles_order":["Profile 2","Profile 3"]}`),
      ),
    ).toEqual(['Profile 2', 'Profile 3', 'Default']);
    expect(directories(localState(`{${cache}}`))).toEqual([
      'Default',
      'Profile 3',
      'Profile 2',
    ]);
  });

  it('ignores order entries that are unknown, repeated or not text', () => {
    const text = localState(
      '{"info_cache":{"Default":{"name":"A"}},"profiles_order":["Profile 9","Default","Default",7]}',
    );
    expect(directories(text)).toEqual(['Default']);
  });

  it('drops hostile directory names', () => {
    const text = localState(
      '{"info_cache":{"../../etc":{"name":"x"},"C:\\\\x":{"name":"x"},"Guest Profile":{"name":"g"},"Default":{"name":"ok"}}}',
    );
    expect(parseLocalState(text).profiles).toEqual([
      { directory: 'Default', displayName: 'ok' },
    ]);
  });

  it('falls back to the directory name when the display name is not text', () => {
    const text = localState(
      '{"info_cache":{"Default":{"name":5},"Profile 1":{}}}',
    );
    expect(parseLocalState(text).profiles.map((p) => p.displayName)).toEqual([
      'Default',
      'Profile 1',
    ]);
  });

  it('returns no profiles when info_cache is missing', () => {
    expect(directories(localState('{}'))).toEqual([]);
    expect(directories('{}')).toEqual([]);
    expect(directories(localState('{"info_cache":[]}'))).toEqual([]);
  });

  it('flags app-bound encryption only when the app-bound key exists', () => {
    const flag = (osCrypt: string): boolean =>
      parseLocalState(localState('{}', osCrypt)).hasAppBoundEncryption;
    expect(flag('{"app_bound_encrypted_key":"abc"}')).toBe(true);
    expect(flag('{"encrypted_key":"abc"}')).toBe(false);
    expect(parseLocalState('{}').hasAppBoundEncryption).toBe(false);
  });

  it('describes why an unreadable Local State was rejected', () => {
    expect(() => parseLocalState('not json')).toThrow(/not valid JSON/);
    expect(() => parseLocalState('[1]')).toThrow(/not a JSON object/);
    expect(() => parseLocalState('null')).toThrow(/not a JSON object/);
  });
});
