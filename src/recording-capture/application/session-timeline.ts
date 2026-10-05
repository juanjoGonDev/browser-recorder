import { appendEvent } from '../domain/coalesce-events.ts';
import {
  classifyNavigation,
  classifyPageOpenCause,
} from '../domain/classify-navigation.ts';
import type { NavigationStep } from '../domain/classify-navigation.ts';
import {
  closePage,
  createPageRegistry,
  hasOpenPages,
  registerPage,
} from '../domain/page-registry.ts';
import type { PageRegistry } from '../domain/page-registry.ts';
import { stampOffset } from '../domain/stamp-offset.ts';
import {
  dialogToEvent,
  domSignalToEvent,
} from '../domain/to-recording-event.ts';
import type {
  DialogAnswer,
  DialogInput,
} from '../domain/to-recording-event.ts';
import type {
  PageId,
  RecordingEvent,
} from '../../shared/domain/recording-event.ts';
import type { SessionSignal } from './ports/browser-launcher.ts';

interface PageNavigation {
  readonly url: string | null;
  readonly entryIndex: number | null;
  readonly lastNavigationAtMs: number | null;
  /** URL the tab was opened with; its first navigation to it is not news. */
  readonly openedUrl: string | null;
}

/** Everything the session derives from the signals received so far. */
export interface Timeline {
  readonly t0: number;
  readonly events: readonly RecordingEvent[];
  readonly lastOffsetMs: number;
  /** Receipt time of the last click, key or other page-changing action. */
  readonly lastActionAtMs: number | null;
  readonly pages: PageRegistry;
  readonly navigation: ReadonlyMap<PageId, PageNavigation>;
  /** The last page closed: nothing more can be recorded. */
  readonly hasEnded: boolean;
}

export interface DialogAnswerInput {
  readonly dialog: DialogInput;
  readonly answer: DialogAnswer;
  readonly nowMs: number;
}

type DomSignal = Extract<SessionSignal, { kind: 'dom' }>;
type NavigationSignal = Extract<SessionSignal, { kind: 'navigation' }>;
type PageOpenedSignal = Extract<SessionSignal, { kind: 'page-opened' }>;

/** Pointer travel and scrolling never cause a navigation by themselves. */
const PASSIVE_KINDS: ReadonlySet<string> = new Set(['hover', 'scroll']);

const NO_NAVIGATION: PageNavigation = {
  url: null,
  entryIndex: null,
  lastNavigationAtMs: null,
  openedUrl: null,
};

export function createTimeline(t0: number): Timeline {
  return {
    t0,
    events: [],
    lastOffsetMs: 0,
    lastActionAtMs: null,
    pages: createPageRegistry(),
    navigation: new Map(),
    hasEnded: false,
  };
}

function offsetFor(
  timeline: Timeline,
  receivedAt: number,
  ageMs: number,
): number {
  return stampOffset({
    receivedAt,
    t0: timeline.t0,
    ageMs,
    previousOffsetMs: timeline.lastOffsetMs,
  });
}

function withEvents(
  timeline: Timeline,
  events: readonly RecordingEvent[],
): Timeline {
  const appended = events.reduce(appendEvent, timeline.events);
  const lastOffsetMs = events.reduce(
    (latest, event) => Math.max(latest, event.offsetMs),
    timeline.lastOffsetMs,
  );
  return { ...timeline, events: appended, lastOffsetMs };
}

function applyDom(timeline: Timeline, signal: DomSignal): Timeline {
  const offsetMs = offsetFor(timeline, signal.receivedAt, signal.payload.ageMs);
  const event = domSignalToEvent(signal, offsetMs);
  const isAction = !PASSIVE_KINDS.has(signal.payload.kind);
  const lastActionAtMs = isAction ? signal.receivedAt : timeline.lastActionAtMs;
  const next = { ...timeline, lastActionAtMs };
  return event === null ? next : withEvents(next, [event]);
}

function stepToEvent(
  step: NavigationStep,
  base: { readonly offsetMs: number; readonly pageId: PageId },
): RecordingEvent {
  return 'url' in step ? { ...base, ...step } : { ...base, kind: step.kind };
}

function navigationSteps(
  timeline: Timeline,
  signal: NavigationSignal,
  previous: PageNavigation,
): readonly NavigationStep[] {
  const isOpeningUrl =
    previous.openedUrl === signal.url && signal.navigationType === 'navigate';
  if (isOpeningUrl) return [];
  return classifyNavigation(
    {
      navigationType: signal.navigationType,
      url: signal.url,
      entryIndex: signal.entryIndex,
      nowMs: signal.receivedAt,
    },
    {
      lastActionAtMs: timeline.lastActionAtMs,
      lastNavigationAtMs: previous.lastNavigationAtMs,
      currentUrl: previous.url,
      previousEntryIndex: previous.entryIndex,
    },
  );
}

function applyNavigation(
  timeline: Timeline,
  signal: NavigationSignal,
): Timeline {
  const previous = timeline.navigation.get(signal.pageId) ?? NO_NAVIGATION;
  const base = {
    offsetMs: offsetFor(timeline, signal.receivedAt, 0),
    pageId: signal.pageId,
  };
  const events = navigationSteps(timeline, signal, previous).map((step) =>
    stepToEvent(step, base),
  );
  const current: PageNavigation = {
    url: signal.url,
    entryIndex: signal.entryIndex,
    lastNavigationAtMs: signal.receivedAt,
    openedUrl: null,
  };
  const navigation = new Map(timeline.navigation).set(signal.pageId, current);
  return withEvents({ ...timeline, navigation }, events);
}

function applyPageOpened(
  timeline: Timeline,
  signal: PageOpenedSignal,
): Timeline {
  const event: RecordingEvent = {
    kind: 'page-opened',
    offsetMs: offsetFor(timeline, signal.receivedAt, 0),
    pageId: signal.pageId,
    openerPageId: signal.openerPageId,
    cause: classifyPageOpenCause(timeline.lastActionAtMs, signal.receivedAt),
    url: signal.url,
  };
  const opened: PageNavigation = { ...NO_NAVIGATION, openedUrl: signal.url };
  const navigation = new Map(timeline.navigation).set(signal.pageId, opened);
  const pages = registerPage(
    timeline.pages,
    signal.pageId,
    signal.openerPageId,
  );
  return withEvents({ ...timeline, pages, navigation }, [event]);
}

function applyPageClosed(
  timeline: Timeline,
  pageId: PageId,
  receivedAt: number,
): Timeline {
  const pages = closePage(timeline.pages, pageId);
  if (!hasOpenPages(pages)) return { ...timeline, pages, hasEnded: true };
  const event: RecordingEvent = {
    kind: 'page-closed',
    offsetMs: offsetFor(timeline, receivedAt, 0),
    pageId,
  };
  return withEvents({ ...timeline, pages }, [event]);
}

/**
 * Folds one browser signal into the timeline. Dialog and browser-closed
 * signals carry no event of their own; the session handles them.
 */
export function applySignal(
  timeline: Timeline,
  signal: SessionSignal,
): Timeline {
  const known = {
    ...timeline,
    pages: registerPage(timeline.pages, signal.pageId, null),
  };
  switch (signal.kind) {
    case 'dom':
      return applyDom(known, signal);
    case 'navigation':
      return applyNavigation(known, signal);
    case 'page-opened':
      return applyPageOpened(timeline, signal);
    case 'page-closed':
      return applyPageClosed(known, signal.pageId, signal.receivedAt);
    case 'browser-closed':
    case 'dialog-opened':
      return timeline;
  }
}

/** Adds the answer the user gave to a dialog, stamped when it was given. */
export function applyDialogAnswer(
  timeline: Timeline,
  input: DialogAnswerInput,
): Timeline {
  const offsetMs = offsetFor(timeline, input.nowMs, 0);
  return withEvents(timeline, [
    dialogToEvent(input.dialog, input.answer, offsetMs),
  ]);
}
