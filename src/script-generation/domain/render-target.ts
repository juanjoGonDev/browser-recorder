import type { Locator, Target } from '../../shared/domain/locator.ts';
import { jsNumber, jsString } from './js-literal.ts';

const PAGE_VARIABLE = /^page\d+$/u;

/** Guards the only identifier that is interpolated rather than quoted. */
export function assertPageVariable(variable: string): void {
  if (!PAGE_VARIABLE.test(variable)) {
    throw new Error(`Not a page variable: ${jsString(variable)}`);
  }
}

function renderLocator(scope: string, locator: Locator): string {
  switch (locator.kind) {
    case 'test-id':
      return `${scope}.getByTestId(${jsString(locator.testId)})`;
    case 'role':
      return `${scope}.getByRole(${jsString(locator.role)}, { name: ${jsString(locator.name)}, exact: true })`;
    case 'label':
      return `${scope}.getByLabel(${jsString(locator.text)}, { exact: true })`;
    case 'placeholder':
      return `${scope}.getByPlaceholder(${jsString(locator.text)}, { exact: true })`;
    case 'text':
      return `${scope}.getByText(${jsString(locator.text)}, { exact: true })`;
    case 'css':
      return `${scope}.locator(${jsString(locator.selector)})`;
  }
}

/**
 * A Playwright expression that resolves the target on the given page variable:
 * frame chain first, then the locator, then `nth` when it was ambiguous.
 */
export function renderTarget(pageVariable: string, target: Target): string {
  assertPageVariable(pageVariable);
  const scope = target.framePath.reduce(
    (chain, selector) => `${chain}.frameLocator(${jsString(selector)})`,
    pageVariable,
  );
  const base = renderLocator(scope, target.locator);
  return target.nth === null ? base : `${base}.nth(${jsNumber(target.nth)})`;
}
