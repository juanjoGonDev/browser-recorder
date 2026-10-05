import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createProductionReplayCommandServices,
  createProductionServices,
  resolveProductionPaths,
} from '../../../src/composition/create-production-services.ts';
import { IN_PAGE_BUNDLE_PATH } from '../../support/build-in-page-bundle.ts';

let scratch = '';

describe('src/composition/create-production-services.ts', () => {
  beforeAll(() => {
    scratch = mkdtempSync(path.join(tmpdir(), 'br-production-'));
  });

  afterAll(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  it('resolves the package and the tool-owned data folder from the module', () => {
    const paths = resolveProductionPaths(import.meta.url);
    expect(path.basename(paths.packageRoot)).toBe('browser-recorder');
    expect(paths.appDataRoot.endsWith('browser-recorder')).toBe(true);
    expect(paths.patchrightCliPath).toMatch(/patchright/);
  });

  it('composes services over the real adapters without touching a browser', async () => {
    const services = createProductionServices({
      paths: {
        ...resolveProductionPaths(import.meta.url),
        recordingsRoot: path.join(scratch, 'recordings'),
        inPageScriptPath: IN_PAGE_BUNDLE_PATH,
        appDataRoot: path.join(scratch, 'app-data'),
      },
      isHeadless: true,
    });
    await expect(services.library.list()).resolves.toEqual([]);
    const options = await services.browsers.list();
    expect(options.at(-1)?.browserId).toBe('bundled');
    await expect(services.persistActiveRecording()).resolves.toBeUndefined();
  });

  it('composes the replay command over the same adapters, on a temporary root', async () => {
    const recordingsRoot = path.join(scratch, 'cli-recordings');
    mkdirSync(path.join(recordingsRoot, 'demo'), { recursive: true });
    writeFileSync(
      path.join(recordingsRoot, 'demo', 'recording.json'),
      '{"nope":1}',
    );
    const services = createProductionReplayCommandServices({
      paths: {
        ...resolveProductionPaths(import.meta.url),
        recordingsRoot,
        inPageScriptPath: IN_PAGE_BUNDLE_PATH,
        appDataRoot: path.join(scratch, 'cli-app-data'),
      },
      isHeadless: true,
    });
    await expect(services.listRecordings()).resolves.toStrictEqual([
      { slug: 'demo', name: null },
    ]);
    const first = services.now();
    expect(services.now()).toBeGreaterThanOrEqual(first);
  });
});
