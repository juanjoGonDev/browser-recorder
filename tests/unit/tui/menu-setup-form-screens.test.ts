import { describe, expect, it } from 'vitest';

import type {
  MainMenuScreen,
  NewRecordingScreen,
  SetupScreen,
} from '../../../src/tui/domain/app-state.ts';
import { emptyField } from '../../../src/tui/domain/text-input.ts';
import { createStyle } from '../../../src/tui/render/ansi.ts';
import { renderMainMenuScreen } from '../../../src/tui/render/screens/main-menu-screen.ts';
import { renderNewRecordingScreen } from '../../../src/tui/render/screens/new-recording-screen.ts';
import { renderSetupScreen } from '../../../src/tui/render/screens/setup-screen.ts';
import { plainContext } from '../../support/render-context.ts';
import { newRecordingScreen } from '../../support/tui-fixtures.ts';

describe('src/tui/render/screens (main menu, setup, new recording)', () => {
  describe('main menu', () => {
    const screen = (selected: number): MainMenuScreen => ({
      kind: 'main-menu',
      selected,
    });

    it('lists the entries and marks the selected one', () => {
      const view = renderMainMenuScreen(screen(1), plainContext());
      expect(view.title).toBe('browser-recorder');
      expect(view.body).toContain('    New recording');
      expect(view.body).toContain('  ❯ Library');
      expect(view.body).toContain('    Quit');
      expect(renderMainMenuScreen(screen(0), plainContext()).body).toContain(
        '  ❯ New recording',
      );
    });

    it('shows the Linux dependency hint only when there is one', () => {
      const hint = 'sudo pnpm exec playwright install-deps chromium';
      const withHint = renderMainMenuScreen(
        screen(0),
        plainContext({ linuxHint: hint }),
      );
      expect(withHint.body.join('\n')).toContain(`! ${hint}`);
      expect(
        renderMainMenuScreen(screen(0), plainContext()).body.join('\n'),
      ).not.toContain('!');
    });

    it('shows why recording is disabled and leaves the library entry alone', () => {
      const text = renderMainMenuScreen(
        screen(0),
        plainContext({ isBrowserAvailable: false }),
      ).body.join('\n');
      expect(text).toContain('New recording (needs Chromium)');
      expect(text).toContain('recording and replay are disabled');
      expect(text).toContain('Library');
      expect(text).not.toContain('Library (');
      const available = renderMainMenuScreen(screen(0), plainContext()).body;
      expect(available.join('\n')).not.toContain('needs Chromium');
    });

    it('advertises its keys', () => {
      const keys = renderMainMenuScreen(screen(0), plainContext()).hints.map(
        (hint) => hint.key,
      );
      expect(keys).toEqual(['↑↓', 'enter', 'q']);
    });
  });

  describe('setup', () => {
    const base: SetupScreen = {
      kind: 'setup',
      phase: 'checking',
      lines: [],
      manualCommand: null,
      exitCode: null,
    };

    it('shows a spinner while checking and installing', () => {
      const checking = renderSetupScreen(base, plainContext({ nowMs: 80 }));
      expect(checking.body.join('\n')).toContain('⠙ Checking for Chromium…');
      const installing = renderSetupScreen(
        { ...base, phase: 'installing', lines: ['downloading 10%'] },
        plainContext(),
      );
      expect(installing.body.join('\n')).toContain('Installing Chromium');
      expect(installing.body.join('\n')).toContain('downloading 10%');
      expect(installing.hints.map((hint) => hint.key)).toEqual(['q']);
    });

    it('shows only the newest installer lines that fit', () => {
      const lines = Array.from({ length: 40 }, (_, i) => `line ${String(i)}`);
      const view = renderSetupScreen(
        { ...base, phase: 'installing', lines },
        plainContext({ height: 8 }),
      );
      const text = view.body.join('\n');
      expect(text).toContain('line 39');
      expect(text).not.toContain('line 0');
      expect(view.body.length).toBeLessThanOrEqual(8);
    });

    it('offers the manual command and a retry after a failure', () => {
      const failed: SetupScreen = {
        ...base,
        phase: 'failed',
        manualCommand: 'pnpm exec playwright install chromium',
        exitCode: 1,
      };
      const view = renderSetupScreen(failed, plainContext());
      expect(view.body.join('\n')).toContain(
        'Chromium could not be installed.',
      );
      expect(view.body.join('\n')).toContain(
        'pnpm exec playwright install chromium',
      );
      expect(view.hints.map((hint) => hint.key)).toEqual(['enter', 'l', 'q']);
    });

    it('says the library stays available while recording and replay are off', () => {
      const text = renderSetupScreen(
        { ...base, phase: 'failed', manualCommand: 'cmd', exitCode: 1 },
        plainContext(),
      ).body.join('\n');
      expect(text).toContain('library');
      expect(text).toContain('recording and replay are disabled');
    });

    it('displays the installer exit code on failure', () => {
      const failedWith = (exitCode: number | null): string =>
        renderSetupScreen(
          {
            ...base,
            phase: 'failed',
            manualCommand: 'pnpm exec playwright install chromium',
            exitCode,
          },
          plainContext(),
        ).body.join('\n');
      expect(failedWith(7)).toContain('exit code 7');
      expect(failedWith(137)).toContain('exit code 137');
      expect(failedWith(null)).not.toContain('exit code');
    });
  });

  describe('new recording', () => {
    const form: NewRecordingScreen = newRecordingScreen({
      name: emptyField('Demo'),
    });

    it('shows the focused field with a cursor and the placeholder of the other', () => {
      const text = renderNewRecordingScreen(form, plainContext()).body.join(
        '\n',
      );
      expect(text).toContain('▌ Demo▏');
      expect(text).toContain('│ https://example.com');
      expect(text).toContain('Leave the URL empty to start on a blank page.');
    });

    it('moves the cursor to the URL when it has focus', () => {
      const text = renderNewRecordingScreen(
        { ...form, startUrl: emptyField('ftp://x'), focus: 'url' },
        plainContext(),
      ).body.join('\n');
      expect(text).toContain('▌ ftp://x▏');
      expect(text).toContain('│ Demo');
    });

    it('replaces the help with an inline error', () => {
      const view = renderNewRecordingScreen(
        { ...form, error: 'URL must start with http:// or https://' },
        plainContext(),
      );
      const text = view.body.join('\n');
      expect(text).toContain('✖ URL must start with http:// or https://');
      expect(text).not.toContain('Leave the URL empty');
    });

    it('colors the error when color is on', () => {
      const view = renderNewRecordingScreen(
        { ...form, error: 'bad' },
        plainContext({ style: createStyle(true) }),
      );
      expect(view.body.join('\n')).toContain('\u001b[31mbad');
    });
  });
});
