// A simplified accname: aria-labelledby, aria-label, native label, alt or
// value, content, title. The Node-side locator verifier catches any element
// where Playwright's fuller algorithm disagrees.
import { implicitRole } from './implicit-role.ts';

const NAME_FROM_CONTENT = new Set([
  'button',
  'link',
  'heading',
  'option',
  'menuitem',
  'tab',
  'checkbox',
  'radio',
  'cell',
  'columnheader',
  'listitem',
]);
const LABELABLE = new Set([
  'BUTTON',
  'INPUT',
  'METER',
  'OUTPUT',
  'PROGRESS',
  'SELECT',
  'TEXTAREA',
]);
const BUTTON_INPUT_TYPES = new Set(['button', 'submit', 'reset']);

export function normalizeText(text: string | null): string {
  return (text ?? '').replaceAll(/\s+/g, ' ').trim();
}

function contentText(node: Node): string {
  if (node instanceof Text) return node.data;
  if (!(node instanceof Element)) return '';
  if (node.getAttribute('aria-hidden') === 'true') return '';
  if (node instanceof HTMLImageElement) return node.alt;
  const inner = [...node.childNodes].map(contentText).join('');
  const isInline = getComputedStyle(node).display.startsWith('inline');
  return isInline ? inner : ` ${inner} `;
}

function fromLabelledBy(element: Element): string {
  const ids = (element.getAttribute('aria-labelledby') ?? '').split(/\s+/);
  const root = element.getRootNode() as Document | ShadowRoot;
  return ids
    .map((id) => root.getElementById(id))
    .map((target) => (target === null ? '' : contentText(target)))
    .join(' ');
}

function fromLabels(element: Element): string {
  if (!LABELABLE.has(element.tagName)) return '';
  const { labels } = element as HTMLInputElement;
  return [...(labels ?? [])].map((label) => contentText(label)).join(' ');
}

function fromAlternativeText(element: Element): string {
  if (element instanceof HTMLImageElement) return element.alt;
  if (!(element instanceof HTMLInputElement)) return '';
  const isImage = element.type === 'image';
  return isImage || BUTTON_INPUT_TYPES.has(element.type)
    ? isImage
      ? element.alt
      : element.value
    : '';
}

function fromContent(element: Element): string {
  const role = implicitRole(element);
  return role !== null && NAME_FROM_CONTENT.has(role)
    ? contentText(element)
    : '';
}

function fromTitle(element: Element): string {
  return (
    element.getAttribute('title') ?? element.getAttribute('placeholder') ?? ''
  );
}

/** What labels a control: aria-labelledby, a native label or aria-label. */
export function labelText(element: Element): string {
  const sources = [
    () => fromLabelledBy(element),
    () => fromLabels(element),
    () => element.getAttribute('aria-label') ?? '',
  ];
  for (const source of sources) {
    const text = normalizeText(source());
    if (text !== '') return text;
  }
  return '';
}

/** The text a user (and Playwright's `getByRole({ name })`) knows it by. */
export function accessibleName(element: Element): string {
  const sources = [
    () => fromLabelledBy(element),
    () => element.getAttribute('aria-label') ?? '',
    () => fromLabels(element),
    () => fromAlternativeText(element),
    () => fromContent(element),
    () => fromTitle(element),
  ];
  for (const source of sources) {
    const name = normalizeText(source());
    if (name !== '') return name;
  }
  return '';
}
