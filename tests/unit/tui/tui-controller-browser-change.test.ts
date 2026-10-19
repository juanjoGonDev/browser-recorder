import { describe, expect, it } from 'vitest';

import { createAppStore } from '../../../src/tui/application/app-store.ts';
import { createTuiController } from '../../../src/tui/application/tui-controller.ts';
import type { LibraryScreen } from '../../../src/tui/domain/app-state.ts';
import type { BrowserOptionView } from '../../../src/tui/domain/app-views.ts';
import type { KeyPress } from '../../../src/tui/application/ports/terminal.ts';
import { createFakeServices } from '../../support/fake-app-services.ts';
import { createFakeClock, createFakeTimers } from '../../support/fake-clock.ts';
import { char, named } from '../../support/keys.ts';
import {
  BRAVE_CHOICE,
  BUNDLED_CHOICE,
} from '../../support/browser-fixtures.ts';
import { BROWSER_VIEWS, validEntry } from '../../support/tui-fixtures.ts';

const CHROME_CHOICE = {
  browserId: 'chrome',
  profileMode: 'managed',
  sourceProfile: null,
} as const;
const CHROME_VIEW: BrowserOptionView = {
  browserId: 'chrome',
  label: 'Chrome',
  profiles: [
    { choice: CHROME_CHOICE, label: 'Managed (keeps logins)', note: null },
  ],
};

function setup() {
  const fake = createFakeServices();
  const store = createAppStore();
  const controller = createTuiController({
    services: fake.services,
    store,
    timers: createFakeTimers(createFakeClock(1000)),
  });
  async function press(...keys: KeyPress[]): Promise<void> {
    for (const key of keys) await controller.handleKey(key);
  }
  return { fake, store, controller, press };
}

type Harness = ReturnType<typeof setup>;

/** Lets the detection that `b` starts in the background finish. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function openLibrary(harness: Harness): Promise<void> {
  await harness.controller.start();
  await harness.press(named('down'), named('return'));
}

function library(harness: Harness): LibraryScreen {
  const { screen } = harness.store.getState();
  if (screen.kind !== 'library') throw new Error('not the library');
  return screen;
}

describe('src/tui/application/library-flow.ts browser change', () => {
  it('opens on the current choice and detects the browsers', async () => {
    const harness = setup();
    harness.fake.entries = [
      validEntry('alpha', 'Alpha', { browser: BRAVE_CHOICE }),
    ];
    await openLibrary(harness);
    await harness.press(char('b'));
    await settle();
    expect(library(harness).mode).toMatchObject({
      kind: 'change-browser',
      slug: 'alpha',
      browsers: BROWSER_VIEWS,
      browserIndex: 0,
      profileIndex: 0,
    });
  });

  it('saves a changed choice, closes the mode and shows the new browser', async () => {
    const harness = setup();
    harness.fake.browsers = [CHROME_VIEW, ...BROWSER_VIEWS];
    harness.fake.entries = [
      validEntry('alpha', 'Alpha', { browser: CHROME_CHOICE }),
    ];
    await openLibrary(harness);
    const before = harness.fake.listCount;
    await harness.press(char('b'));
    await settle();
    await harness.press(named('right'), named('return'));
    expect(harness.fake.changedBrowsers).toEqual([
      { slug: 'alpha', choice: BRAVE_CHOICE },
    ]);
    const screen = library(harness);
    expect(screen.mode).toEqual({ kind: 'browse' });
    expect(screen.entries[0]).toMatchObject({ browser: BRAVE_CHOICE });
    expect(harness.fake.listCount).toBe(before + 1);
  });

  it('saves a profile change made in the profile field', async () => {
    const harness = setup();
    harness.fake.entries = [
      validEntry('alpha', 'Alpha', { browser: BRAVE_CHOICE }),
    ];
    await openLibrary(harness);
    await harness.press(char('b'));
    await settle();
    await harness.press(named('tab'), named('right'), named('return'));
    expect(harness.fake.changedBrowsers).toEqual([
      {
        slug: 'alpha',
        choice: {
          browserId: 'brave',
          profileMode: 'copy-of-real',
          sourceProfile: 'Default',
        },
      },
    ]);
  });

  it('only closes when the choice did not change', async () => {
    const harness = setup();
    harness.fake.entries = [
      validEntry('alpha', 'Alpha', { browser: BUNDLED_CHOICE }),
    ];
    await openLibrary(harness);
    const before = harness.fake.listCount;
    await harness.press(char('b'));
    await settle();
    await harness.press(named('return'));
    expect(harness.fake.changedBrowsers).toEqual([]);
    expect(library(harness).mode).toEqual({ kind: 'browse' });
    expect(harness.fake.listCount).toBe(before);
  });

  it('keeps the mode and shows the error when saving fails', async () => {
    const harness = setup();
    harness.fake.changeBrowserError = new Error('disk full');
    harness.fake.entries = [
      validEntry('alpha', 'Alpha', { browser: BRAVE_CHOICE }),
    ];
    await openLibrary(harness);
    await harness.press(char('b'));
    await settle();
    await harness.press(named('right'), named('return'));
    expect(library(harness)).toMatchObject({
      error: 'disk full',
      mode: { kind: 'change-browser', slug: 'alpha' },
    });
    expect(harness.fake.changedBrowsers).toEqual([]);
  });

  it('writes nothing on Esc', async () => {
    const harness = setup();
    harness.fake.entries = [
      validEntry('alpha', 'Alpha', { browser: BRAVE_CHOICE }),
    ];
    await openLibrary(harness);
    await harness.press(char('b'));
    await settle();
    await harness.press(named('right'), named('escape'));
    expect(harness.fake.changedBrowsers).toEqual([]);
    expect(library(harness).mode).toEqual({ kind: 'browse' });
    expect(library(harness).entries[0]).toMatchObject({
      browser: BRAVE_CHOICE,
    });
  });

  it('preselects the first option when the current browser is not detected', async () => {
    const harness = setup();
    const opera = {
      browserId: 'opera',
      profileMode: 'managed',
      sourceProfile: null,
    } as const;
    harness.fake.entries = [validEntry('alpha', 'Alpha', { browser: opera })];
    await openLibrary(harness);
    await harness.press(char('b'));
    await settle();
    expect(library(harness).mode).toMatchObject({
      browserIndex: 0,
      profileIndex: 0,
    });
    await harness.press(named('return'));
    expect(harness.fake.changedBrowsers).toEqual([
      { slug: 'alpha', choice: BRAVE_CHOICE },
    ]);
  });

  it('refuses to save while the browsers are still being detected', async () => {
    const harness = setup();
    let release: () => void = () => undefined;
    harness.fake.browsersGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    harness.fake.entries = [
      validEntry('alpha', 'Alpha', { browser: BRAVE_CHOICE }),
    ];
    await openLibrary(harness);
    await harness.press(char('b'), named('return'));
    expect(library(harness)).toMatchObject({
      error: 'Detecting browsers…',
      mode: { kind: 'change-browser', browsers: null },
    });
    expect(harness.fake.changedBrowsers).toEqual([]);
    release();
    await settle();
    expect(library(harness).mode).toMatchObject({ browsers: BROWSER_VIEWS });
  });

  it('explains a failed detection and stays cancellable', async () => {
    const harness = setup();
    harness.fake.browsersError = new Error('no detection');
    harness.fake.entries = [
      validEntry('alpha', 'Alpha', { browser: BRAVE_CHOICE }),
    ];
    await openLibrary(harness);
    await harness.press(char('b'));
    await settle();
    expect(library(harness)).toMatchObject({
      error: 'no detection',
      mode: { kind: 'change-browser', browsers: [] },
    });
    await harness.press(named('return'));
    expect(harness.fake.changedBrowsers).toEqual([]);
    await harness.press(named('escape'));
    expect(library(harness).mode).toEqual({ kind: 'browse' });
  });

  it('does nothing with b on an empty library', async () => {
    const harness = setup();
    await openLibrary(harness);
    await harness.press(char('b'));
    expect(library(harness).mode).toEqual({ kind: 'browse' });
  });
});
