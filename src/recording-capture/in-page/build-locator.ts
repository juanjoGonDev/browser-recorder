import type { Locator } from '../../shared/domain/locator.ts';
import { isDynamicId } from '../domain/is-dynamic-id.ts';
import { accessibleName, labelText, normalizeText } from './accessible-name.ts';
import { cssPath } from './css-path.ts';
import { deepContains, deepQueryAll } from './deep-query.ts';
import { implicitRole } from './implicit-role.ts';

const MAX_CANDIDATES = 4;
const MIN_NAME_LENGTH = 1;
const MAX_NAME_LENGTH = 80;
const MAX_TEXT_LENGTH = 50;
const TEXT_INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

type Generator = (element: Element) => Locator | null;

/** Unique means exactly one match, and it is the element or sits inside it. */
function isUniqueMatch(matches: readonly Element[], element: Element): boolean {
  const [only] = matches;
  return matches.length === 1 && deepContains(element, only ?? null);
}

function isNameLengthValid(name: string): boolean {
  return name.length >= MIN_NAME_LENGTH && name.length <= MAX_NAME_LENGTH;
}

const testId: Generator = (element) => {
  const value = element.getAttribute('data-testid');
  if (value === null || value === '') return null;
  const matches = deepQueryAll('[data-testid]').filter(
    (candidate) => candidate.getAttribute('data-testid') === value,
  );
  return isUniqueMatch(matches, element)
    ? { kind: 'test-id', testId: value }
    : null;
};

const role: Generator = (element) => {
  const kind = implicitRole(element);
  const name = accessibleName(element);
  if (kind === null || !isNameLengthValid(name)) return null;
  const matches = deepQueryAll('*').filter(
    (candidate) =>
      implicitRole(candidate) === kind && accessibleName(candidate) === name,
  );
  return isUniqueMatch(matches, element)
    ? { kind: 'role', role: kind, name }
    : null;
};

const label: Generator = (element) => {
  const text = labelText(element);
  if (!isNameLengthValid(text)) return null;
  const matches = deepQueryAll('*').filter(
    (candidate) => labelText(candidate) === text,
  );
  return isUniqueMatch(matches, element) ? { kind: 'label', text } : null;
};

const placeholder: Generator = (element) => {
  const text = element.getAttribute('placeholder');
  if (text === null || text === '') return null;
  const matches = deepQueryAll('[placeholder]').filter(
    (candidate) => candidate.getAttribute('placeholder') === text,
  );
  return isUniqueMatch(matches, element) ? { kind: 'placeholder', text } : null;
};

const stableId: Generator = (element) => {
  const { id } = element;
  if (id === '' || isDynamicId(id)) return null;
  const selector = `#${CSS.escape(id)}`;
  return isUniqueMatch(deepQueryAll(selector), element)
    ? { kind: 'css', selector }
    : null;
};

/** The smallest elements whose whole text is `text`, like `getByText` exact. */
function elementsWithText(text: string): Element[] {
  const hasText = (element: Element): boolean =>
    normalizeText(element.textContent) === text;
  return deepQueryAll('*').filter(
    (element) =>
      hasText(element) &&
      ![...element.children].some((child) => hasText(child)),
  );
}

const exactText: Generator = (element) => {
  if (TEXT_INPUT_TAGS.has(element.tagName)) return null;
  const text = normalizeText(element.textContent);
  const isLengthValid =
    text.length >= MIN_NAME_LENGTH && text.length <= MAX_TEXT_LENGTH;
  return isLengthValid && isUniqueMatch(elementsWithText(text), element)
    ? { kind: 'text', text }
    : null;
};

const GENERATORS: readonly Generator[] = [
  testId,
  role,
  label,
  placeholder,
  stableId,
  exactText,
];

function hasSelector(found: readonly Locator[], selector: string): boolean {
  return found.some(
    (candidate) => candidate.kind === 'css' && candidate.selector === selector,
  );
}

/**
 * Up to four locators for the element, best first: test id, role and name,
 * label, placeholder, stable id, exact text, then a stable CSS path. Each one
 * was unique when it was built; the CSS path is unique by construction.
 */
export function buildCandidates(element: Element): Locator[] {
  const found: Locator[] = [];
  for (const generate of GENERATORS) {
    const candidate = generate(element);
    if (candidate !== null) found.push(candidate);
    if (found.length === MAX_CANDIDATES) return found;
  }
  const selector = cssPath(element);
  if (!hasSelector(found, selector)) found.push({ kind: 'css', selector });
  return found;
}
