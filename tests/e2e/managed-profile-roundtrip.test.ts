import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { RECORDED_TIMING } from '../../src/shared/domain/replay-timing.ts';
import { createAppServices } from '../../src/composition/create-app-services.ts';
import type { ComposedServices } from '../../src/composition/create-app-services.ts';
import {
  createProductionDeps,
  resolveProductionPaths,
} from '../../src/composition/create-production-services.ts';
import type { BrowserChoice } from '../../src/shared/domain/browser-choice.ts';
import type { ReplayView } from '../../src/tui/domain/app-views.ts';
import { IN_PAGE_BUNDLE_PATH } from '../support/build-in-page-bundle.ts';
import type { FixtureServer } from '../support/fixture-server.ts';
import { startFixtureServer } from '../support/fixture-server.ts';
import { LOGIN_COOKIE, startLoginSite } from '../support/login-site.ts';
import type { LoginSite } from '../support/login-site.ts';
import { createScratchDir } from '../support/scratch-root.ts';
import { removeDirSync } from '../support/remove-dir.ts';

const WAIT = { timeout: 15_000, interval: 100 };
const MANAGED: BrowserChoice = {
  browserId: 'bundled',
  profileMode: 'managed',
  sourceProfile: null,
};

describe('record, generate and replay on a managed profile', () => {
  let site: LoginSite;
  let fixtures: FixtureServer;
  let scratch: string;
  let appData: string;
  let services: ComposedServices;

  beforeAll(async () => {
    site = await startLoginSite();
    fixtures = await startFixtureServer();
    // Inside the repository so a generated script resolves `patchright`.
    scratch = createScratchDir('e2e-managed-');
    appData = mkdtempSync(path.join(tmpdir(), 'br-e2e-app-data-'));
    services = createAppServices(
      createProductionDeps({
        paths: {
          ...resolveProductionPaths(import.meta.url),
          recordingsRoot: scratch,
          inPageScriptPath: IN_PAGE_BUNDLE_PATH,
          appDataRoot: appData,
        },
        isHeadless: true,
      }),
    );
  });

  afterAll(async () => {
    await services.persistActiveRecording();
    await site.close();
    await fixtures.close();
    removeDirSync(scratch);
    removeDirSync(appData);
  });

  /** Records a visit to one page of the login site and saves it. */
  async function recordVisit(name: string, page: string): Promise<string> {
    const live = await services.recording.start({
      name,
      startUrl: `${site.baseUrl}${page}`,
      browser: MANAGED,
    });
    const slug = name.toLowerCase().replaceAll(' ', '-');
    await vi.waitFor(async () => {
      const saved = await services.library.load(slug);
      expect(saved.events.length).toBeGreaterThan(0);
    }, WAIT);
    await live.stop();
    return slug;
  }

  async function replay(slug: string): Promise<ReplayView> {
    const live = await services.replay.start(slug, RECORDED_TIMING);
    return await live.finished;
  }

  it('keeps a login from one recording to the next and into the replay', async () => {
    await expect(
      services.environment.ensureBrowser(() => undefined),
    ).resolves.toMatchObject({ kind: 'ready' });

    await recordVisit('Log in', '/login');
    const slug = await recordVisit('Who am I', '/whoami');
    // The second recording ran on the profile the first one logged in.
    expect(site.cookiesSeen.at(-1)).toBe(LOGIN_COOKIE);

    const saved = await services.library.load(slug);
    expect(saved.browser).toEqual(MANAGED);

    site.cookiesSeen.length = 0;
    const final = await replay(slug);
    expect(final.errorMessage).toBeNull();
    expect(final.status).toBe('succeeded');
    // The generated script opened the same managed directory.
    expect(site.cookiesSeen).toEqual([LOGIN_COOKIE]);
  });

  it('does not share the login with an ephemeral profile', async () => {
    site.cookiesSeen.length = 0;
    const live = await services.recording.start({
      name: 'Clean slate',
      startUrl: `${site.baseUrl}/whoami`,
      browser: { ...MANAGED, profileMode: 'ephemeral' },
    });
    await vi.waitFor(() => {
      expect(site.cookiesSeen.length).toBeGreaterThan(0);
    }, WAIT);
    await live.stop();
    expect(site.cookiesSeen.at(-1)).toBeUndefined();
  });

  it('replays a version 1 recording after regenerating its script', async () => {
    const directory = path.join(scratch, 'legacy-form');
    mkdirSync(directory, { recursive: true });
    const legacy = {
      schemaVersion: 1,
      name: 'Legacy form',
      slug: 'legacy-form',
      startUrl: fixtures.urlFor('roundtrip.html'),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      status: 'complete',
      durationMs: 1500,
      viewport: { width: 1280, height: 800 },
      events: [
        {
          kind: 'goto',
          offsetMs: 0,
          pageId: 'page1',
          url: fixtures.urlFor('roundtrip.html'),
        },
        {
          kind: 'fill',
          offsetMs: 500,
          pageId: 'page1',
          target: {
            locator: { kind: 'label', text: 'Full name' },
            nth: null,
            framePath: [],
            description: 'Full name',
          },
          value: 'Ada Lovelace',
          isSensitive: false,
        },
      ],
    };
    const recordingFile = path.join(directory, 'recording.json');
    const legacyJson = `${JSON.stringify(legacy, null, 2)}\n`;
    await writeFile(recordingFile, legacyJson);
    await writeFile(
      path.join(directory, 'script.mjs'),
      "import { chromium } from 'playwright';\n",
    );

    fixtures.clearReports();
    const final = await replay('legacy-form');

    expect(final.errorMessage).toBeNull();
    expect(final.status).toBe('succeeded');
    expect(fixtures.reports()).toEqual(['Ada Lovelace||']);
    const script = readFileSync(path.join(directory, 'script.mjs'), 'utf8');
    expect(script).toContain("from 'patchright'");
    expect(script).not.toContain("'playwright'");
    // Replaying never upgrades the file: only a later save does.
    await expect(readFile(recordingFile, 'utf8')).resolves.toBe(legacyJson);
  });
});
