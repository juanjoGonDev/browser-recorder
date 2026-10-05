import { describe, expect, it } from 'vitest';

import { resolveReplayBrowser } from '../../../src/browser-selection/domain/resolve-replay-browser.ts';
import type {
  BrowserChoice,
  BrowserId,
} from '../../../src/shared/domain/browser-choice.ts';

function choice(
  browserId: BrowserId,
  profileMode: BrowserChoice['profileMode'],
  sourceProfile: string | null = null,
): BrowserChoice {
  return { browserId, profileMode, sourceProfile };
}

const nothingInstalled = () => false;
const onlyBrave = (id: BrowserId) => id === 'brave';

describe('resolveReplayBrowser', () => {
  it('keeps the recorded choice when the browser is installed', () => {
    const recorded = choice('brave', 'managed');
    expect(resolveReplayBrowser(recorded, onlyBrave)).toEqual({
      kind: 'as-recorded',
      choice: recorded,
    });
  });

  it('falls back to bundled and names the missing browser', () => {
    const result = resolveReplayBrowser(
      choice('brave', 'ephemeral'),
      nothingInstalled,
    );
    expect(result).toEqual({
      kind: 'fallback',
      choice: choice('bundled', 'ephemeral'),
      missing: 'brave',
    });
  });

  it('keeps a managed profile managed on the bundled browser', () => {
    const result = resolveReplayBrowser(choice('chrome', 'managed'), onlyBrave);
    expect(result.choice).toEqual(choice('bundled', 'managed'));
    expect(result.kind).toBe('fallback');
  });

  it('turns a copy of a real profile into an ephemeral one', () => {
    const result = resolveReplayBrowser(
      choice('brave', 'copy-of-real', 'Profile 2'),
      nothingInstalled,
    );
    expect(result.choice).toEqual(choice('bundled', 'ephemeral'));
  });

  it('never reports the bundled browser as missing', () => {
    const recorded = choice('bundled', 'managed');
    expect(resolveReplayBrowser(recorded, nothingInstalled)).toEqual({
      kind: 'as-recorded',
      choice: recorded,
    });
  });

  it('treats an id outside the catalogue as missing, even if reported available', () => {
    const unknown = choice('netscape' as BrowserId, 'managed');
    const result = resolveReplayBrowser(unknown, () => true);
    expect(result).toEqual({
      kind: 'fallback',
      choice: choice('bundled', 'managed'),
      missing: 'netscape',
    });
  });
});
