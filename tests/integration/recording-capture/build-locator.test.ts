import { chromium } from 'patchright';
import type { Browser, Page } from 'patchright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Locator } from '../../../src/shared/domain/locator.ts';
import { toPlaywrightLocator } from '../../../src/recording-capture/adapters/locator-verifier.ts';
import { startFixtureServer } from '../../support/fixture-server.ts';
import type { FixtureServer } from '../../support/fixture-server.ts';
import { loadKit, probe } from '../../support/in-page-probe.ts';

describe('src/recording-capture/in-page/build-locator.ts', () => {
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
    await loadKit(page);
  }

  async function candidatesOf(selector: string): Promise<Locator[]> {
    return (await probe(page, 'buildCandidates', selector)) as Locator[];
  }

  describe('priority order', () => {
    it('ranks test id, role, then the rest, each only when unique', async () => {
      await open('button.html');
      const candidates = await candidatesOf('#save');
      expect(candidates.slice(0, 2)).toEqual([
        { kind: 'test-id', testId: 'save-button' },
        { kind: 'role', role: 'button', name: 'Save' },
      ]);
      await page.close();
    });

    it('lists role, label, placeholder and id for a labelled input, capped at four', async () => {
      await open('form.html');
      await expect(candidatesOf('#username')).resolves.toEqual([
        { kind: 'role', role: 'textbox', name: 'Username' },
        { kind: 'label', text: 'Username' },
        { kind: 'placeholder', text: 'Your username' },
        { kind: 'css', selector: '#username' },
      ]);
      await page.close();
    });

    it('falls back to a label when the element has no role', async () => {
      await open('locators.html');
      const [first] = await candidatesOf('#colour');
      expect(first).toEqual({ kind: 'label', text: 'Favourite colour' });
      await page.close();
    });

    it('uses exact text for an element without role, label or id', async () => {
      await open('locators.html');
      const [first] = await candidatesOf('.note');
      expect(first).toEqual({ kind: 'text', text: 'Pay now' });
      await page.close();
    });
  });

  describe('uniqueness', () => {
    it('skips a duplicated id and keeps a role locator', async () => {
      await open('duplicate-id.html');
      const candidates = await candidatesOf('button');
      expect(candidates[0]).toEqual({
        kind: 'role',
        role: 'button',
        name: 'First',
      });
      expect(candidates).not.toContainEqual({ kind: 'css', selector: '#x' });
      await page.close();
    });

    it('finds a labelled input behind a duplicated id by its label, not by the id', async () => {
      await open('duplicate-id.html');
      const candidates = await candidatesOf('input');
      expect(candidates).toContainEqual({
        kind: 'label',
        text: 'Second field',
      });
      expect(candidates[0]).toEqual({
        kind: 'role',
        role: 'textbox',
        name: 'Second field',
      });
      expect(candidates).not.toContainEqual({ kind: 'css', selector: '#x' });
      await page.close();
    });

    it('falls back to a stable css path for a duplicated id with no label', async () => {
      await open('duplicate-id.html');
      await page.evaluate(() => {
        document.querySelector('label')?.replaceWith(
          Object.assign(document.createElement('input'), {
            name: 'third',
            id: 'x',
          }),
        );
      });
      await expect(candidatesOf('input[name="third"]')).resolves.toEqual([
        { kind: 'css', selector: 'input[name="third"]' },
      ]);
      await page.close();
    });

    it('never uses a generated id and falls back to a css path', async () => {
      await open('locators.html');
      const candidates = await candidatesOf('[data-case="dynamic-empty"]');
      expect(candidates).toHaveLength(1);
      const only = candidates.at(0);
      expect(only?.kind).toBe('css');
      expect(JSON.stringify(only)).not.toContain(':r1:');
      await page.close();
    });

    it('returns a unique css path for indistinguishable twins', async () => {
      await open('locators.html');
      const path = (await candidatesOf('.twin')).at(0);
      expect(path?.kind).toBe('css');
      const selector = path?.kind === 'css' ? path.selector : '';
      await expect(page.locator(selector).count()).resolves.toBe(1);
      await page.close();
    });

    it('reaches elements inside shadow roots', async () => {
      await open('shadow-dom.html');
      const [first] = await candidatesOf('#shadow-button');
      expect(first).toEqual({
        kind: 'role',
        role: 'button',
        name: 'Shadow action',
      });
      await page.close();
    });

    it('never offers a candidate Playwright finds more than once', async () => {
      const cases: readonly [string, readonly string[]][] = [
        [
          'locators.html',
          [
            '.repeat',
            '.current',
            '[data-testid="export"]',
            '.twin',
            '.note',
            '#colour',
            '[data-case="dynamic-empty"]',
          ],
        ],
        ['duplicate-id.html', ['button', 'input']],
        ['form.html', ['#username']],
      ];
      let checked = 0;
      for (const [fixture, selectors] of cases) {
        await open(fixture);
        for (const selector of selectors) {
          const candidates = await candidatesOf(selector);
          expect(candidates.length).toBeGreaterThan(0);
          for (const candidate of candidates) {
            const count = await toPlaywrightLocator(page, candidate).count();
            expect(
              count,
              `${fixture} ${selector} ${JSON.stringify(candidate)}`,
            ).toBe(1);
            checked += 1;
          }
        }
        await page.close();
      }
      expect(checked).toBeGreaterThan(20);
    });
  });

  describe('describe-element', () => {
    it('labels an element with its role and name', async () => {
      await open('button.html');
      await expect(probe(page, 'describeElement', '#save')).resolves.toBe(
        'button "Save"',
      );
      await page.close();
    });

    it('falls back to the tag and id, and truncates long names', async () => {
      page = await browser.newPage();
      await page.setContent(
        `<div id="plain"></div><button id="long">${'x'.repeat(100)}</button>`,
      );
      await loadKit(page);
      await expect(probe(page, 'describeElement', '#plain')).resolves.toBe(
        'div#plain',
      );
      const label = String(await probe(page, 'describeElement', '#long'));
      expect(label.length).toBeLessThanOrEqual(60);
      expect(label.startsWith('button "xxx')).toBe(true);
      await page.close();
    });
  });
});
