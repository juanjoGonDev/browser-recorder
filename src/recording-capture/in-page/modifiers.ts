import type { Modifier } from '../../shared/domain/recording-event.ts';

/** The modifiers held during an event, always in the same order. */
export function heldModifiers(event: KeyboardEvent | MouseEvent): Modifier[] {
  const held: Modifier[] = [];
  if (event.altKey) held.push('Alt');
  if (event.ctrlKey) held.push('Control');
  if (event.metaKey) held.push('Meta');
  if (event.shiftKey) held.push('Shift');
  return held;
}
