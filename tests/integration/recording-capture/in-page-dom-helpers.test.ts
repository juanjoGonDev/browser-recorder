import { chromium } from 'patchright';
import type { Browser, Page } from 'patchright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  containsDeep,
  deepCount,
  loadKit,
  parentTagOf,
  probe,
} from '../../support/in-page-probe.ts';
import { startFixtureServer } from '../../support/fixture-server.ts';
import type { FixtureServer } from '../../support/fixture-server.ts';

// Covers deep-query, implicit-role, accessible-name and css-path: the DOM
// helpers every locator is built from, run in real Chromium.
describe('in-page DOM helpers', () => {
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

  async function show(html: string): Promise<void> {
    page = await browser.newPage();
    await page.setContent(html);
    await loadKit(page);
  }

  describe('deep-query', () => {
    it('reaches elements inside open shadow roots', async () => {
      page = await browser.newPage();
      await page.goto(server.urlFor('shadow-dom.html'));
      await loadKit(page);
      await expect(deepCount(page, '#shadow-button')).resolves.toBe(1);
      await expect(
        page.evaluate(() => document.querySelectorAll('#shadow-button').length),
      ).resolves.toBe(0);
      await page.close();
    });

    it('reaches elements in nested shadow roots and the light DOM alike', async () => {
      await show(`<p class="hit">light</p><div id="outer"></div><script>
        const outer = document.getElementById('outer').attachShadow({ mode: 'open' });
        outer.innerHTML = '<p class="hit">first</p><div id="inner"></div>';
        outer.getElementById('inner').attachShadow({ mode: 'open' }).innerHTML = '<p class="hit">second</p>';
      </script>`);
      await expect(deepCount(page, '.hit')).resolves.toBe(3);
      await page.close();
    });

    it('walks from a shadow child to its host and tests containment across roots', async () => {
      page = await browser.newPage();
      await page.goto(server.urlFor('shadow-dom.html'));
      await loadKit(page);
      await expect(parentTagOf(page, '#shadow-button')).resolves.toBe(
        'app-card',
      );
      await expect(parentTagOf(page, 'html')).resolves.toBeNull();
      await expect(containsDeep(page, '#card', '#shadow-button')).resolves.toBe(
        true,
      );
      await expect(
        containsDeep(page, '#shadow-status', '#shadow-button'),
      ).resolves.toBe(false);
      await page.close();
    });
  });

  describe('implicit-role', () => {
    it.each([
      ['<a id="t" href="/x">x</a>', 'link'],
      ['<button id="t">x</button>', 'button'],
      ['<input id="t" type="submit" />', 'button'],
      ['<input id="t" type="checkbox" />', 'checkbox'],
      ['<input id="t" type="radio" />', 'radio'],
      ['<input id="t" type="range" />', 'slider'],
      ['<input id="t" type="number" />', 'spinbutton'],
      ['<input id="t" type="search" />', 'searchbox'],
      ['<input id="t" type="email" />', 'textbox'],
      ['<input id="t" />', 'textbox'],
      ['<textarea id="t"></textarea>', 'textbox'],
      ['<select id="t"><option>a</option></select>', 'combobox'],
      ['<select id="t" multiple><option>a</option></select>', 'listbox'],
      ['<h3 id="t">x</h3>', 'heading'],
      ['<nav id="t"></nav>', 'navigation'],
      ['<ul id="t"><li>a</li></ul>', 'list'],
      ['<img id="t" alt="logo" src="data:," />', 'img'],
      ['<div id="t" role="tab">x</div>', 'tab'],
      ['<button id="t" role="menuitem">x</button>', 'menuitem'],
    ])('maps %s to %s', async (html, role) => {
      await show(html);
      await expect(probe(page, 'implicitRole', '#t')).resolves.toBe(role);
      await page.close();
    });

    it.each([
      ['<div id="t">x</div>'],
      ['<a id="t">no href</a>'],
      ['<input id="t" type="password" />'],
      ['<input id="t" type="color" />'],
    ])('finds no role for %s', async (html) => {
      await show(html);
      await expect(probe(page, 'implicitRole', '#t')).resolves.toBeNull();
      await page.close();
    });
  });

  describe('accessible-name', () => {
    it.each([
      [
        'aria-labelledby over every other source',
        '<span id="a">Alpha</span><span id="b">Beta</span><button id="t" aria-label="no" aria-labelledby="a b">x</button>',
        'Alpha Beta',
      ],
      [
        'aria-label over content',
        '<button id="t" aria-label="Close dialog">x</button>',
        'Close dialog',
      ],
      [
        'a for-label',
        '<label for="t">Email address</label><input id="t" />',
        'Email address',
      ],
      [
        'a wrapping label',
        '<label>Full  name <input id="t" /></label>',
        'Full name',
      ],
      [
        'text content',
        '<button id="t">  Save\n  draft </button>',
        'Save draft',
      ],
      [
        'image alt text',
        '<img id="t" alt="Company logo" src="data:," />',
        'Company logo',
      ],
      [
        'an input button value',
        '<input id="t" type="submit" value="Go" />',
        'Go',
      ],
      [
        'the title as a last resort',
        '<div id="t" role="img" title="Chart"></div>',
        'Chart',
      ],
      [
        'an image inside a link',
        '<a id="t" href="/"><img alt="Home" src="data:," /></a>',
        'Home',
      ],
    ])('takes the name from %s', async (_source, html, name) => {
      await show(html);
      await expect(probe(page, 'accessibleName', '#t')).resolves.toBe(name);
      await page.close();
    });

    it('is empty when nothing names the element', async () => {
      await show('<div id="t"></div>');
      await expect(probe(page, 'accessibleName', '#t')).resolves.toBe('');
      await page.close();
    });
  });

  describe('css-path', () => {
    async function expectResolvesToTarget(path: string): Promise<void> {
      await expect(page.locator(path).count()).resolves.toBe(1);
      await expect(
        page
          .locator(path)
          .evaluate((element) => element.getAttribute('data-t')),
      ).resolves.toBe('target');
    }

    it('anchors on a stable unique id', async () => {
      await show('<div><p id="target">x</p></div>');
      await expect(probe(page, 'cssPath', '#target')).resolves.toBe('#target');
      await page.close();
    });

    it('never uses a dynamic id or a generated class', async () => {
      await show(
        '<section class="panel"><div id=":r1:" class="css-1a2b3c flex"><span data-t="target" class="css-9z8y7x"></span></div></section>',
      );
      const path = String(await probe(page, 'cssPath', '[data-t="target"]'));
      expect(path).not.toContain(':r1:');
      expect(path).not.toContain('css-');
      await expectResolvesToTarget(path);
      await page.close();
    });

    it('adds nth-of-type only where siblings are indistinguishable', async () => {
      await show(
        '<ul><li class="item">a</li><li class="item" data-t="target">b</li><li class="item">c</li></ul>',
      );
      const path = String(await probe(page, 'cssPath', '[data-t="target"]'));
      expect(path).toContain(':nth-of-type(2)');
      await expectResolvesToTarget(path);
      await page.close();
    });

    it('prefers attribute selectors and stable classes over positions', async () => {
      await show(
        '<form><input name="first" /><input name="second" data-t="target" /></form>',
      );
      const path = String(await probe(page, 'cssPath', '[data-t="target"]'));
      expect(path).toContain('[name="second"]');
      expect(path).not.toContain('nth-of-type');
      await expectResolvesToTarget(path);
      await page.close();
    });

    it('prefixes the host path when shadow roots repeat the same markup', async () => {
      await show(`<div class="host"></div><div class="host"></div><script>
        const hosts = document.querySelectorAll('.host');
        hosts.forEach((host, index) => {
          const root = host.attachShadow({ mode: 'open' });
          root.innerHTML = '<button type="button">Same</button>';
          if (index === 1) root.firstElementChild.setAttribute('data-t', 'inner');
        });
      </script>`);
      const path = String(await probe(page, 'cssPath', '[data-t="inner"]'));
      expect(path).toContain('nth-of-type(2) ');
      await expect(page.locator(path).count()).resolves.toBe(1);
      await expect(
        page
          .locator(path)
          .evaluate((element) => element.getAttribute('data-t')),
      ).resolves.toBe('inner');
      await page.close();
    });

    it('resolves an element inside a shadow root', async () => {
      page = await browser.newPage();
      await page.goto(server.urlFor('shadow-dom.html'));
      await loadKit(page);
      await page.evaluate(() => {
        const root = document.getElementById('card')?.shadowRoot;
        const extra = document.createElement('button');
        extra.textContent = 'Shadow action';
        root?.append(extra);
      });
      const path = String(await probe(page, 'cssPath', '#shadow-button'));
      await expect(page.locator(path).count()).resolves.toBe(1);
      await expect(
        page.locator(path).evaluate((element) => element.id),
      ).resolves.toBe('shadow-button');
      await page.close();
    });
  });
});
