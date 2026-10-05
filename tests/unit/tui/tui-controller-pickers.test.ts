import { describe, expect, it } from 'vitest';

import { createAppStore } from '../../../src/tui/application/app-store.ts';
import { createTuiController } from '../../../src/tui/application/tui-controller.ts';
import type { NewRecordingScreen } from '../../../src/tui/domain/app-state.ts';
import type { BrowserOptionView } from '../../../src/tui/domain/app-views.ts';
import { createFakeClock, createFakeTimers } from '../../support/fake-clock.ts';
import { createFakeServices } from '../../support/fake-app-services.ts';
import { char, named } from '../../support/keys.ts';
import { BROWSER_VIEWS } from '../../support/tui-fixtures.ts';

function chromeProfile(
  label: string,
  sourceProfile: string | null,
): BrowserOptionView['profiles'][number] {
  return {
    choice: {
      browserId: 'chrome',
      profileMode: sourceProfile === null ? 'managed' : 'copy-of-real',
      sourceProfile,
    },
    label,
    note: null,
  };
}

const CHROME_VIEW: BrowserOptionView = {
  browserId: 'chrome',
  label: 'Chrome',
  profiles: [
    chromeProfile('Managed (keeps logins)', null),
    chromeProfile('Copy of Person 1 (Default)', 'Default'),
    chromeProfile('Copy of Work (Profile 1)', 'Profile 1'),
    chromeProfile('Copy of Shop (Profile 2)', 'Profile 2'),
  ],
};

async function openFormOn(browsers: readonly BrowserOptionView[]) {
  const fake = createFakeServices();
  fake.browsers = browsers;
  const store = createAppStore();
  const controller = createTuiController({
    services: fake.services,
    store,
    timers: createFakeTimers(createFakeClock(1000)),
  });
  await controller.start();
  await controller.handleKey(named('return'));
  const press = async (...keys: Parameters<typeof named>[0][]) => {
    for (const key of keys) await controller.handleKey(named(key));
  };
  const focus = () => (store.getState().screen as NewRecordingScreen).focus;
  for (const character of 'Demo') await controller.handleKey(char(character));
  return { fake, press, focus };
}

describe('src/tui/application/tui-controller.ts pickers', () => {
  it('starts on Chrome with the copy of Profile 2 after cycling both pickers', async () => {
    const { fake, press, focus } = await openFormOn([
      BROWSER_VIEWS[0],
      CHROME_VIEW,
      BROWSER_VIEWS[1],
    ]);
    await press('tab', 'tab');
    expect(focus()).toBe('browser');
    await press('right', 'tab');
    expect(focus()).toBe('profile');
    await press('right', 'right', 'right', 'return');
    expect(fake.startRequests).toEqual([
      {
        name: 'Demo',
        startUrl: null,
        browser: {
          browserId: 'chrome',
          profileMode: 'copy-of-real',
          sourceProfile: 'Profile 2',
        },
      },
    ]);
  });

  it('starts on the managed profile of Chrome when the profile is left alone', async () => {
    const { fake, press } = await openFormOn([CHROME_VIEW, BROWSER_VIEWS[1]]);
    await press('return');
    expect(fake.startRequests[0]?.browser).toEqual({
      browserId: 'chrome',
      profileMode: 'managed',
      sourceProfile: null,
    });
  });
});
