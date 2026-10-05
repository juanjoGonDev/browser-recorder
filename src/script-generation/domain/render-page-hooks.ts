import type {
  PageId,
  RecordingEvent,
} from '../../shared/domain/recording-event.ts';
import { jsNumber, jsString, jsStringArray } from './js-literal.ts';

function renderDialogQueue(
  page: PageId,
  events: readonly RecordingEvent[],
): string[] {
  const entries = events.flatMap((event, index) =>
    event.kind === 'dialog' && event.pageId === page
      ? [
          `{ index: ${jsNumber(index)}, action: ${jsString(event.action)}, promptText: ${event.promptText === null ? 'null' : jsString(event.promptText)} }`,
        ]
      : [],
  );
  return entries.length === 0
    ? []
    : [`rt.expectDialogs(${page}, [${entries.join(', ')}]);`];
}

function renderFileQueue(
  page: PageId,
  events: readonly RecordingEvent[],
): string[] {
  const entries = events.flatMap((event, index) =>
    event.kind === 'set-input-files' && event.pageId === page
      ? [
          `{ index: ${jsNumber(index)}, fileNames: ${jsStringArray(event.fileNames)} }`,
        ]
      : [],
  );
  return entries.length === 0
    ? []
    : [`rt.expectFiles(${page}, [${entries.join(', ')}]);`];
}

/**
 * Dialogs and file choosers are answered by handlers, not by steps, so they
 * must be registered when a page is created, before its first action runs.
 */
export function renderPageHooks(
  page: PageId,
  events: readonly RecordingEvent[],
): string[] {
  return [...renderDialogQueue(page, events), ...renderFileQueue(page, events)];
}
