import { beforeEmit, emitDom } from './emit.ts';
import { isTextEntry } from './interactive-target.ts';
import { deepActiveElement } from './deep-query.ts';
import { listen } from './listen.ts';

const DEBOUNCE_MS = 150;
const INTENT_WINDOW_MS = 500;
const SCROLL_KEYS = new Set([
  'PageUp',
  'PageDown',
  'Home',
  'End',
  'ArrowUp',
  'ArrowDown',
  ' ',
]);

interface Pending {
  readonly timer: ReturnType<typeof setTimeout>;
  readonly lastScrollAt: number;
  readonly fire: () => void;
}

const pending = new Map<EventTarget, Pending>();
let lastIntentAt = Number.NEGATIVE_INFINITY;

function markIntent(): void {
  lastIntentAt = performance.now();
}

function isOnScrollbar(event: PointerEvent): boolean {
  const { target } = event;
  const area =
    target instanceof Element && target !== document.documentElement
      ? { width: target.clientWidth, height: target.clientHeight }
      : {
          width: document.documentElement.clientWidth,
          height: document.documentElement.clientHeight,
        };
  const isPageTarget = !(
    target instanceof Element && target !== document.documentElement
  );
  const x = isPageTarget ? event.clientX : event.offsetX;
  const y = isPageTarget ? event.clientY : event.offsetY;
  return x > area.width || y > area.height;
}

function fireScroll(target: EventTarget, lastScrollAt: number): void {
  pending.delete(target);
  const ageMs = performance.now() - lastScrollAt;
  if (target instanceof Element) {
    emitDom(
      target,
      {
        kind: 'scroll',
        x: Math.round(target.scrollLeft),
        y: Math.round(target.scrollTop),
      },
      ageMs,
    );
    return;
  }
  emitDom(
    null,
    {
      kind: 'scroll',
      x: Math.round(window.scrollX),
      y: Math.round(window.scrollY),
    },
    ageMs,
  );
}

function onScroll(event: Event): void {
  if (performance.now() - lastIntentAt > INTENT_WINDOW_MS) return;
  const { target } = event;
  if (target === null) return;
  const previous = pending.get(target);
  if (previous !== undefined) clearTimeout(previous.timer);
  const lastScrollAt = performance.now();
  const fire = (): void => {
    fireScroll(target, lastScrollAt);
  };
  pending.set(target, {
    timer: setTimeout(fire, DEBOUNCE_MS),
    lastScrollAt,
    fire,
  });
}

function onKeyDown(event: KeyboardEvent): void {
  const isTyping = isTextEntry(deepActiveElement());
  if (SCROLL_KEYS.has(event.key) && !isTyping) markIntent();
}

function flushPending(): void {
  for (const { timer, fire } of [...pending.values()]) {
    clearTimeout(timer);
    fire();
  }
}

export function installScrollListener(): void {
  listen('wheel', markIntent);
  listen('touchmove', markIntent);
  listen('keydown', onKeyDown);
  listen('pointerdown', (event) => {
    if (isOnScrollbar(event)) markIntent();
  });
  // Document scrolls bubble to the window; element scrolls only capture.
  listen('scroll', onScroll);
  // A scroll that was waiting for its debounce must precede the next action.
  beforeEmit((message) => {
    if (message.payload.kind !== 'scroll') flushPending();
  });
}
