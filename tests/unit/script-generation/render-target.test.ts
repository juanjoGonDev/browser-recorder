import { describe, expect, it } from 'vitest';

import { renderTarget } from '../../../src/script-generation/domain/render-target.ts';
import type { Locator, Target } from '../../../src/shared/domain/locator.ts';

function targetOf(locator: Locator, overrides: Partial<Target> = {}): Target {
  return {
    locator,
    nth: null,
    framePath: [],
    description: 'subject',
    ...overrides,
  };
}

describe('src/script-generation/domain/render-target.ts', () => {
  it.each<[string, Locator, string]>([
    [
      'test-id',
      { kind: 'test-id', testId: 'save' },
      'page1.getByTestId("save")',
    ],
    [
      'role',
      { kind: 'role', role: 'button', name: 'Save' },
      'page1.getByRole("button", { name: "Save", exact: true })',
    ],
    [
      'label',
      { kind: 'label', text: 'Email' },
      'page1.getByLabel("Email", { exact: true })',
    ],
    [
      'placeholder',
      { kind: 'placeholder', text: 'Search' },
      'page1.getByPlaceholder("Search", { exact: true })',
    ],
    [
      'text',
      { kind: 'text', text: 'Hello' },
      'page1.getByText("Hello", { exact: true })',
    ],
    [
      'css',
      { kind: 'css', selector: '#main > .row' },
      'page1.locator("#main > .row")',
    ],
  ])('renders a %s locator', (_kind, locator, expected) => {
    expect(renderTarget('page1', targetOf(locator))).toBe(expected);
  });

  it('appends nth when the locator is ambiguous', () => {
    const target = targetOf({ kind: 'css', selector: 'li' }, { nth: 2 });
    expect(renderTarget('page2', target)).toBe('page2.locator("li").nth(2)');
  });

  it('keeps nth zero, the first of several matches', () => {
    const target = targetOf({ kind: 'css', selector: 'li' }, { nth: 0 });
    expect(renderTarget('page1', target)).toBe('page1.locator("li").nth(0)');
  });

  it('walks the frame path outermost first', () => {
    const target = targetOf(
      { kind: 'test-id', testId: 'inner' },
      { framePath: ['iframe#outer', 'iframe[name="inner"]'] },
    );
    expect(renderTarget('page1', target)).toBe(
      'page1.frameLocator("iframe#outer").frameLocator("iframe[name=\\"inner\\"]").getByTestId("inner")',
    );
  });

  it('escapes hostile locator text as data', () => {
    const target = targetOf({ kind: 'text', text: '"); process.exit(1); ("' });
    expect(renderTarget('page1', target)).toBe(
      'page1.getByText("\\"); process.exit(1); (\\"", { exact: true })',
    );
  });

  it('rejects a page variable that is not a page identifier', () => {
    const target = targetOf({ kind: 'css', selector: 'a' });
    expect(() => renderTarget('page1; evil()', target)).toThrow(/page/);
  });
});
