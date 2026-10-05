import { originOf } from './deep-query.ts';
import { emitDom } from './emit.ts';
import { listen, listenToAny } from './listen.ts';

const NON_TEXT_INPUT_TYPES = new Set([
  'checkbox',
  'radio',
  'file',
  'button',
  'submit',
  'reset',
  'image',
]);

/** Password fields, and anything that asks the browser for a password. */
function isSensitiveField(element: Element): boolean {
  const type = element.getAttribute('type')?.toLowerCase();
  const autocomplete = element.getAttribute('autocomplete')?.toLowerCase();
  return type === 'password' || (autocomplete?.includes('password') ?? false);
}

function typedValue(element: Element): string | null {
  if (element instanceof HTMLTextAreaElement) return element.value;
  if (element instanceof HTMLInputElement) {
    return NON_TEXT_INPUT_TYPES.has(element.type) ? null : element.value;
  }
  return element instanceof HTMLElement && element.isContentEditable
    ? element.innerText
    : null;
}

function onInput(event: Event): void {
  const element = originOf(event);
  if (element === null) return;
  const value = typedValue(element);
  if (value === null) return;
  emitDom(element, {
    kind: 'input',
    value,
    isSensitive: isSensitiveField(element),
  });
}

function reportChange(element: Element): void {
  if (element instanceof HTMLSelectElement) {
    const values = [...element.selectedOptions].map((option) => option.value);
    emitDom(element, { kind: 'select', values });
  } else if (element instanceof HTMLInputElement) {
    reportInputChange(element);
  }
}

function reportInputChange(input: HTMLInputElement): void {
  if (input.type === 'checkbox' || input.type === 'radio') {
    emitDom(input, { kind: 'check', checked: input.checked });
  } else if (input.type === 'file') {
    const fileNames = [...(input.files ?? [])].map((file) => file.name);
    emitDom(input, { kind: 'files', fileNames });
  }
}

function isFileInput(element: Element): boolean {
  return element instanceof HTMLInputElement && element.type === 'file';
}

// Playwright (and some assistive tools) set files without a trusted change
// event; a page cannot choose which files an input holds, so a change on a
// file input is reported whatever its trust.
function onChange(event: Event): void {
  const element = originOf(event);
  if (element === null) return;
  if (event.isTrusted || isFileInput(element)) reportChange(element);
}

export function installInputListener(): void {
  listen('input', onInput);
  listenToAny('change', onChange);
}
