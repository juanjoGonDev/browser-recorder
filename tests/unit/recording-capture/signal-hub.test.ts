import { describe, expect, it } from 'vitest';
import { createSignalHub } from '../../../src/recording-capture/adapters/signal-hub.ts';
import type { SessionSignal } from '../../../src/recording-capture/application/ports/browser-launcher.ts';

function closed(
  pageId: SessionSignal['pageId'],
  receivedAt: number,
): SessionSignal {
  return { kind: 'page-closed', pageId, receivedAt };
}

describe('src/recording-capture/adapters/signal-hub.ts', () => {
  it('holds signals emitted before anyone listens and delivers them in order', () => {
    const hub = createSignalHub();
    hub.emit(closed('page1', 1));
    hub.emit(closed('page2', 2));
    const seen: SessionSignal[] = [];
    hub.onSignal((signal) => seen.push(signal));
    expect(seen.map((signal) => signal.pageId)).toEqual(['page1', 'page2']);
  });

  it('delivers later signals straight to the listener', () => {
    const hub = createSignalHub();
    const seen: number[] = [];
    hub.onSignal((signal) => seen.push(signal.receivedAt));
    hub.emit(closed('page1', 7));
    hub.emit(closed('page1', 9));
    expect(seen).toEqual([7, 9]);
  });

  it('does not replay held signals to a replacement listener', () => {
    const hub = createSignalHub();
    hub.emit(closed('page1', 1));
    hub.onSignal(() => undefined);
    const second: SessionSignal[] = [];
    hub.onSignal((signal) => second.push(signal));
    expect(second).toHaveLength(0);
  });
});
