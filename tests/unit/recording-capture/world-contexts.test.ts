import { describe, expect, it } from 'vitest';
import { createWorldContexts } from '../../../src/recording-capture/adapters/world-contexts.ts';
import { FakeCdp } from '../../support/fake-cdp.ts';

const WORLD = 'test_world';

function setup(cdp = new FakeCdp({ id: 'main', children: [{ id: 'kid' }] })) {
  return { cdp, worlds: createWorldContexts(cdp.asSession(), WORLD) };
}

describe('src/recording-capture/adapters/world-contexts.ts', () => {
  describe('contextOf', () => {
    it('asks the browser for the named world of the frame and remembers the answer', async () => {
      const { cdp, worlds } = setup();
      const first = await worlds.contextOf('main');
      const second = await worlds.contextOf('main');
      expect(first).toBe(cdp.currentContextOf('main'));
      expect(second).toBe(first);
      expect(cdp.callsTo('Page.createIsolatedWorld')).toEqual([
        {
          method: 'Page.createIsolatedWorld',
          params: { frameId: 'main', worldName: WORLD },
        },
      ]);
    });

    it('keeps one context per frame and finds the frame back from the context', async () => {
      const { worlds } = setup();
      const main = await worlds.contextOf('main');
      const kid = await worlds.contextOf('kid');
      expect(main).not.toBe(kid);
      expect(worlds.frameOf(main ?? -1)).toBe('main');
      expect(worlds.frameOf(kid ?? -1)).toBe('kid');
    });

    it('answers undefined, and remembers nothing, for a frame the browser does not know', async () => {
      const { cdp, worlds } = setup();
      cdp.detach('kid');
      await expect(worlds.contextOf('kid')).resolves.toBeUndefined();
      await expect(worlds.contextOf('kid')).resolves.toBeUndefined();
      expect(cdp.callsTo('Page.createIsolatedWorld')).toHaveLength(2);
    });
  });

  describe('dropping', () => {
    it('forgets a frame that committed a new document and looks it up again', async () => {
      const { cdp, worlds } = setup();
      const before = await worlds.contextOf('main');
      cdp.navigate('main');
      expect(worlds.frameOf(before ?? -1)).toBeUndefined();
      const after = await worlds.contextOf('main');
      expect(after).not.toBe(before);
      expect(worlds.frameOf(after ?? -1)).toBe('main');
    });

    it('forgets a frame that left the page', async () => {
      const { cdp, worlds } = setup();
      const context = await worlds.contextOf('kid');
      cdp.detach('kid');
      expect(worlds.frameOf(context ?? -1)).toBeUndefined();
      await expect(worlds.contextOf('kid')).resolves.toBeUndefined();
    });

    it('leaves the other frames alone', async () => {
      const { cdp, worlds } = setup();
      const main = await worlds.contextOf('main');
      await worlds.contextOf('kid');
      cdp.navigate('kid');
      expect(worlds.frameOf(main ?? -1)).toBe('main');
    });
  });

  describe('refresh', () => {
    it('looks up every frame of the frame tree again, replacing stale answers', async () => {
      const { cdp, worlds } = setup();
      const stale = await worlds.contextOf('kid');
      cdp.renewSilently('kid');
      await worlds.refresh();
      const kid = cdp.currentContextOf('kid');
      expect(kid).not.toBe(stale);
      expect(worlds.frameOf(kid ?? -1)).toBe('kid');
      expect(worlds.frameOf(cdp.currentContextOf('main') ?? -1)).toBe('main');
    });
  });
});
