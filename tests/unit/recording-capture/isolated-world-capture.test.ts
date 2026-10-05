import { describe, expect, it, vi } from 'vitest';
import {
  WORLD_NAME,
  attachCapture,
} from '../../../src/recording-capture/adapters/isolated-world-capture.ts';
import type { CapturedMessage } from '../../../src/recording-capture/adapters/isolated-world-capture.ts';
import { BINDING_NAME } from '../../../src/recording-capture/domain/in-page-message.ts';
import { FakeCdp } from '../../support/fake-cdp.ts';
import { createFakeClock } from '../../support/fake-clock.ts';

const SOURCE = '/* capture script */';
const TREE = { id: 'main', children: [{ id: 'kid' }] };

function payloadOf(description: string): string {
  return JSON.stringify({
    kind: 'dom',
    payload: { kind: 'hover', ageMs: 0, description },
    candidates: [{ kind: 'css', selector: '#x' }],
  });
}

function bindingCall(contextId: number, description = 'one') {
  return {
    name: BINDING_NAME,
    payload: payloadOf(description),
    executionContextId: contextId,
  };
}

async function attach(cdp = new FakeCdp(TREE)) {
  const clock = createFakeClock(10);
  const messages: CapturedMessage[] = [];
  const world = await attachCapture(cdp.asSession(), {
    scriptSource: SOURCE,
    clock,
    onMessage: (captured) => messages.push(captured),
  });
  return { cdp, clock, messages, world };
}

function descriptions(messages: readonly CapturedMessage[]): string[] {
  return messages.map(({ message }) => message.payload.description);
}

describe('src/recording-capture/adapters/isolated-world-capture.ts', () => {
  describe('attaching', () => {
    it('prepares every frame: world, binding, then the script in that world', async () => {
      const { cdp } = await attach();
      const main = cdp.currentContextOf('main');
      const kid = cdp.currentContextOf('kid');
      expect(cdp.methods()).toEqual([
        'Page.enable',
        'Page.getFrameTree',
        'Page.createIsolatedWorld',
        'Runtime.addBinding',
        'Runtime.evaluate',
        'Page.createIsolatedWorld',
        'Runtime.addBinding',
        'Runtime.evaluate',
      ]);
      expect(cdp.callsTo('Runtime.addBinding')[0]?.params).toEqual({
        name: BINDING_NAME,
        executionContextName: WORLD_NAME,
      });
      expect(
        cdp.callsTo('Runtime.evaluate').map((call) => call.params),
      ).toEqual([
        { contextId: main, expression: SOURCE },
        { contextId: kid, expression: SOURCE },
      ]);
    });

    it('never sends the forbidden enable calls nor a document-start script', async () => {
      const { cdp } = await attach();
      cdp.navigate('kid');
      await vi.waitFor(() => {
        expect(cdp.callsTo('Runtime.evaluate')).toHaveLength(3);
      });
      expect(cdp.methods()).not.toContain(['Runtime', 'enable'].join('.'));
      expect(cdp.methods()).not.toContain(['Console', 'enable'].join('.'));
      expect(cdp.methods()).not.toContain(
        'Page.addScriptToEvaluateOnNewDocument',
      );
    });

    it('skips a frame the browser no longer knows', async () => {
      const cdp = new FakeCdp(TREE);
      cdp.detach('kid');
      await attach(cdp);
      expect(cdp.callsTo('Runtime.evaluate')).toHaveLength(1);
    });
  });

  describe('frames changing', () => {
    it('prepares a frame again when it commits a new document', async () => {
      const { cdp } = await attach();
      const before = cdp.currentContextOf('kid');
      cdp.navigate('kid');
      await vi.waitFor(() => {
        expect(cdp.callsTo('Runtime.evaluate')).toHaveLength(3);
      });
      const after = cdp.currentContextOf('kid');
      expect(after).not.toBe(before);
      expect(cdp.callsTo('Runtime.evaluate')[2]?.params).toEqual({
        contextId: after,
        expression: SOURCE,
      });
    });

    it('prepares a frame that appears later through its first navigation', async () => {
      const { cdp } = await attach();
      cdp.tree = { id: 'main', children: [{ id: 'kid' }, { id: 'late' }] };
      cdp.navigate('late');
      await vi.waitFor(() => {
        expect(cdp.callsTo('Runtime.evaluate')).toHaveLength(3);
      });
      expect(cdp.callsTo('Runtime.evaluate')[2]?.params).toEqual({
        contextId: cdp.currentContextOf('late'),
        expression: SOURCE,
      });
    });

    it('can be awaited until the frames that are being prepared are done', async () => {
      const { cdp, world } = await attach();
      cdp.navigate('kid');
      cdp.navigate('main');
      await world.settled();
      expect(cdp.callsTo('Runtime.evaluate')).toHaveLength(4);
    });

    it('is already settled when nothing is being prepared', async () => {
      const { cdp, world } = await attach();
      const before = cdp.sent.length;
      await world.settled();
      expect(cdp.sent).toHaveLength(before);
    });

    it('answers the context of a frame through the world lookup', async () => {
      const { cdp, world } = await attach();
      await expect(world.contextOf('kid')).resolves.toBe(
        cdp.currentContextOf('kid'),
      );
    });
  });

  describe('binding calls', () => {
    it('reports the message with its frame and the time the call reached Node', async () => {
      const { cdp, clock, messages } = await attach();
      clock.setTime(777);
      cdp.emit(
        'Runtime.bindingCalled',
        bindingCall(cdp.currentContextOf('kid') ?? -1),
      );
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({ frameId: 'kid', receivedAt: 777 });
    });

    it('ignores another binding and a payload that is not a message', async () => {
      const { cdp, messages } = await attach();
      const context = cdp.currentContextOf('main') ?? -1;
      cdp.emit('Runtime.bindingCalled', {
        ...bindingCall(context),
        name: 'other',
      });
      cdp.emit('Runtime.bindingCalled', {
        ...bindingCall(context),
        payload: '{',
      });
      cdp.emit('Runtime.bindingCalled', bindingCall(context, 'valid'));
      expect(descriptions(messages)).toEqual(['valid']);
    });

    it('refreshes the frame tree on an unknown context and delivers once it is found', async () => {
      const { cdp, messages } = await attach();
      const renewed = cdp.renewSilently('kid');
      cdp.emit('Runtime.bindingCalled', bindingCall(renewed));
      await vi.waitFor(() => {
        expect(messages).toHaveLength(1);
      });
      expect(messages[0]).toMatchObject({ frameId: 'kid' });
      expect(cdp.callsTo('Page.getFrameTree')).toHaveLength(2);
    });

    it('drops a message whose context stays unknown after one refresh', async () => {
      const { cdp, messages } = await attach();
      cdp.emit('Runtime.bindingCalled', bindingCall(9999));
      await vi.waitFor(() => {
        expect(cdp.callsTo('Page.getFrameTree')).toHaveLength(2);
      });
      await Promise.resolve();
      expect(messages).toHaveLength(0);
    });

    it('drops a message from the context of a frame that left', async () => {
      const { cdp, messages } = await attach();
      const gone = cdp.currentContextOf('kid') ?? -1;
      cdp.detach('kid');
      cdp.emit('Runtime.bindingCalled', bindingCall(gone));
      await vi.waitFor(() => {
        expect(cdp.callsTo('Page.getFrameTree')).toHaveLength(2);
      });
      expect(messages).toHaveLength(0);
    });

    it('keeps the arrival order when an earlier message needs a refresh', async () => {
      const { cdp, messages } = await attach();
      const renewed = cdp.renewSilently('kid');
      const main = cdp.currentContextOf('main') ?? -1;
      cdp.emit('Runtime.bindingCalled', bindingCall(renewed, 'first'));
      cdp.emit('Runtime.bindingCalled', bindingCall(main, 'second'));
      await vi.waitFor(() => {
        expect(messages).toHaveLength(2);
      });
      expect(descriptions(messages)).toEqual(['first', 'second']);
    });
  });
});
