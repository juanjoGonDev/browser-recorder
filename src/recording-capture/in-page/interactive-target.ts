import { parentOf } from './deep-query.ts';

const INTERACTIVE = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  'label',
  'option',
  '[draggable="true"]',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[onclick]',
  ...[
    'button',
    'link',
    'menuitem',
    'tab',
    'checkbox',
    'radio',
    'switch',
    'option',
    'treeitem',
  ].map((role) => `[role="${role}"]`),
].join(',');

/** The element a user meant: the closest interactive ancestor, else itself. */
export function closestInteractive(origin: Element): Element {
  for (
    let current: Element | null = origin;
    current !== null;
    current = parentOf(current)
  ) {
    if (current.matches(INTERACTIVE)) return current;
  }
  return origin;
}

function isChoiceInput(element: Element | null): boolean {
  return (
    element instanceof HTMLInputElement &&
    (element.type === 'checkbox' || element.type === 'radio')
  );
}

/** A checkbox, a radio button or their label: change events speak for them. */
export function isChoiceControl(element: Element): boolean {
  return (
    isChoiceInput(element) ||
    (element instanceof HTMLLabelElement && isChoiceInput(element.control))
  );
}

const NON_TEXT_INPUT_TYPES = new Set([
  'checkbox',
  'radio',
  'file',
  'button',
  'submit',
  'reset',
  'image',
  'range',
  'color',
]);

/** Whether typing in the element enters text (input, textarea, editable). */
export function isTextEntry(element: Element | null): boolean {
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) {
    return !NON_TEXT_INPUT_TYPES.has(element.type);
  }
  return element instanceof HTMLElement && element.isContentEditable;
}
