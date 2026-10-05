import { execFileSync } from 'node:child_process';
import { chromium } from 'patchright';
import { describe, expect, it, vi } from 'vitest';
import { startPatchrightSession } from '../../../src/recording-capture/adapters/patchright-browser-session.ts';
import { createPerformanceClock } from '../../../src/recording-capture/adapters/performance-clock.ts';
import type { SessionSignal } from '../../../src/recording-capture/application/ports/browser-launcher.ts';
import { IN_PAGE_BUNDLE_PATH } from '../../support/build-in-page-bundle.ts';
import { startFixtureServer } from '../../support/fixture-server.ts';
import { launchPersistent } from '../../support/persistent-context.ts';

// Task 2.12. Design assumption under test: "headed Chromium with a
// page.on('dialog') listener does not show the native dialog".
//
// FINDING (macOS, Chromium for Testing from Playwright 1.63): the assumption
// is FALSE. The listener receives the dialog and answering it through
// Playwright works exactly as in headless mode, but the browser ALSO shows
// its own native dialog (the process owns a second on-screen window while the
// dialog is pending; CDP reports `hasBrowserHandler: true`). Documented
// behaviour kept by the adapter: the recorder's prompt is the preferred way to
// answer. An answer given in the native dialog is reported by the browser
// (`Page.javascriptDialogClosed`) and recorded through a `dialog-closed`
// signal; the stale dialog is dropped (dialog-registry) instead of blocking
// the page.

// Headed runs open real windows on the developer's desktop, so they are
// opt-in only; the default run exercises the headless fallback.
const isHeadedOptIn = process.env.BROWSER_RECORDER_HEADED_TESTS === '1';

async function canLaunchHeaded(): Promise<boolean> {
  if (!isHeadedOptIn) return false;
  try {
    const browser = await chromium.launch({ headless: !isHeadedOptIn });
    await browser.close();
    return true;
  } catch {
    return false;
  }
}

// Named once so knip does not take it for a package binary.
const OSASCRIPT = 'osascript';
const WINDOWS_SCRIPT = `ObjC.import('CoreGraphics');
const raw = $.CGWindowListCopyWindowInfo($.kCGWindowListOptionOnScreenOnly, 0);
const list = ObjC.deepUnwrap(ObjC.castRefToObject(raw));
JSON.stringify(list.filter((w) => /Chrom/i.test(w.kCGWindowOwnerName)).length);`;

function chromiumWindowCount(): number {
  const out = execFileSync(OSASCRIPT, [
    '-l',
    'JavaScript',
    '-e',
    WINDOWS_SCRIPT,
  ]);
  return Number(out.toString().trim());
}

const WAIT = { timeout: 8000, interval: 50 };
const waitFor = (check: () => void): Promise<void> =>
  vi.waitFor(check, WAIT).then(() => undefined);

const isHeadedAvailable = await canLaunchHeaded();
const canCountWindows = isHeadedAvailable && process.platform === 'darwin';

async function openPromptPage() {
  const server = await startFixtureServer();
  const { context, dispose } = await launchPersistent({
    isHeadless: !isHeadedAvailable,
  });
  const session = await startPatchrightSession({
    context,
    clock: createPerformanceClock(),
    inPageScriptPath: IN_PAGE_BUNDLE_PATH,
    startUrl: server.urlFor('prompt-hash.html'),
  });
  const signals: SessionSignal[] = [];
  session.onSignal((signal) => signals.push(signal));
  const [page] = context.pages();
  const finish = async (): Promise<void> => {
    await session.close();
    await dispose();
    await server.close();
  };
  return { session, signals, page, finish };
}

describe('headed dialog assumption (task 2.12)', () => {
  it.skipIf(!isHeadedAvailable)(
    'delivers the dialog to the recorder and passes its answer to the page',
    async () => {
      const { session, signals, page, finish } = await openPromptPage();
      void page.locator('#ask').click();
      await waitFor(() => {
        if (!signals.some(({ kind }) => kind === 'dialog-opened')) {
          throw new Error('no dialog yet');
        }
      });
      await session.respondToDialog({ action: 'accept', promptText: 'abc' });
      await waitFor(() => {
        expect(page.url()).toMatch(/#name-abc$/);
      });
      await finish();
    },
  );

  it.skipIf(!canCountWindows)(
    'shows the native dialog as well: the design assumption does not hold',
    async () => {
      const { session, signals, page, finish } = await openPromptPage();
      const before = chromiumWindowCount();
      void page.locator('#ask').click();
      await waitFor(() => {
        if (!signals.some(({ kind }) => kind === 'dialog-opened')) {
          throw new Error('no dialog yet');
        }
      });
      await waitFor(() => {
        expect(chromiumWindowCount()).toBeGreaterThan(before);
      });
      await session.respondToDialog({ action: 'dismiss', promptText: null });
      await waitFor(() => {
        expect(chromiumWindowCount()).toBe(before);
      });
      await finish();
    },
  );

  it('answers the dialog the same way headless, the documented fallback', async () => {
    const server = await startFixtureServer();
    const { context, dispose } = await launchPersistent();
    const session = await startPatchrightSession({
      context,
      clock: createPerformanceClock(),
      inPageScriptPath: IN_PAGE_BUNDLE_PATH,
      startUrl: server.urlFor('prompt-hash.html'),
    });
    const signals: SessionSignal[] = [];
    session.onSignal((signal) => signals.push(signal));
    const [page] = context.pages();
    void page.locator('#ask').click();
    await waitFor(() => {
      if (!signals.some(({ kind }) => kind === 'dialog-opened')) {
        throw new Error('no dialog yet');
      }
    });
    await session.respondToDialog({ action: 'accept', promptText: 'xyz' });
    await waitFor(() => {
      expect(page.url()).toMatch(/#name-xyz$/);
    });
    await session.close();
    await dispose();
    await server.close();
  });
});
