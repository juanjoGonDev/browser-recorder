import { describe, expect, it } from 'vitest';

import { createLaunchPlanner } from '../../../src/composition/browser-launch-plan.ts';
import { createReplayCommandServices } from '../../../src/composition/create-replay-command-services.ts';
import { createLibraryService } from '../../../src/script-library/application/library-service.ts';
import { generateScript } from '../../../src/script-generation/domain/generate-script.ts';
import {
  RECORDED_TIMING,
  humanTiming,
} from '../../../src/shared/domain/replay-timing.ts';
import {
  BUNDLED_INSTALLED,
  createFakeCatalog,
  createFakeInstallation,
  createFakeProfiles,
  createFakeSpawner,
} from '../../support/composition-fakes.ts';
import { recordingOf } from '../../support/golden-recordings.ts';
import { MemoryRecordingRepository } from '../../support/memory-recording-repository.ts';

const EVENTS = [
  { kind: 'goto', offsetMs: 0, pageId: 'page1', url: 'https://example.com/' },
  { kind: 'reload', offsetMs: 700, pageId: 'page1' },
] as const;

function setup(options: { isInstalled?: boolean } = {}) {
  const repository = new MemoryRecordingRepository();
  repository.files.set('demo', {
    recordingJson: JSON.stringify(
      recordingOf([...EVENTS], { slug: 'demo', name: 'Demo flow' }),
    ),
    scriptMjs: '',
  });
  repository.files.set('broken', {
    recordingJson: '{"nope":1}',
    scriptMjs: '',
  });
  const profiles = createFakeProfiles();
  const spawner = createFakeSpawner();
  const clock = { nowMs: 1000 };
  const services = createReplayCommandServices({
    library: createLibraryService({
      repository,
      renderScript: generateScript,
      now: () => new Date('2026-03-04T05:06:07.000Z'),
    }),
    planner: createLaunchPlanner({
      catalog: createFakeCatalog(
        options.isInstalled === false ? [] : [BUNDLED_INSTALLED],
      ),
      profiles,
    }),
    installation: createFakeInstallation({
      isInstalled: options.isInstalled ?? true,
    }),
    replay: {
      spawner,
      nodePath: '/usr/bin/node',
      cancelGraceMs: 3000,
      cwd: '/app',
      scriptPathOf: (slug) => repository.scriptPath(slug),
      parentEnv: {},
    },
    now: () => clock.nowMs,
  });
  return { services, spawner, profiles, clock, repository };
}

describe('src/composition/create-replay-command-services.ts', () => {
  it('lists readable recordings by slug and name and unreadable ones by slug only', async () => {
    const { services } = setup();
    const choices = await services.listRecordings();
    expect(
      [...choices].sort((a, b) => a.slug.localeCompare(b.slug)),
    ).toStrictEqual([
      { slug: 'broken', name: null },
      { slug: 'demo', name: 'Demo flow' },
    ]);
  });

  it('reads the clock it was given', () => {
    const { services, clock } = setup();
    expect(services.now()).toBe(1000);
    clock.nowMs = 5000;
    expect(services.now()).toBe(5000);
  });

  it('starts the script with the requested timing and exposes the recording to print', async () => {
    const { services, spawner } = setup();
    const run = await services.startReplay('demo', {
      timing: humanTiming({ minMs: 10, maxMs: 20 }),
      isHeadless: true,
    });
    expect(run.name).toBe('Demo flow');
    expect(run.events.map((event) => event.kind)).toStrictEqual([
      'goto',
      'reload',
    ]);
    expect(spawner.children[0]?.request.env).toMatchObject({
      BROWSER_RECORDER_TIMING: 'human',
      BROWSER_RECORDER_HUMAN_DELAY: '10-20',
      BROWSER_RECORDER_HEADLESS: '1',
    });
    expect(spawner.children[0]?.request.args).toStrictEqual([
      '/library/demo/script.mjs',
    ]);
  });

  it('maps the script progress to the view the command prints', async () => {
    const { services, spawner } = setup();
    const run = await services.startReplay('demo', {
      timing: RECORDED_TIMING,
      isHeadless: false,
    });
    const seen: unknown[] = [];
    run.subscribe((view) => seen.push(view));
    spawner.children[0]?.stdout('::step 0 5\n::step 1 760\n');
    spawner.children[0]?.stderr('boom\n');
    spawner.children[0]?.stdout('::error 1 "locator gone"\n');
    spawner.children[0]?.exit(1);
    const final = await run.finished;
    expect(final).toStrictEqual({
      status: 'failed',
      steps: [
        { index: 0, status: 'done', elapsedMs: 5 },
        { index: 1, status: 'running', elapsedMs: 760 },
      ],
      lastStepIndex: 1,
      errorMessage: 'locator gone',
      warnings: [],
      stderrTail: ['boom'],
    });
    expect(seen.at(-1)).toStrictEqual(final);
  });

  it('carries the warnings the script printed into the view', async () => {
    const { services, spawner } = setup();
    const run = await services.startReplay('demo', {
      timing: RECORDED_TIMING,
      isHeadless: false,
    });
    spawner.children[0]?.stdout('::step 0 5\n');
    spawner.children[0]?.stdout('::warn "Stopped waiting for the network"\n');
    spawner.children[0]?.stdout('::done 6000\n');
    spawner.children[0]?.exit(0);
    await expect(run.finished).resolves.toMatchObject({
      status: 'succeeded',
      warnings: ['Stopped waiting for the network'],
    });
  });

  it('settles released once the profile copy was deleted', async () => {
    const { services, spawner, profiles } = setup();
    const run = await services.startReplay('demo', {
      timing: RECORDED_TIMING,
      isHeadless: false,
    });
    expect(profiles.releases()).toBe(0);
    spawner.children[0]?.exit(0);
    await run.released;
    expect(profiles.releases()).toBe(1);
  });

  it('asks the script to abort when cancelled', async () => {
    const { services, spawner } = setup();
    const run = await services.startReplay('demo', {
      timing: RECORDED_TIMING,
      isHeadless: false,
    });
    const cancelled = run.cancel();
    expect(spawner.children[0]?.stdin).toStrictEqual(['abort\n']);
    spawner.children[0]?.exit(130);
    await cancelled;
    expect((await run.finished).status).toBe('cancelled');
  });

  it('names the manual install command when Chromium is missing', async () => {
    const { services, spawner } = setup({ isInstalled: false });
    await expect(
      services.startReplay('demo', {
        timing: RECORDED_TIMING,
        isHeadless: false,
      }),
    ).rejects.toThrow(/pnpm exec patchright install chromium/u);
    expect(spawner.children).toHaveLength(0);
  });

  it.each(['broken', 'missing'])(
    'refuses the unreadable or unknown recording %s without starting anything',
    async (slug) => {
      const { services, spawner } = setup();
      await expect(
        services.startReplay(slug, {
          timing: RECORDED_TIMING,
          isHeadless: false,
        }),
      ).rejects.toThrow();
      expect(spawner.children).toHaveLength(0);
    },
  );
});
