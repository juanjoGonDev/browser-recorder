import {
  BROWSER_IDS,
  type BrowserChoice,
  type BrowserId,
  type ProfileMode,
} from '../../shared/domain/browser-choice.ts';

/** Which browser a replay uses: the recorded one, or the bundled fallback. */
export type ReplayBrowser =
  | { readonly kind: 'as-recorded'; readonly choice: BrowserChoice }
  | {
      readonly kind: 'fallback';
      readonly choice: BrowserChoice;
      readonly missing: BrowserId;
    };

function isCatalogued(id: BrowserId): boolean {
  return BROWSER_IDS.includes(id);
}

/** The real profile of a missing browser has no copy to take: use a blank one. */
function fallbackMode(mode: ProfileMode): ProfileMode {
  return mode === 'copy-of-real' ? 'ephemeral' : mode;
}

/**
 * A replay never fails because its browser is gone: it runs on the bundled
 * Chromium and the caller warns. A managed profile stays managed (the bundled
 * browser keeps its own), a copy of a real profile becomes ephemeral.
 */
export function resolveReplayBrowser(
  recorded: BrowserChoice,
  isAvailable: (id: BrowserId) => boolean,
): ReplayBrowser {
  const { browserId } = recorded;
  if (browserId === 'bundled') return { kind: 'as-recorded', choice: recorded };
  if (isCatalogued(browserId) && isAvailable(browserId)) {
    return { kind: 'as-recorded', choice: recorded };
  }
  return {
    kind: 'fallback',
    choice: {
      browserId: 'bundled',
      profileMode: fallbackMode(recorded.profileMode),
      sourceProfile: null,
    },
    missing: browserId,
  };
}
