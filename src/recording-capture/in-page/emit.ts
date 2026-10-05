import { BINDING_NAME } from '../domain/in-page-message.ts';
import type { InPageMessage } from '../domain/in-page-message.ts';
import type { CapturedEvent } from '../domain/captured-event.ts';
import { buildCandidates } from './build-locator.ts';
import { describeElement } from './describe-element.ts';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

/** What a listener decides; `emitDom` adds the timing and the target info. */
export type EventBody = DistributiveOmit<
  CapturedEvent,
  'ageMs' | 'description'
>;

type Binding = (message: InPageMessage) => unknown;
type Hook = (message: InPageMessage) => void;

const beforeHooks: Hook[] = [];
const afterHooks: Hook[] = [];

/** Runs before every message leaves, e.g. to flush a pending scroll. */
export function beforeEmit(hook: Hook): void {
  beforeHooks.push(hook);
}

/** Runs after every message left, e.g. to end the hover trace. */
export function afterEmit(hook: Hook): void {
  afterHooks.push(hook);
}

function sendToBinding(message: InPageMessage): boolean {
  const binding = (window as unknown as Record<string, Binding | undefined>)[
    BINDING_NAME
  ];
  if (typeof binding !== 'function') return false;
  try {
    // The page may be going away; a lost report must never break the page.
    Promise.resolve(binding(message)).catch(() => undefined);
  } catch {
    return false;
  }
  return true;
}

/** Hands a message to Node. Returns false while the binding is not there. */
export function emit(message: InPageMessage): boolean {
  for (const hook of beforeHooks) hook(message);
  const isSent = sendToBinding(message);
  for (const hook of afterHooks) hook(message);
  return isSent;
}

/**
 * Reports a DOM interaction on `element` (or on no element at all). `ageMs`
 * is how long ago the real moment was, for events reported late.
 */
export function emitDom(
  element: Element | null,
  body: EventBody,
  ageMs = 0,
): void {
  const description = element === null ? '' : describeElement(element);
  emit({
    kind: 'dom',
    payload: {
      ...body,
      ageMs: Math.max(0, Math.round(ageMs)),
      description,
    } as CapturedEvent,
    candidates: element === null ? [] : buildCandidates(element),
  });
}
