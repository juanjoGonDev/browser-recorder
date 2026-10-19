import { describe, expect, it } from 'vitest';

import { createProfileStore } from '../../../src/browser-profiles/application/profile-store.ts';
import { createProfileLayout } from '../../../src/browser-profiles/domain/profile-layout.ts';
import { tokenizeArgv } from '../../../src/cli/adapters/tokenize-argv.ts';
import { runCli } from '../../../src/cli/application/run-cli.ts';
import { createLaunchPlanner } from '../../../src/composition/browser-launch-plan.ts';
import { createReplayCommandServices } from '../../../src/composition/create-replay-command-services.ts';
import { generateScript } from '../../../src/script-generation/domain/generate-script.ts';
import { createLibraryService } from '../../../src/script-library/application/library-service.ts';
import type { BrowserChoice } from '../../../src/shared/domain/browser-choice.ts';
import { RECORDED_TIMING } from '../../../src/shared/domain/replay-timing.ts';
import {
  BRAVE_INSTALLED,
  BUNDLED_INSTALLED,
  createFakeCatalog,
  createFakeInstallation,
  createFakeSpawner,
} from '../../support/composition-fakes.ts';
import {
  createFakeOutput,
  createFakeSignals,
} from '../../support/cli-fakes.ts';
import { recordingOf } from '../../support/golden-recordings.ts';
import {
  MemoryProfileFileSystem,
  fakeProcesses,
} from '../../support/memory-profile-file-system.ts';
import { MemoryRecordingRepository } from '../../support/memory-recording-repository.ts';

const REAL = BRAVE_INSTALLED.userDataDir ?? '';
const APP_ROOT = '/data/browser-recorder';
const LOCAL_STATE =
  '{"profile":{"info_cache":{"Default":{"name":"Me"},"Profile 2":{"name":"Work"}}}}';
const COPY_OF_REAL: BrowserChoice = {
  browserId: 'brave',
  profileMode: 'copy-of-real',
  sourceProfile: 'Profile 2',
};
const EVENTS = [
  { kind: 'goto', offsetMs: 0, pageId: 'page1', url: 'https://example.com/' },
] as const;

function setup(platform: string, browser: BrowserChoice) {
  const fs = new MemoryProfileFileSystem();
  fs.addFile(`${REAL}/Local State`, LOCAL_STATE);
  fs.addFile(`${REAL}/Profile 2/Preferences`, 'prefs');
  const repository = new MemoryRecordingRepository();
  repository.files.set('demo', {
    recordingJson: JSON.stringify(
      recordingOf([...EVENTS], { slug: 'demo', name: 'Demo', browser }),
    ),
    scriptMjs: '',
  });
  const spawner = createFakeSpawner();
  const profiles = createProfileStore({
    fs,
    platform,
    processes: fakeProcesses('box', []),
    layout: createProfileLayout(platform, APP_ROOT),
    sleep: () => Promise.resolve(),
  });
  const services = createReplayCommandServices({
    library: createLibraryService({
      repository,
      renderScript: generateScript,
      now: () => new Date('2026-03-04T05:06:07.000Z'),
    }),
    planner: createLaunchPlanner({
      catalog: createFakeCatalog([BRAVE_INSTALLED, BUNDLED_INSTALLED]),
      profiles,
      platform,
    }),
    installation: createFakeInstallation({ isInstalled: true }),
    replay: {
      spawner,
      nodePath: '/usr/bin/node',
      cancelGraceMs: 3000,
      cwd: '/app',
      scriptPathOf: (slug) => repository.scriptPath(slug),
      parentEnv: {},
    },
    now: () => 1000,
  });
  return { fs, services, spawner };
}

async function replayDemo(services: ReturnType<typeof setup>['services']) {
  const output = createFakeOutput();
  const exitCode = await runCli(['replay', 'demo', '--headless'], {
    tokenizer: { tokenize: tokenizeArgv },
    output,
    signals: createFakeSignals(),
    version: '0.0.0',
    createServices: () => services,
  });
  return { output, exitCode };
}

describe('browser-recorder replay with an unreadable profile', () => {
  it('prints the Full Disk Access message to stderr and exits 1 on macOS', async () => {
    const { fs, services, spawner } = setup('darwin', COPY_OF_REAL);
    fs.deniedPaths.add(`${REAL}/Local State`);
    const { output, exitCode } = await replayDemo(services);
    expect(exitCode).toBe(1);
    expect(output.stdout()).toBe('');
    expect(output.stderr()).toMatch(/Full Disk Access/);
    expect(output.stderr()).toMatch(/restart the terminal/i);
    expect(output.stderr()).not.toContain(REAL);
    expect(spawner.children).toHaveLength(0);
  });

  it('prints the generic permission hint on Linux', async () => {
    const { fs, services } = setup('linux', COPY_OF_REAL);
    fs.deniedPaths.add(`${REAL}/Profile 2`);
    const { output, exitCode } = await replayDemo(services);
    expect(exitCode).toBe(1);
    expect(output.stderr()).toMatch(/permission denied/);
    expect(output.stderr()).not.toMatch(/Full Disk Access/);
  });

  it('keeps a missing Local State worded as not found', async () => {
    const { fs, services } = setup('darwin', COPY_OF_REAL);
    fs.nodes.delete(`${REAL}/Local State`);
    const { output, exitCode } = await replayDemo(services);
    expect(exitCode).toBe(1);
    expect(output.stderr()).toMatch(/could not be found/);
    expect(output.stderr()).not.toMatch(/Full Disk Access/);
  });

  it('launches the browser and profile a recording was changed to', async () => {
    const { services, spawner } = setup('linux', {
      browserId: 'brave',
      profileMode: 'managed',
      sourceProfile: null,
    });
    await services.startReplay('demo', {
      timing: RECORDED_TIMING,
      isHeadless: true,
    });
    expect(spawner.children[0]?.request.env).toMatchObject({
      BROWSER_RECORDER_EXECUTABLE_PATH: BRAVE_INSTALLED.executablePath,
    });
    expect(
      spawner.children[0]?.request.env['BROWSER_RECORDER_USER_DATA_DIR'],
    ).toContain('brave');
  });
});
