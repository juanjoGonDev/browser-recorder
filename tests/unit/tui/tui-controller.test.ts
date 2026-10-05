import { describe, expect, it } from 'vitest';

import { createAppStore } from '../../../src/tui/application/app-store.ts';
import { createTuiController } from '../../../src/tui/application/tui-controller.ts';
import type {
  LibraryScreen,
  NewRecordingScreen,
  RecordingScreen,
  ReplayScreen,
} from '../../../src/tui/domain/app-state.ts';
import type { KeyPress } from '../../../src/tui/application/ports/terminal.ts';
import { createFakeClock, createFakeTimers } from '../../support/fake-clock.ts';
import { createFakeServices } from '../../support/fake-app-services.ts';
import { char, named } from '../../support/keys.ts';
import { clickAt, validEntry } from '../../support/tui-fixtures.ts';

function setup() {
  const fake = createFakeServices();
  const clock = createFakeClock(1000);
  const store = createAppStore();
  const controller = createTuiController({
    services: fake.services,
    store,
    timers: createFakeTimers(clock),
  });
  async function press(...keys: KeyPress[]): Promise<void> {
    for (const key of keys) await controller.handleKey(key);
  }
  async function type(text: string): Promise<void> {
    for (const character of text) await controller.handleKey(char(character));
  }
  return { fake, clock, store, controller, press, type };
}

type Harness = ReturnType<typeof setup>;

async function ready(harness: Harness): Promise<void> {
  await harness.controller.start();
}

async function openForm(harness: Harness): Promise<void> {
  await ready(harness);
  await harness.press(named('return'));
}

async function startRecording(harness: Harness): Promise<void> {
  await openForm(harness);
  await harness.type('Demo');
  await harness.press(named('return'));
}

describe('src/tui/application/tui-controller.ts', () => {
  describe('setup', () => {
    it('opens the main menu once Chromium is ready and keeps the Linux hint', async () => {
      const harness = setup();
      harness.fake.environment = () =>
        Promise.resolve({ kind: 'ready', linuxHint: 'sudo x' });
      await harness.controller.start();
      expect(harness.store.getState().screen).toEqual({
        kind: 'main-menu',
        selected: 0,
      });
      expect(harness.store.getState().linuxHint).toBe('sudo x');
    });

    it('streams installer output and shows the manual command on failure', async () => {
      const harness = setup();
      harness.fake.environment = (onLine) => {
        onLine('Downloading Chromium');
        return Promise.resolve({
          kind: 'failed',
          manualCommand: 'pnpm exec playwright install chromium',
          exitCode: 2,
        });
      };
      await harness.controller.start();
      expect(harness.store.getState().screen).toMatchObject({
        kind: 'setup',
        phase: 'failed',
        lines: ['Downloading Chromium'],
        manualCommand: 'pnpm exec playwright install chromium',
        exitCode: 2,
      });
    });

    it('marks the installing phase while output arrives', async () => {
      const harness = setup();
      let release: () => void = () => undefined;
      harness.fake.environment = async (onLine) => {
        onLine('line');
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return { kind: 'ready', linuxHint: null };
      };
      const started = harness.controller.start();
      await Promise.resolve();
      expect(harness.store.getState().screen).toMatchObject({
        phase: 'installing',
        lines: ['line'],
      });
      release();
      await started;
    });

    it('retries the setup on Enter after a failure', async () => {
      const harness = setup();
      harness.fake.environment = () =>
        Promise.resolve({ kind: 'failed', manualCommand: 'cmd', exitCode: 1 });
      await harness.controller.start();
      harness.fake.environment = () =>
        Promise.resolve({ kind: 'ready', linuxHint: null });
      await harness.press(named('return'));
      expect(harness.store.getState().screen.kind).toBe('main-menu');
    });

    describe('after a failed install (offline)', () => {
      async function offline(): Promise<Harness> {
        const harness = setup();
        harness.fake.entries = [
          validEntry('a', 'Alpha'),
          validEntry('b', 'Beta'),
        ];
        harness.fake.environment = () =>
          Promise.resolve({
            kind: 'failed',
            manualCommand: 'cmd',
            exitCode: 1,
          });
        await harness.controller.start();
        await harness.press(char('l'));
        return harness;
      }

      it('reaches the library with l and lists, renames, deletes and views the timeline', async () => {
        const harness = await offline();
        const library = harness.store.getState().screen as LibraryScreen;
        expect(library.kind).toBe('library');
        expect(library.entries).toHaveLength(2);

        await harness.press(char('r'));
        await harness.type('X');
        await harness.press(named('return'));
        expect(harness.fake.renamed).toEqual([{ slug: 'a', name: 'AlphaX' }]);

        await harness.press(char('d'), char('y'));
        expect(harness.fake.removed).toEqual(['a']);

        await harness.press(char('t'));
        expect(harness.store.getState().screen.kind).toBe('timeline');
      });

      it('refuses to replay and says why', async () => {
        const harness = await offline();
        await harness.press(named('return'));
        expect(harness.fake.replayed).toEqual([]);
        expect(harness.store.getState().screen).toMatchObject({
          kind: 'library',
          error:
            'Chromium is not installed: recording and replay are disabled.',
        });
        await harness.press(char('p'));
        expect(harness.fake.replayed).toEqual([]);
      });

      it('refuses to start a new recording from the library and from the menu', async () => {
        const harness = await offline();
        await harness.press(char('n'));
        expect(harness.store.getState().screen).toMatchObject({
          kind: 'library',
          error:
            'Chromium is not installed: recording and replay are disabled.',
        });
        await harness.press(named('escape'));
        expect(harness.store.getState().screen.kind).toBe('main-menu');
        await harness.press(named('return'));
        expect(harness.store.getState().screen.kind).toBe('main-menu');
        expect(harness.fake.startRequests).toEqual([]);
      });

      it('comes back to full features after a successful retry', async () => {
        const harness = setup();
        harness.fake.environment = () =>
          Promise.resolve({
            kind: 'failed',
            manualCommand: 'cmd',
            exitCode: 1,
          });
        await harness.controller.start();
        harness.fake.environment = () =>
          Promise.resolve({ kind: 'ready', linuxHint: null });
        await harness.press(named('return'));
        await harness.press(named('return'));
        expect(harness.store.getState().screen.kind).toBe('new-recording');
      });
    });

    it('quits on q during the setup', async () => {
      const harness = setup();
      await harness.press(char('q'));
      expect(harness.store.getState().isQuitting).toBe(true);
    });
  });

  describe('main menu', () => {
    it('opens the new recording form, the library, and quits', async () => {
      const harness = setup();
      await ready(harness);
      await harness.press(named('return'));
      expect(harness.store.getState().screen.kind).toBe('new-recording');
      await harness.press(named('escape'));
      expect(harness.store.getState().screen.kind).toBe('main-menu');
      harness.fake.entries = [validEntry('a', 'Alpha')];
      await harness.press(named('down'), named('return'));
      const library = harness.store.getState().screen as LibraryScreen;
      expect(library.kind).toBe('library');
      expect(library.entries).toHaveLength(1);
      await harness.press(
        named('escape'),
        named('down'),
        named('down'),
        named('return'),
      );
      expect(harness.store.getState().isQuitting).toBe(true);
    });
  });

  describe('new recording', () => {
    it('shows an inline error and does not start when the name is empty', async () => {
      const harness = setup();
      await openForm(harness);
      await harness.press(named('return'));
      const form = harness.store.getState().screen as NewRecordingScreen;
      expect(form.error).toBe('Name is required and cannot be empty.');
      expect(harness.fake.startRequests).toEqual([]);
    });

    it('shows an inline error and does not start for an ftp URL', async () => {
      const harness = setup();
      await openForm(harness);
      await harness.type('Demo');
      await harness.press(named('tab'));
      await harness.type('ftp://x');
      await harness.press(named('return'));
      const form = harness.store.getState().screen as NewRecordingScreen;
      expect(form.error).toBe('Start URL must be empty or an http/https URL.');
      expect(harness.fake.startRequests).toEqual([]);
    });

    it('starts on a blank page when the URL is empty', async () => {
      const harness = setup();
      await startRecording(harness);
      expect(harness.fake.startRequests).toEqual([
        { name: 'Demo', startUrl: null },
      ]);
      expect(harness.store.getState().screen).toMatchObject({
        kind: 'recording',
        name: 'Demo',
      });
    });

    it('starts with a trimmed http URL', async () => {
      const harness = setup();
      await openForm(harness);
      await harness.type('  Shop  ');
      await harness.press(named('tab'));
      await harness.type(' https://shop.test/ ');
      await harness.press(named('return'));
      expect(harness.fake.startRequests).toEqual([
        { name: 'Shop', startUrl: 'https://shop.test/' },
      ]);
    });

    it('starts the elapsed clock from the injected time', async () => {
      const harness = setup();
      harness.clock.setTime(5000);
      await startRecording(harness);
      expect(
        (harness.store.getState().screen as RecordingScreen).startedAtMs,
      ).toBe(5000);
    });

    it('keeps the form and shows the error when the browser cannot start', async () => {
      const harness = setup();
      harness.fake.startError = new Error('Could not launch Chromium');
      await startRecording(harness);
      const form = harness.store.getState().screen as NewRecordingScreen;
      expect(form.kind).toBe('new-recording');
      expect(form.error).toBe('Could not launch Chromium');
    });
  });

  describe('rapid input', () => {
    it('keeps every character of a paste that arrives in one tick', async () => {
      const harness = setup();
      await openForm(harness);
      const pending = Array.from('https://shop.test/a-long-url').map(
        (character) => harness.controller.handleKey(char(character)),
      );
      await Promise.all(pending);
      const form = harness.store.getState().screen as NewRecordingScreen;
      expect(form.name.value).toBe('https://shop.test/a-long-url');
    });

    it('ignores a second submit while the first one is still starting', async () => {
      const harness = setup();
      await openForm(harness);
      await harness.type('Demo');
      const first = harness.controller.handleKey(named('return'));
      const second = harness.controller.handleKey(named('return'));
      await Promise.all([first, second]);
      expect(harness.fake.startRequests).toHaveLength(1);
    });
  });

  describe('live recording', () => {
    it('shows each captured event as it streams in', async () => {
      const harness = setup();
      await startRecording(harness);
      harness.fake.live.emit({
        events: [clickAt(10)],
        pendingDialog: null,
        isClosed: false,
      });
      harness.fake.live.emit({
        events: [clickAt(10), clickAt(900)],
        pendingDialog: null,
        isClosed: false,
      });
      expect(
        (harness.store.getState().screen as RecordingScreen).events,
      ).toHaveLength(2);
    });

    it('answers a confirm dialog with a and d', async () => {
      const harness = setup();
      await startRecording(harness);
      const dialog = {
        dialogType: 'confirm',
        message: 'Sure?',
        defaultValue: '',
      } as const;
      harness.fake.live.emit({
        events: [],
        pendingDialog: dialog,
        isClosed: false,
      });
      await harness.press(char('a'));
      harness.fake.live.emit({
        events: [],
        pendingDialog: dialog,
        isClosed: false,
      });
      await harness.press(char('d'));
      expect(harness.fake.live.responses).toEqual([
        { action: 'accept', promptText: null },
        { action: 'dismiss', promptText: null },
      ]);
    });

    it('sends the typed text of a prompt dialog', async () => {
      const harness = setup();
      await startRecording(harness);
      const dialog = {
        dialogType: 'prompt',
        message: 'Name?',
        defaultValue: '',
      } as const;
      harness.fake.live.emit({
        events: [],
        pendingDialog: dialog,
        isClosed: false,
      });
      await harness.type('Bob');
      await harness.press(named('return'));
      expect(harness.fake.live.responses).toEqual([
        { action: 'accept', promptText: 'Bob' },
      ]);
      await harness.press(named('escape'));
      expect(harness.fake.live.responses.at(-1)).toEqual({
        action: 'dismiss',
        promptText: null,
      });
    });

    it('saves and returns to the library on stop', async () => {
      const harness = setup();
      await startRecording(harness);
      harness.fake.entries = [validEntry('demo', 'Demo')];
      await harness.press(char('s'));
      expect(harness.fake.live.stopCount).toBe(1);
      expect(harness.store.getState().screen.kind).toBe('library');
      expect(
        (harness.store.getState().screen as LibraryScreen).entries,
      ).toHaveLength(1);
      expect(harness.fake.live.unsubscribeCount).toBe(1);
    });

    it('returns to the library when the browser is closed, without stopping twice', async () => {
      const harness = setup();
      await startRecording(harness);
      harness.fake.live.emit({
        events: [clickAt(1)],
        pendingDialog: null,
        isClosed: true,
      });
      await Promise.resolve();
      await Promise.resolve();
      expect(harness.store.getState().screen.kind).toBe('library');
      expect(harness.fake.live.stopCount).toBe(0);
    });

    it('never discards unless the user answers y', async () => {
      const harness = setup();
      await startRecording(harness);
      await harness.press(char('x'));
      expect(
        (harness.store.getState().screen as RecordingScreen)
          .isConfirmingDiscard,
      ).toBe(true);
      await harness.press(named('return'));
      expect(harness.fake.live.discardCount).toBe(0);
      expect(
        (harness.store.getState().screen as RecordingScreen)
          .isConfirmingDiscard,
      ).toBe(false);
      await harness.press(char('x'), char('y'));
      expect(harness.fake.live.discardCount).toBe(1);
      expect(harness.store.getState().screen.kind).toBe('library');
    });

    it('saves the recording and quits on Ctrl+C', async () => {
      const harness = setup();
      await startRecording(harness);
      await harness.press(named('c', { ctrl: true }));
      expect(harness.fake.live.stopCount).toBe(1);
      expect(harness.store.getState().isQuitting).toBe(true);
    });
  });

  describe('library', () => {
    async function openLibrary(harness: Harness): Promise<void> {
      harness.fake.entries = [
        validEntry('alpha', 'Alpha'),
        validEntry('beta', 'Beta'),
      ];
      await ready(harness);
      await harness.press(named('down'), named('return'));
    }

    it('renames inline and reloads the list', async () => {
      const harness = setup();
      await openLibrary(harness);
      await harness.press(char('r'));
      await harness.type('!');
      await harness.press(named('return'));
      expect(harness.fake.renamed).toEqual([{ slug: 'alpha', name: 'Alpha!' }]);
      expect((harness.store.getState().screen as LibraryScreen).mode).toEqual({
        kind: 'browse',
      });
    });

    it('shows a rename collision inline and stays in rename mode', async () => {
      const harness = setup();
      await openLibrary(harness);
      harness.fake.renameError = new Error(
        'A recording named "Beta" already exists',
      );
      await harness.press(char('r'), named('return'));
      const library = harness.store.getState().screen as LibraryScreen;
      expect(library.error).toBe('A recording named "Beta" already exists');
      expect(library.mode.kind).toBe('rename');
    });

    it('validates the new name before renaming', async () => {
      const harness = setup();
      await openLibrary(harness);
      await harness.press(
        char('r'),
        named('u', { ctrl: true }),
        named('return'),
      );
      expect(harness.fake.renamed).toEqual([]);
      expect((harness.store.getState().screen as LibraryScreen).error).toBe(
        'Name is required and cannot be empty.',
      );
    });

    it('cancels a rename with Escape', async () => {
      const harness = setup();
      await openLibrary(harness);
      await harness.press(char('r'), named('escape'));
      expect((harness.store.getState().screen as LibraryScreen).mode).toEqual({
        kind: 'browse',
      });
      expect(harness.fake.renamed).toEqual([]);
    });

    it('deletes only after an explicit y, then reloads', async () => {
      const harness = setup();
      await openLibrary(harness);
      await harness.press(char('d'), named('return'));
      expect(harness.fake.removed).toEqual([]);
      await harness.press(char('d'), char('n'));
      expect(harness.fake.removed).toEqual([]);
      harness.fake.entries = [validEntry('beta', 'Beta')];
      await harness.press(char('d'), char('y'));
      expect(harness.fake.removed).toEqual(['alpha']);
      expect(
        (harness.store.getState().screen as LibraryScreen).entries,
      ).toHaveLength(1);
    });

    it('shows a delete failure inline', async () => {
      const harness = setup();
      await openLibrary(harness);
      harness.fake.removeError = new Error('Permission denied');
      await harness.press(char('d'), char('y'));
      expect((harness.store.getState().screen as LibraryScreen).error).toBe(
        'Permission denied',
      );
    });

    it('opens the timeline of the selected recording and goes back', async () => {
      const harness = setup();
      await openLibrary(harness);
      await harness.press(char('t'));
      expect(harness.store.getState().screen.kind).toBe('timeline');
      await harness.press(named('escape'));
      expect(harness.store.getState().screen.kind).toBe('library');
    });

    it('refreshes the list on request only while browsing', async () => {
      const harness = setup();
      await openLibrary(harness);
      harness.fake.entries = [validEntry('gamma', 'Gamma')];
      await harness.controller.refreshLibrary();
      expect(
        (harness.store.getState().screen as LibraryScreen).entries,
      ).toHaveLength(1);
      await harness.press(char('r'));
      const before = harness.fake.listCount;
      await harness.controller.refreshLibrary();
      expect(harness.fake.listCount).toBe(before);
    });

    it('does not reload when the user is no longer on the library', async () => {
      const harness = setup();
      await ready(harness);
      const before = harness.fake.listCount;
      await harness.controller.refreshLibrary();
      expect(harness.fake.listCount).toBe(before);
    });
  });

  describe('replay', () => {
    async function startReplay(harness: Harness): Promise<void> {
      harness.fake.entries = [validEntry('alpha', 'Alpha')];
      await ready(harness);
      await harness.press(named('down'), named('return'), named('return'));
    }

    it('starts the replay of the selected recording', async () => {
      const harness = setup();
      await startReplay(harness);
      expect(harness.fake.replayed).toEqual(['alpha']);
      expect(harness.store.getState().screen).toMatchObject({
        kind: 'replay',
        name: 'Checkout flow',
      });
    });

    it('marks earlier steps done when the script reports step 2', async () => {
      const harness = setup();
      await startReplay(harness);
      harness.fake.replay.emit({
        status: 'running',
        errorMessage: null,
        steps: [
          { index: 0, status: 'done', driftMs: 3 },
          { index: 1, status: 'done', driftMs: -2 },
          { index: 2, status: 'running', driftMs: null },
        ],
      });
      const screen = harness.store.getState().screen as ReplayScreen;
      expect(screen.view.steps.map((step) => step.status)).toEqual([
        'done',
        'done',
        'running',
      ]);
    });

    it('applies the final view when the replay finishes', async () => {
      const harness = setup();
      await startReplay(harness);
      harness.fake.replay.resolveFinished({
        status: 'succeeded',
        errorMessage: null,
        steps: [{ index: 0, status: 'done', driftMs: 1 }],
      });
      await Promise.resolve();
      await Promise.resolve();
      expect(
        (harness.store.getState().screen as ReplayScreen).view.status,
      ).toBe('succeeded');
    });

    it('cancels a running replay with c', async () => {
      const harness = setup();
      await startReplay(harness);
      await harness.press(char('c'));
      expect(harness.fake.replay.cancelCount).toBe(1);
    });

    it('goes back to the library after the replay finished', async () => {
      const harness = setup();
      await startReplay(harness);
      harness.fake.replay.emit({
        status: 'failed',
        errorMessage: 'boom',
        steps: [],
      });
      await harness.press(named('escape'));
      expect(harness.store.getState().screen.kind).toBe('library');
    });

    it('cancels a running replay when quitting', async () => {
      const harness = setup();
      await startReplay(harness);
      await harness.press(named('c', { ctrl: true }));
      expect(harness.fake.replay.cancelCount).toBe(1);
      expect(harness.store.getState().isQuitting).toBe(true);
    });
  });
});
