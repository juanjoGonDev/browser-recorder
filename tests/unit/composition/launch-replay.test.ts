import { describe, expect, it, vi } from 'vitest';

import type { LaunchPlan } from '../../../src/composition/browser-launch-plan.ts';
import {
  launchReplay,
  type ReplayLaunchDeps,
} from '../../../src/composition/launch-replay.ts';
import {
  RECORDED_TIMING,
  humanTiming,
} from '../../../src/shared/domain/replay-timing.ts';
import {
  BRAVE_CHOICE,
  BRAVE_TARGET,
  BUNDLED_CHOICE,
  BUNDLED_TARGET,
} from '../../support/browser-fixtures.ts';
import { createFakeSpawner } from '../../support/composition-fakes.ts';
import { recordingOf } from '../../support/golden-recordings.ts';

const RECORDING = recordingOf(
  [
    { kind: 'goto', offsetMs: 0, pageId: 'page1', url: 'https://example.com/' },
    { kind: 'reload', offsetMs: 700, pageId: 'page1' },
  ],
  { slug: 'demo', browser: BRAVE_CHOICE },
);

function setup(
  overrides: {
    plan?: Partial<LaunchPlan>;
    isInstalled?: boolean;
    planFailure?: Error;
    parentEnv?: Record<string, string>;
  } = {},
) {
  const spawner = createFakeSpawner();
  const release = vi.fn(() => Promise.resolve());
  const plan: LaunchPlan = {
    choice: BRAVE_CHOICE,
    target: BRAVE_TARGET,
    warnings: [],
    release,
    ...overrides.plan,
  };
  const deps: ReplayLaunchDeps = {
    library: { regenerateScript: () => Promise.resolve(RECORDING) },
    planner: {
      forReplay: () =>
        overrides.planFailure
          ? Promise.reject(overrides.planFailure)
          : Promise.resolve(plan),
    },
    installation: {
      isInstalled: () => Promise.resolve(overrides.isInstalled ?? true),
    },
    replay: {
      spawner,
      nodePath: '/usr/bin/node',
      cancelGraceMs: 3000,
      cwd: '/pkg',
      scriptPathOf: (slug) => `/library/${slug}/script.mjs`,
      parentEnv: overrides.parentEnv ?? {},
    },
  };
  return { deps, spawner, release };
}

describe('src/composition/launch-replay.ts', () => {
  it('regenerates, plans and spawns the script with the launch environment', async () => {
    const { deps, spawner } = setup();
    const launched = await launchReplay(deps, 'demo', {
      timing: RECORDED_TIMING,
      isHeadless: false,
    });
    expect(launched.recording).toBe(RECORDING);
    expect(spawner.children[0]?.request).toStrictEqual({
      command: '/usr/bin/node',
      args: ['/library/demo/script.mjs'],
      cwd: '/pkg',
      env: {
        BROWSER_RECORDER_EXECUTABLE_PATH: '/fixture/Brave Browser',
        BROWSER_RECORDER_USER_DATA_DIR:
          '/fixture/app-data/profiles/brave/managed',
        BROWSER_RECORDER_BROWSER_ARGS: '[]',
        BROWSER_RECORDER_REAL_KEYCHAIN: '',
        BROWSER_RECORDER_TIMING: 'recorded',
        BROWSER_RECORDER_HUMAN_DELAY: '',
      },
    });
  });

  it('passes human timing, headless and the seed of the parent environment', async () => {
    const { deps, spawner } = setup({
      parentEnv: { BROWSER_RECORDER_SEED: '7' },
    });
    await launchReplay(deps, 'demo', {
      timing: humanTiming({ minMs: 10, maxMs: 20 }),
      isHeadless: true,
    });
    expect(spawner.children[0]?.request.env).toMatchObject({
      BROWSER_RECORDER_TIMING: 'human',
      BROWSER_RECORDER_HUMAN_DELAY: '10-20',
      BROWSER_RECORDER_SEED: '7',
      BROWSER_RECORDER_HEADLESS: '1',
    });
  });

  it('reports no drift in human mode', async () => {
    const { deps, spawner } = setup();
    const launched = await launchReplay(deps, 'demo', {
      timing: humanTiming(),
      isHeadless: false,
    });
    const seen: (number | null)[] = [];
    launched.live.subscribe((progress) => {
      seen.push(progress.steps[1]?.driftMs ?? null);
    });
    spawner.children[0]?.stdout('::step 1 900\n');
    expect(seen).toStrictEqual([null]);
  });

  it('hands back the warnings of the plan', async () => {
    const { deps } = setup({
      plan: {
        warnings: ['Brave is not installed here: replaying on Chromium.'],
      },
    });
    const launched = await launchReplay(deps, 'demo', {
      timing: RECORDED_TIMING,
      isHeadless: false,
    });
    expect(launched.warnings).toStrictEqual([
      'Brave is not installed here: replaying on Chromium.',
    ]);
  });

  it('releases the profile once after the replay finished, and resolves released', async () => {
    const { deps, spawner, release } = setup();
    const launched = await launchReplay(deps, 'demo', {
      timing: RECORDED_TIMING,
      isHeadless: false,
    });
    expect(release).not.toHaveBeenCalled();
    spawner.children[0]?.exit(0);
    await launched.released;
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('never fails because releasing the profile failed', async () => {
    const release = vi.fn(() => Promise.reject(new Error('busy')));
    const { deps, spawner } = setup({ plan: { release } });
    const launched = await launchReplay(deps, 'demo', {
      timing: RECORDED_TIMING,
      isHeadless: false,
    });
    spawner.children[0]?.exit(1);
    await expect(launched.released).resolves.toBeUndefined();
  });

  it('names the manual install command when Chromium is missing and nothing was installed', async () => {
    const { deps, spawner } = setup({
      planFailure: new Error(
        'Chromium (bundled) is not installed on this machine.',
      ),
      isInstalled: false,
    });
    await expect(
      launchReplay(deps, 'demo', {
        timing: RECORDED_TIMING,
        isHeadless: false,
      }),
    ).rejects.toThrow(
      /Chromium \(bundled\) is not installed on this machine\.\n.*pnpm exec patchright install chromium/u,
    );
    expect(spawner.children).toHaveLength(0);
  });

  describe('when the plan targets the bundled Chromium', () => {
    const bundledPlan = { choice: BUNDLED_CHOICE, target: BUNDLED_TARGET };

    it('rejects before spawning, with the manual install command, when it is not installed', async () => {
      const { deps, spawner, release } = setup({
        plan: bundledPlan,
        isInstalled: false,
      });
      await expect(
        launchReplay(deps, 'demo', {
          timing: RECORDED_TIMING,
          isHeadless: false,
        }),
      ).rejects.toThrow(
        /Chromium \(bundled\) is not installed on this machine\.\n.*pnpm exec patchright install chromium/u,
      );
      expect(spawner.children).toHaveLength(0);
      expect(release).toHaveBeenCalledTimes(1);
    });

    it('still releases the plan when the release itself fails', async () => {
      const release = vi.fn(() => Promise.reject(new Error('busy')));
      const { deps } = setup({
        plan: { ...bundledPlan, release },
        isInstalled: false,
      });
      await expect(
        launchReplay(deps, 'demo', {
          timing: RECORDED_TIMING,
          isHeadless: false,
        }),
      ).rejects.toThrow(/pnpm exec patchright install chromium/u);
    });

    it('spawns when it is installed', async () => {
      const { deps, spawner } = setup({ plan: bundledPlan, isInstalled: true });
      await launchReplay(deps, 'demo', {
        timing: RECORDED_TIMING,
        isHeadless: false,
      });
      expect(spawner.children).toHaveLength(1);
    });
  });

  it('does not require the bundled Chromium to replay on an installed browser', async () => {
    const { deps, spawner } = setup({ isInstalled: false });
    await launchReplay(deps, 'demo', {
      timing: RECORDED_TIMING,
      isHeadless: false,
    });
    expect(spawner.children).toHaveLength(1);
  });

  it('rethrows any other launch failure untouched', async () => {
    const { deps } = setup({
      planFailure: new Error('The profile is in use.'),
      isInstalled: true,
    });
    await expect(
      launchReplay(deps, 'demo', {
        timing: RECORDED_TIMING,
        isHeadless: false,
      }),
    ).rejects.toThrow(/^The profile is in use\.$/u);
  });
});
