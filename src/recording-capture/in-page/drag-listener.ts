import { deepContains, originOf } from './deep-query.ts';
import { buildCandidates } from './build-locator.ts';
import { describeElement } from './describe-element.ts';
import { emitDom } from './emit.ts';
import { closestInteractive } from './interactive-target.ts';
import { listen } from './listen.ts';
import { markInput } from './recent-input.ts';

const DRAG_THRESHOLD_PX = 5;

interface Pointer {
  readonly source: Element;
  readonly x: number;
  readonly y: number;
  didMove: boolean;
}

let pointer: Pointer | null = null;
// Set between dragstart and dragend: the browser runs the drag itself, so
// the pointer events that follow must not report it a second time.
let nativeSource: Element | null = null;
let isNativeDrag = false;

function reportDrag(source: Element, target: Element): void {
  markInput('drag');
  emitDom(target, {
    kind: 'drag',
    source: {
      candidates: buildCandidates(source),
      description: describeElement(source),
    },
  });
}

function onPointerDown(event: PointerEvent): void {
  const origin = originOf(event);
  isNativeDrag = false;
  pointer =
    origin === null
      ? null
      : {
          source: closestInteractive(origin),
          x: event.clientX,
          y: event.clientY,
          didMove: false,
        };
}

function onPointerMove(event: PointerEvent): void {
  if (pointer === null || pointer.didMove) return;
  const distance = Math.hypot(
    event.clientX - pointer.x,
    event.clientY - pointer.y,
  );
  pointer.didMove = distance > DRAG_THRESHOLD_PX;
}

function onPointerUp(event: PointerEvent): void {
  const current = pointer;
  pointer = null;
  const origin = originOf(event);
  if (current === null || !current.didMove || isNativeDrag || origin === null) {
    return;
  }
  const target = closestInteractive(origin);
  const isSameElement = deepContains(current.source, target);
  if (!isSameElement) reportDrag(current.source, target);
}

function onDragStart(event: DragEvent): void {
  const origin = originOf(event);
  isNativeDrag = true;
  nativeSource = origin === null ? null : closestInteractive(origin);
}

function onDrop(event: DragEvent): void {
  const origin = originOf(event);
  if (nativeSource !== null && origin !== null) {
    reportDrag(nativeSource, closestInteractive(origin));
  }
  nativeSource = null;
}

export function installDragListener(): void {
  listen('pointerdown', onPointerDown);
  listen('pointermove', onPointerMove);
  listen('pointerup', onPointerUp);
  listen('dragstart', onDragStart);
  listen('drop', onDrop);
  listen('dragend', () => {
    nativeSource = null;
  });
}
