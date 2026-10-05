import { describe, expect, it } from 'vitest';
import type { SessionSignal } from '../../../src/recording-capture/application/ports/browser-launcher.ts';
import { useSessionRig } from '../../support/session-rig.ts';
import type { SessionRig } from '../../support/session-rig.ts';

type Signal<K extends SessionSignal['kind']> = Extract<
  SessionSignal,
  { kind: K }
>;

function navigations(rig: SessionRig): Signal<'navigation'>[] {
  return rig.signals.filter(
    (signal): signal is Signal<'navigation'> => signal.kind === 'navigation',
  );
}

async function waitForNavigations(rig: SessionRig, count: number) {
  await rig.waitForSignal('navigation', count);
  return navigations(rig);
}

describe('src/recording-capture/adapters/playwright-browser-session.ts', () => {
  const factory = useSessionRig();

  describe('signals', () => {
    it('delivers the first navigation to a listener that subscribed after launch', async () => {
      const rig = await factory.startAndSubscribeLate('nav-a.html');
      const [first] = navigations(rig);
      expect(first.navigationType).toBe('navigate');
      expect(first.url).toContain('nav-a.html');
      expect(first.pageId).toBe('page1');
      expect(first.entryIndex).toBeTypeOf('number');
      expect(rig.signalsOfKind('page-opened')).toHaveLength(0);
    });

    it('stamps a dom signal with the clock at binding entry, its page and frame path', async () => {
      const rig = await factory.start('button.html');
      rig.clock.setTime(4200);
      await rig.firstPage().getByTestId('save-button').click();
      const signal = await rig.waitForSignal('dom');
      expect(signal).toMatchObject({
        kind: 'dom',
        pageId: 'page1',
        receivedAt: 4200,
        framePath: [],
        payload: { kind: 'click', button: 'left' },
      });
    });

    it('resolves the iframe path of an event from inside the frame', async () => {
      const rig = await factory.start('iframe.html');
      await rig
        .firstPage()
        .frameLocator('#inner')
        .getByRole('button', { name: 'Inner action' })
        .click();
      const signal = await rig.waitForSignal('dom');
      expect(signal).toMatchObject({ framePath: ['#inner'] });
    });

    it('puts the candidate Playwright finds once first', async () => {
      const rig = await factory.start('text-twin.html');
      await rig.firstPage().locator('.label-x').click();
      const signal = await rig.waitForSignal('dom');
      expect(signal.kind === 'dom' && signal.candidates[0]).toEqual({
        kind: 'css',
        selector: 'span.label-x',
      });
    });

    it('stores the role locator, not #x, when a click lands on a labelled element behind a duplicated id', async () => {
      const rig = await factory.start('duplicate-id.html');
      await rig.firstPage().getByLabel('Second field').click();
      const signal = await rig.waitForSignal('dom');
      expect(signal.kind === 'dom' && signal.candidates).toContainEqual({
        kind: 'label',
        text: 'Second field',
      });
      expect(signal.kind === 'dom' && signal.candidates[0]).toEqual({
        kind: 'role',
        role: 'textbox',
        name: 'Second field',
      });
      expect(signal.kind === 'dom' && signal.candidates).not.toContainEqual({
        kind: 'css',
        selector: '#x',
      });
    });

    it('stores the label locator, not #x, when the clicked element has no role', async () => {
      const rig = await factory.start('duplicate-id-no-role.html');
      await rig.firstPage().getByLabel('Birthday').click();
      const signal = await rig.waitForSignal('dom');
      expect(signal.kind === 'dom' && signal.candidates[0]).toEqual({
        kind: 'label',
        text: 'Birthday',
      });
      expect(signal.kind === 'dom' && signal.candidates).not.toContainEqual({
        kind: 'css',
        selector: '#x',
      });
    });

    it('keeps events in the order they happened', async () => {
      const rig = await factory.start('button.html');
      const save = rig.firstPage().getByTestId('save-button');
      for (const time of [10, 20, 30, 40]) {
        rig.clock.setTime(time);
        await save.click();
      }
      await rig.waitForSignal('dom', 4);
      expect(
        rig.signalsOfKind('dom').map(({ receivedAt }) => receivedAt),
      ).toEqual([10, 20, 30, 40]);
    });
  });

  describe('navigation, classified from Node over CDP', () => {
    it('reports a reload as reload', async () => {
      const rig = await factory.start('nav-a.html');
      await waitForNavigations(rig, 1);
      await rig.firstPage().reload();
      const all = await waitForNavigations(rig, 2);
      expect(all[1]?.navigationType).toBe('reload');
    });

    it('reports back and forward with a falling then rising history index', async () => {
      const rig = await factory.start('nav-a.html');
      await rig.firstPage().locator('#to-b').click();
      await waitForNavigations(rig, 2);
      await rig.firstPage().goBack();
      await waitForNavigations(rig, 3);
      await rig.firstPage().goForward();
      const [, forward, back, again] = await waitForNavigations(rig, 4);
      expect(forward.navigationType).toBe('navigate');
      expect([back.navigationType, again.navigationType]).toEqual([
        'back_forward',
        'back_forward',
      ]);
      expect(back.entryIndex).toBe((forward.entryIndex ?? 0) - 1);
      expect(again.entryIndex).toBe(forward.entryIndex);
    });

    it('reports a same-document push as a push', async () => {
      const rig = await factory.start('nav-a.html');
      await waitForNavigations(rig, 1);
      await rig.firstPage().locator('#push-state').click();
      const [, push] = await waitForNavigations(rig, 2);
      expect(push.navigationType).toBe('push');
      expect(push.url).toContain('step=2');
    });

    it('reports the main frame only, never an iframe', async () => {
      const rig = await factory.start('iframe.html');
      await waitForNavigations(rig, 1);
      await rig.firstPage().waitForTimeout(300);
      expect(navigations(rig)).toHaveLength(1);
    });
  });

  describe('pages', () => {
    it('reports a popup with its opener and tags its events with its own id', async () => {
      const rig = await factory.start('popup.html');
      await rig.firstPage().locator('#open-link').click();
      const opened = (await rig.waitForSignal(
        'page-opened',
      )) as Signal<'page-opened'>;
      expect(opened).toMatchObject({ pageId: 'page2', openerPageId: 'page1' });
      const popup = rig.context
        .pages()
        .find((page) => page !== rig.firstPage());
      if (popup === undefined) throw new Error('no popup');
      await popup.waitForLoadState('load');
      await popup.locator('#popup-button').click();
      await rig.waitForSignal('dom', 2);
      expect(rig.signalsOfKind('dom').at(-1)).toMatchObject({
        pageId: 'page2',
      });
    });

    it('reports a page closing while others stay open', async () => {
      const rig = await factory.start('popup.html');
      await rig.firstPage().locator('#open-script').click();
      await rig.waitForSignal('page-opened');
      const popup = rig.context
        .pages()
        .find((page) => page !== rig.firstPage());
      if (popup === undefined) throw new Error('no popup');
      await popup.waitForLoadState('load');
      await popup.locator('#close-me').click();
      await rig.waitForSignal('page-closed');
      expect(rig.signalsOfKind('page-closed')).toMatchObject([
        { pageId: 'page2' },
      ]);
      expect(rig.signalsOfKind('browser-closed')).toHaveLength(0);
    });

    it('reports the browser closed when the last page closes', async () => {
      const rig = await factory.start('button.html');
      await rig.firstPage().close();
      await rig.waitForSignal('browser-closed');
      expect(rig.signalsOfKind('page-closed')).toMatchObject([
        { pageId: 'page1' },
      ]);
    });
  });

  describe('dialogs', () => {
    it('holds a prompt until the recorder answers it, and passes the text on', async () => {
      const rig = await factory.start('prompt-hash.html');
      void rig.firstPage().locator('#ask').click();
      const opened = (await rig.waitForSignal(
        'dialog-opened',
      )) as Signal<'dialog-opened'>;
      expect(opened).toMatchObject({
        dialogType: 'prompt',
        message: 'Your name?',
        defaultValue: 'anonymous',
        pageId: 'page1',
      });
      await rig.session.respondToDialog({
        action: 'accept',
        promptText: 'abc',
      });
      const all = await waitForNavigations(rig, 2);
      expect(all[1]?.url).toMatch(/#name-abc$/);
    });

    it('passes a dismissal on as null', async () => {
      const rig = await factory.start('prompt-hash.html');
      void rig.firstPage().locator('#ask').click();
      await rig.waitForSignal('dialog-opened');
      await rig.session.respondToDialog({
        action: 'dismiss',
        promptText: null,
      });
      const all = await waitForNavigations(rig, 2);
      expect(all[1]?.url).toMatch(/#name-null$/);
    });
  });

  describe('dialogs answered in the browser itself', () => {
    // A headed window shows its own dialog; answering it there is the same
    // browser-side call a second CDP client makes here, headless. That client
    // must be attached before the dialog opens: a blocked page answers no
    // `Page.enable`.
    async function nativeAnswerer(rig: SessionRig) {
      const other = await rig.context.newCDPSession(rig.firstPage());
      await other.send('Page.enable');
      return async (answer: {
        isAccepted: boolean;
        promptText?: string;
      }): Promise<void> => {
        await other.send('Page.handleJavaScriptDialog', {
          accept: answer.isAccepted,
          promptText: answer.promptText,
        });
      };
    }

    it('reports the accepted text when the dialog was answered natively', async () => {
      const rig = await factory.start('prompt-hash.html');
      const answerNatively = await nativeAnswerer(rig);
      void rig.firstPage().locator('#ask').click();
      await rig.waitForSignal('dialog-opened');
      await answerNatively({ isAccepted: true, promptText: 'native' });
      const closed = (await rig.waitForSignal(
        'dialog-closed',
      )) as Signal<'dialog-closed'>;
      expect(closed).toMatchObject({
        dialogType: 'prompt',
        message: 'Your name?',
        action: 'accept',
        promptText: 'native',
        pageId: 'page1',
      });
    });

    it('reports a native dismissal', async () => {
      const rig = await factory.start('prompt-hash.html');
      const answerNatively = await nativeAnswerer(rig);
      void rig.firstPage().locator('#ask').click();
      await rig.waitForSignal('dialog-opened');
      await answerNatively({ isAccepted: false });
      const closed = (await rig.waitForSignal(
        'dialog-closed',
      )) as Signal<'dialog-closed'>;
      expect(closed).toMatchObject({ action: 'dismiss', promptText: null });
    });

    it('does not report a dialog the recorder answered itself', async () => {
      const rig = await factory.start('prompt-hash.html');
      void rig.firstPage().locator('#ask').click();
      await rig.waitForSignal('dialog-opened');
      await rig.session.respondToDialog({
        action: 'accept',
        promptText: 'abc',
      });
      await waitForNavigations(rig, 2);
      expect(rig.signalsOfKind('dialog-closed')).toEqual([]);
    });
  });

  describe('isolation and shutdown', () => {
    it('leaves nothing for page scripts to see', async () => {
      const rig = await factory.start('button.html');
      const seen = await rig.firstPage().evaluate(() => ({
        binding: typeof (window as unknown as Record<string, unknown>)[
          '__browserRecorderEmit'
        ],
        flag: Symbol.for('browser-recorder.installed') in window,
      }));
      expect(seen).toEqual({ binding: 'undefined', flag: false });
    });

    it('closes the browser once, silently', async () => {
      const rig = await factory.start('button.html');
      await rig.session.close();
      await rig.session.close();
      expect(rig.browser.isConnected()).toBe(false);
      expect(rig.signalsOfKind('browser-closed')).toHaveLength(0);
    });
  });
});
