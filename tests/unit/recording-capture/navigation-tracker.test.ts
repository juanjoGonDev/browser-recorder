import { describe, expect, it, vi } from 'vitest';
import { trackNavigation } from '../../../src/recording-capture/adapters/navigation-tracker.ts';
import type { NavigationReport } from '../../../src/recording-capture/adapters/navigation-tracker.ts';
import { FakeCdp } from '../../support/fake-cdp.ts';

const HISTORY = 'Page.getNavigationHistory';
// What Chromium answers while the committed document is not the active one yet.
const NOT_ACTIVE =
  'Protocol error (Page.getNavigationHistory): Not attached to an active page';

async function track(cdp: FakeCdp): Promise<NavigationReport[]> {
  const reports: NavigationReport[] = [];
  await trackNavigation(cdp.asSession(), {
    now: () => 0,
    sleep: () => Promise.resolve(),
    onNavigation: (report) => reports.push(report),
  });
  return reports;
}

function commit(cdp: FakeCdp, url: string): void {
  cdp.emit('Page.frameNavigated', { frame: { id: 'main', url } });
}

/** Answers each history read with the next outcome, the last one forever. */
function answerHistory(cdp: FakeCdp, outcomes: readonly (number | Error)[]) {
  let call = 0;
  cdp.handlers.set(HISTORY, () => {
    const outcome = outcomes[Math.min(call, outcomes.length - 1)];
    call += 1;
    if (outcome instanceof Error) throw outcome;
    return { currentIndex: outcome, entries: [] };
  });
}

describe('src/recording-capture/adapters/navigation-tracker.ts', () => {
  describe('history index', () => {
    it('reads the index again when the committed page is not active yet', async () => {
      const cdp = new FakeCdp();
      answerHistory(cdp, [new Error(NOT_ACTIVE), 3]);
      const reports = await track(cdp);

      commit(cdp, 'http://site.test/a');

      await vi.waitFor(() => {
        expect(reports).toHaveLength(1);
      });
      expect(reports[0]?.entryIndex).toBe(3);
    });

    it('keeps retrying through several inactive answers', async () => {
      const cdp = new FakeCdp();
      const notActive = new Error(NOT_ACTIVE);
      answerHistory(cdp, [notActive, notActive, notActive, 5]);
      const reports = await track(cdp);

      commit(cdp, 'http://site.test/b');

      await vi.waitFor(() => {
        expect(reports).toHaveLength(1);
      });
      expect(reports[0]?.entryIndex).toBe(5);
      expect(cdp.callsTo(HISTORY)).toHaveLength(4);
    });

    it('reports an unknown index after a bounded number of failed reads', async () => {
      const cdp = new FakeCdp();
      answerHistory(cdp, [new Error(NOT_ACTIVE)]);
      const reports = await track(cdp);

      commit(cdp, 'http://site.test/c');

      await vi.waitFor(() => {
        expect(reports).toHaveLength(1);
      });
      expect(reports[0]?.entryIndex).toBeNull();
      expect(cdp.callsTo(HISTORY).length).toBeGreaterThan(1);
      expect(cdp.callsTo(HISTORY).length).toBeLessThan(100);
    });

    it('reports navigations in commit order even when an earlier read is retried', async () => {
      const cdp = new FakeCdp();
      answerHistory(cdp, [new Error(NOT_ACTIVE), 1, 2]);
      const reports = await track(cdp);

      commit(cdp, 'http://site.test/first');
      commit(cdp, 'http://site.test/second');

      await vi.waitFor(() => {
        expect(reports).toHaveLength(2);
      });
      expect(reports.map(({ url }) => url)).toStrictEqual([
        'http://site.test/first',
        'http://site.test/second',
      ]);
    });
  });
});
