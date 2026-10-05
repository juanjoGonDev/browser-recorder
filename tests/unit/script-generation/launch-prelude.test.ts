import { describe, expect, it } from 'vitest';

import { launchPrelude } from '../../../src/script-generation/domain/launch-prelude.ts';

const REMOVAL_CALL = /rmSync\(\w+, \{(?<options>[^}]*)\}\)/gu;
const ANY_REMOVAL = /rmSync\(/gu;

function removalCalls(): string[] {
  return [...launchPrelude.matchAll(REMOVAL_CALL)].map((match) =>
    (match.groups?.options ?? '').replaceAll(/\s+/gu, ' ').trim(),
  );
}

describe('launchPrelude', () => {
  it('retries every removal of the temporary profile the way the app does', () => {
    const calls = removalCalls();
    expect(calls).not.toHaveLength(0);
    expect(calls).toHaveLength([...launchPrelude.matchAll(ANY_REMOVAL)].length);
    for (const options of calls) {
      expect(options).toBe(
        'recursive: true, force: true, maxRetries: REMOVE_RETRIES, retryDelay: REMOVE_RETRY_DELAY_MS,',
      );
    }
  });

  it('waits as long as the app before giving up on a busy profile', () => {
    expect(launchPrelude).toContain('const REMOVE_RETRIES = 10;');
    expect(launchPrelude).toContain('const REMOVE_RETRY_DELAY_MS = 100;');
  });
});
