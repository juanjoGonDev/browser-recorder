import type {
  NavigationType,
  SessionSignal,
} from '../../src/recording-capture/application/ports/browser-launcher.ts';
import type { CapturedEvent } from '../../src/recording-capture/domain/captured-event.ts';
import type { Locator } from '../../src/shared/domain/locator.ts';
import type { PageId } from '../../src/shared/domain/recording-event.ts';

export const SAVE_BUTTON: Locator = {
  kind: 'role',
  role: 'button',
  name: 'Save',
};

interface DomOptions {
  readonly pageId?: PageId;
  readonly candidates?: readonly Locator[];
}

/** A DOM signal received `receivedAt` ms on the monotonic clock. */
export function domSignal(
  receivedAt: number,
  payload: CapturedEvent,
  options: DomOptions = {},
): SessionSignal {
  return {
    kind: 'dom',
    receivedAt,
    pageId: options.pageId ?? 'page1',
    framePath: [],
    payload,
    candidates: options.candidates ?? [SAVE_BUTTON],
  };
}

export function clickPayload(ageMs = 0): CapturedEvent {
  return {
    kind: 'click',
    ageMs,
    description: 'button "Save"',
    button: 'left',
    modifiers: [],
  };
}

export function inputPayload(value: string): CapturedEvent {
  return {
    kind: 'input',
    ageMs: 0,
    description: 'textbox "Name"',
    value,
    isSensitive: false,
  };
}

export function navigationSignal(
  receivedAt: number,
  url: string,
  options: {
    readonly navigationType?: NavigationType;
    readonly entryIndex?: number | null;
    readonly pageId?: PageId;
  } = {},
): SessionSignal {
  return {
    kind: 'navigation',
    receivedAt,
    pageId: options.pageId ?? 'page1',
    url,
    navigationType: options.navigationType ?? 'navigate',
    entryIndex: options.entryIndex ?? null,
  };
}

export function pageOpenedSignal(
  receivedAt: number,
  pageId: PageId,
  url = 'about:blank',
): SessionSignal {
  return {
    kind: 'page-opened',
    receivedAt,
    pageId,
    openerPageId: 'page1',
    url,
  };
}

export function pageClosedSignal(
  receivedAt: number,
  pageId: PageId,
): SessionSignal {
  return { kind: 'page-closed', receivedAt, pageId };
}
