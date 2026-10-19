import { describe, expect, it } from 'vitest';

import {
  chosenBrowser,
  loadBrowserOptions,
} from '../../../src/tui/application/browser-options.ts';
import { createAppStore } from '../../../src/tui/application/app-store.ts';
import { createFakeClock, createFakeTimers } from '../../support/fake-clock.ts';
import { createFakeServices } from '../../support/fake-app-services.ts';
import { BRAVE_CHOICE } from '../../support/browser-fixtures.ts';
import { BROWSER_VIEWS } from '../../support/tui-fixtures.ts';

function deps() {
  const fake = createFakeServices();
  const store = createAppStore();
  const timers = createFakeTimers(createFakeClock(0));
  return { fake, store, deps: { services: fake.services, store, timers } };
}

describe('src/tui/application/browser-options.ts', () => {
  describe('loadBrowserOptions', () => {
    it('lists every detected browser while the bundled one is installed', async () => {
      const { deps: controllerDeps } = deps();
      const options = await loadBrowserOptions(controllerDeps);
      expect(options.map((view) => view.browserId)).toEqual([
        'brave',
        'bundled',
      ]);
    });

    it('drops the bundled browser after a failed install', async () => {
      const { deps: controllerDeps, store } = deps();
      store.dispatch({
        type: 'setup-failed',
        manualCommand: 'cmd',
        exitCode: 1,
        browsers: ['Brave'],
      });
      const options = await loadBrowserOptions(controllerDeps);
      expect(options.map((view) => view.browserId)).toEqual(['brave']);
    });

    it('lets a detection failure reject', async () => {
      const { deps: controllerDeps, fake } = deps();
      fake.browsersError = new Error('no detection');
      await expect(loadBrowserOptions(controllerDeps)).rejects.toThrow(
        'no detection',
      );
    });
  });

  describe('chosenBrowser', () => {
    const picker = {
      browsers: BROWSER_VIEWS,
      browserIndex: 0,
      profileIndex: 0,
    };

    it('returns the picked choice', () => {
      expect(chosenBrowser(picker)).toEqual(BRAVE_CHOICE);
    });

    it('explains why nothing can be picked yet', () => {
      expect(chosenBrowser({ ...picker, browsers: null })).toBe(
        'Detecting browsers…',
      );
      expect(chosenBrowser({ ...picker, browsers: [] })).toBe(
        'No browser is available to record with.',
      );
    });
  });
});
