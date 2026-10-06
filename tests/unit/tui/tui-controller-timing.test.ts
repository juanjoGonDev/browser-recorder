import { describe, expect, it } from 'vitest';

import {
  RECORDED_TIMING,
  humanTiming,
} from '../../../src/shared/domain/replay-timing.ts';
import { createAppStore } from '../../../src/tui/application/app-store.ts';
import { createTuiController } from '../../../src/tui/application/tui-controller.ts';
import { createFakeClock, createFakeTimers } from '../../support/fake-clock.ts';
import { createFakeServices } from '../../support/fake-app-services.ts';
import { char, named } from '../../support/keys.ts';
import { validEntry } from '../../support/tui-fixtures.ts';

async function openLibrary() {
  const fake = createFakeServices();
  fake.entries = [validEntry('alpha', 'Alpha')];
  const store = createAppStore();
  const controller = createTuiController({
    services: fake.services,
    store,
    timers: createFakeTimers(createFakeClock(1000)),
  });
  await controller.start();
  const press = async (...keys: Parameters<typeof named>[0][]) => {
    for (const key of keys) await controller.handleKey(named(key));
  };
  await press('down', 'return');
  return { fake, store, controller, press };
}

describe('src/tui/application/tui-controller.ts replay timing', () => {
  it('replays with recorded timing unless the toggle was pressed', async () => {
    const harness = await openLibrary();
    await harness.press('return');
    expect(harness.fake.replayTimings).toEqual([RECORDED_TIMING]);
    expect(harness.store.getState().screen).toMatchObject({
      kind: 'replay',
      timing: RECORDED_TIMING,
    });
  });

  it('replays with human timing after pressing h, and shows it', async () => {
    const harness = await openLibrary();
    await harness.controller.handleKey(char('h'));
    expect(harness.store.getState().screen).toMatchObject({
      kind: 'library',
      timing: humanTiming(),
    });
    await harness.press('return');
    expect(harness.fake.replayTimings).toEqual([humanTiming()]);
    expect(harness.store.getState().screen).toMatchObject({
      kind: 'replay',
      timing: humanTiming(),
    });
  });

  it('goes back to recorded timing for the next replay', async () => {
    const harness = await openLibrary();
    await harness.controller.handleKey(char('h'));
    await harness.press('return');
    harness.fake.replay.emit({
      status: 'failed',
      errorMessage: 'x',
      warnings: [],
      steps: [],
    });
    await harness.press('escape');
    expect(harness.store.getState().screen).toMatchObject({
      kind: 'library',
      timing: RECORDED_TIMING,
    });
    await harness.press('return');
    expect(harness.fake.replayTimings).toEqual([
      humanTiming(),
      RECORDED_TIMING,
    ]);
  });
});
