import type {
  BrowserChoice,
  BrowserId,
} from '../../shared/domain/browser-choice.ts';
import { sanitize } from '../../shared/domain/terminal-text.ts';

const BROWSER_LABELS: Readonly<Record<BrowserId, string>> = {
  brave: 'Brave',
  chrome: 'Chrome',
  edge: 'Edge',
  chromium: 'Chromium',
  vivaldi: 'Vivaldi',
  opera: 'Opera',
  bundled: 'Chromium (bundled)',
};

const UNKNOWN_BROWSER = 'unknown browser';

function labelOf(browserId: string): string {
  return Object.hasOwn(BROWSER_LABELS, browserId)
    ? BROWSER_LABELS[browserId as BrowserId]
    : UNKNOWN_BROWSER;
}

function modeText(choice: BrowserChoice): string {
  if (choice.profileMode !== 'copy-of-real') return choice.profileMode;
  return choice.sourceProfile === null
    ? 'copy of the real profile'
    : `copy of ${sanitize(choice.sourceProfile)}`;
}

/** `Brave · managed`: what a recording or replay runs on, for one line. */
export function describeBrowser(choice: BrowserChoice): string {
  return `${labelOf(choice.browserId)} · ${modeText(choice)}`;
}
