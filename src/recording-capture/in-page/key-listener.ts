import type { Modifier } from '../../shared/domain/recording-event.ts';
import { shouldRecordKey } from '../domain/should-record-key.ts';
import { deepActiveElement } from './deep-query.ts';
import { emitDom } from './emit.ts';
import { isTextEntry } from './interactive-target.ts';
import { listen } from './listen.ts';
import { heldModifiers } from './modifiers.ts';
import { markInput } from './recent-input.ts';

const MODIFIER_KEYS = new Set(['Alt', 'Control', 'Meta', 'Shift']);
// A select's change event already says which option was picked.
const SELECT_NAVIGATION_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);
/** The focused element when it is a real target, not the page itself. */
function focusedTarget(): Element | null {
  const active = deepActiveElement();
  const isPage = active === null || active === document.body;
  return isPage || active === document.documentElement ? null : active;
}

/** The key the way a replay presses it: `Control+Shift+K`, `Space`. */
function describeKey(key: string, modifiers: readonly Modifier[]): string {
  const name = key === ' ' ? 'Space' : key;
  return [...modifiers, name].join('+');
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Enter') markInput('enter');
  const target = focusedTarget();
  const modifiers = heldModifiers(event);
  const isSelectNavigation =
    target instanceof HTMLSelectElement &&
    SELECT_NAVIGATION_KEYS.has(event.key);
  const isRecorded =
    !event.repeat &&
    !MODIFIER_KEYS.has(event.key) &&
    !isSelectNavigation &&
    shouldRecordKey({
      key: event.key,
      modifiers,
      isInFillable: isTextEntry(target),
    });
  if (!isRecorded) return;
  emitDom(target, { kind: 'key', key: describeKey(event.key, modifiers) });
}

export function installKeyListener(): void {
  listen('keydown', onKeyDown);
}
