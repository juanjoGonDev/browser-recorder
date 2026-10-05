import type { Modifier } from '../../shared/domain/recording-event.ts';
import { originOf } from './deep-query.ts';
import { emitDom } from './emit.ts';
import { emitHoverTargets } from './hover-tracker.ts';
import { closestInteractive, isChoiceControl } from './interactive-target.ts';
import { listen } from './listen.ts';
import { heldModifiers } from './modifiers.ts';
import { clearInput, isRecentInput, markInput } from './recent-input.ts';

type Button = 'left' | 'middle' | 'right';

/** What the pointer did on pointerdown: the DOM may change before the click. */
interface Press {
  readonly element: Element;
  readonly modifiers: readonly Modifier[];
}

const AFTER_ENTER_MS = 150;
const AFTER_CLICK_MS = 50;
const AFTER_DRAG_MS = 500;
// Clicks the browser raises itself (Space on a button, a label forwarding to
// its control) carry no click count.
const SIMULATED_CLICK_DETAIL = 0;
const MIDDLE_BUTTON = 1;
const RIGHT_BUTTON = 2;
let press: Press | null = null;

function buttonOf(event: MouseEvent): Button {
  if (event.type === 'contextmenu') return 'right';
  return event.button === MIDDLE_BUTTON ? 'middle' : 'left';
}

function onPointerDown(event: PointerEvent): void {
  clearInput('drag');
  const origin = originOf(event);
  if (origin === null) return;
  const element = closestInteractive(origin);
  press = { element, modifiers: heldModifiers(event) };
  emitHoverTargets(element);
}

function reportClick(
  element: Element,
  button: Button,
  modifiers: readonly Modifier[],
): void {
  if (isChoiceControl(element)) return;
  emitDom(element, { kind: 'click', button, modifiers });
}

function onSimulatedClick(event: MouseEvent): void {
  const origin = originOf(event);
  const isEcho =
    isRecentInput('click', AFTER_CLICK_MS) ||
    isRecentInput('enter', AFTER_ENTER_MS);
  if (origin === null || isEcho) return;
  reportClick(closestInteractive(origin), 'left', heldModifiers(event));
}

function onActivation(event: MouseEvent): void {
  const isRightRelease =
    event.type === 'auxclick' && event.button === RIGHT_BUTTON;
  if (isRightRelease) return;
  if (event.type !== 'contextmenu' && event.detail === SIMULATED_CLICK_DETAIL) {
    onSimulatedClick(event);
    return;
  }
  const current = press;
  press = null;
  if (current === null || isRecentInput('drag', AFTER_DRAG_MS)) return;
  markInput('click');
  reportClick(current.element, buttonOf(event), current.modifiers);
}

function onDoubleClick(event: MouseEvent): void {
  const origin = originOf(event);
  if (origin === null) return;
  emitDom(closestInteractive(origin), {
    kind: 'dblclick',
    modifiers: heldModifiers(event),
  });
}

export function installPointerListener(): void {
  listen('pointerdown', onPointerDown);
  listen('click', onActivation);
  listen('auxclick', onActivation);
  listen('contextmenu', onActivation);
  listen('dblclick', onDoubleClick);
}
