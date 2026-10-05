import { chromium } from 'patchright';
import type { Browser, Page } from 'patchright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  orderByVerification,
  toPlaywrightLocator,
  verifyInScope,
} from '../../../src/recording-capture/adapters/locator-verifier.ts';
import type { Locator } from '../../../src/shared/domain/locator.ts';
import type { FixtureServer } from '../../support/fixture-server.ts';
import { startFixtureServer } from '../../support/fixture-server.ts';
import { loadKit, probe } from '../../support/in-page-probe.ts';

const LOAD_TOLERANT_TIMEOUT_MS = 5000;

describe('src/recording-capture/adapters/locator-verifier.ts', () => {
  let browser: Browser;
  let server: FixtureServer;
  let page: Page;

  beforeAll(async () => {
    server = await startFixtureServer();
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
    await server.close();
  });

  async function open(name: string): Promise<void> {
    page = await browser.newPage();
    await page.goto(server.urlFor(name));
  }

  describe('toPlaywrightLocator', () => {
    it.each<[string, string, Locator]>([
      ['button.html', 'test-id', { kind: 'test-id', testId: 'save-button' }],
      ['button.html', 'role', { kind: 'role', role: 'button', name: 'Save' }],
      ['form.html', 'label', { kind: 'label', text: 'Username' }],
      [
        'form.html',
        'placeholder',
        { kind: 'placeholder', text: 'Your username' },
      ],
      ['dynamic-id.html', 'text', { kind: 'text', text: 'Generated id' }],
      ['button.html', 'css', { kind: 'css', selector: '#save' }],
    ])('finds the element on %s by %s', async (pageName, _kind, locator) => {
      await open(pageName);
      await expect(toPlaywrightLocator(page, locator).count()).resolves.toBe(1);
      await page.close();
    });

    it('matches names exactly, like the generated script will', async () => {
      await open('button.html');
      const partial: Locator = { kind: 'role', role: 'button', name: 'Sav' };
      await expect(toPlaywrightLocator(page, partial).count()).resolves.toBe(0);
      await page.close();
    });
  });

  describe('verifyInScope', () => {
    it('promotes the candidate Playwright finds once over one it finds twice', async () => {
      await open('text-twin.html');
      await loadKit(page);
      const candidates = (await probe(
        page,
        'buildCandidates',
        '.label-x',
      )) as Locator[];
      expect(candidates[0]).toEqual({ kind: 'text', text: 'Save' });
      // A generous budget: the default one is tuned for a live recording and
      // a busy machine running many browsers at once would exceed it.
      const ordered = await orderByVerification(
        candidates,
        (candidate) => toPlaywrightLocator(page, candidate).count(),
        LOAD_TOLERANT_TIMEOUT_MS,
      );
      expect(ordered[0]).toEqual({ kind: 'css', selector: 'span.label-x' });
      expect(ordered).toHaveLength(candidates.length);
      await page.close();
    });

    it('keeps the order when the page is gone', async () => {
      await open('button.html');
      const frame = page;
      const candidates: Locator[] = [
        { kind: 'test-id', testId: 'save-button' },
        { kind: 'css', selector: '#save' },
      ];
      await page.close();
      await expect(verifyInScope(frame, candidates)).resolves.toEqual(
        candidates,
      );
    });
  });

  describe('agreement with the in-page ranking', () => {
    it.each([
      ['button.html', '#save'],
      ['button.html', '#plain'],
      ['form.html', '#username'],
      ['form.html', '#password'],
      ['form.html', '#country'],
      ['form.html', '#submit'],
      ['checkbox.html', '#newsletter'],
      ['duplicate-id.html', 'button'],
      ['duplicate-id.html', 'input'],
      ['locators.html', '.note'],
      ['locators.html', '.twin'],
      ['locators.html', '[data-case="dynamic-empty"]'],
      ['locators.html', '[data-testid="export"]'],
      ['locators.html', '.current'],
      ['shadow-dom.html', '#shadow-button'],
    ])(
      'the first candidate for %s %s resolves to that one element',
      async (pageName, selector) => {
        await open(pageName);
        await loadKit(page);
        const candidates = (await probe(
          page,
          'buildCandidates',
          selector,
        )) as Locator[];
        const verified = await verifyInScope(page, candidates);
        expect(verified[0]).toEqual(candidates[0]);
        const found = toPlaywrightLocator(page, candidates[0]);
        await expect(found.count()).resolves.toBe(1);
        await page.close();
      },
    );
  });
});
