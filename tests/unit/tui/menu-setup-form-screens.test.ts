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
import {
  BROWSER_VIEWS,
  newRecordingScreen,
} from '../../support/tui-fixtures.ts';

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

    describe('pickers', () => {
      const loaded = (
        overrides: Partial<NewRecordingScreen> = {},
      ): NewRecordingScreen =>
        newRecordingScreen({ browsers: BROWSER_VIEWS, ...overrides });
      const textOf = (screen: NewRecordingScreen): string =>
        renderNewRecordingScreen(screen, plainContext()).body.join('\n');

      it('says the browsers are still being detected', () => {
        const text = textOf(newRecordingScreen());
        expect(text).toContain('Detecting browsers…');
        expect(textOf(loaded())).not.toContain('Detecting browsers…');
      });

      it('shows the chosen browser and profile with their position', () => {
        const text = textOf(loaded());
        expect(text).toContain('Brave');
        expect(text).toContain('Managed (keeps logins)');
        expect(text).toContain('1/2');
        expect(text).toContain('1/3');
        const second = textOf(loaded({ browserIndex: 1 }));
        expect(second).toContain('Chromium (bundled)');
        expect(second).toContain('Ephemeral (clean each time)');
        expect(second).not.toContain('Managed (keeps logins)');
      });

      it('marks the focused picker with arrows that survive NO_COLOR', () => {
        const browserFocus = textOf(loaded({ focus: 'browser' }));
        expect(browserFocus).toContain('◂ Brave ▸');
        expect(browserFocus).not.toContain('◂ Managed');
        const profileFocus = textOf(loaded({ focus: 'profile' }));
        expect(profileFocus).toContain('◂ Managed (keeps logins) ▸');
        expect(profileFocus).not.toContain('◂ Brave');
      });

      it('shows the note of the chosen profile and none for a clean one', () => {
        const copy = textOf(loaded({ profileIndex: 1 }));
        expect(copy).toContain('Copy of Person 1 (Default)');
        expect(copy).toContain(
          '! Brave is running: the copy may miss its latest changes',
        );
        expect(textOf(loaded())).not.toContain('Brave is running');
      });

      it('offers only the bundled browser, preselected, when nothing else is detected', () => {
        const text = textOf(
          loaded({ browsers: BROWSER_VIEWS.slice(1), focus: 'browser' }),
        );
        expect(text).toContain('◂ Chromium (bundled) ▸');
        expect(text).toContain('1/1');
        expect(text).not.toContain('Brave');
      });

      it('shows nothing to pick when detection found no browser', () => {
        const text = textOf(loaded({ browsers: [] }));
        expect(text).toContain('No browser detected');
        expect(text).not.toContain('Detecting browsers…');
      });

      it('strips control characters from profile names read from the disk', () => {
        const hostile = [
          {
            browserId: 'brave' as const,
            label: 'Brave',
            profiles: [
              {
                choice: BROWSER_VIEWS[0]?.profiles[0]?.choice ?? {
                  browserId: 'brave' as const,
                  profileMode: 'managed' as const,
                  sourceProfile: null,
                },
                label: 'Copy of \u001b[2JEvil',
                note: null,
              },
            ],
          },
        ];
        const text = textOf(loaded({ browsers: hostile }));
        expect(text).toContain('Copy of ·[2JEvil');
        expect(text).not.toContain('\u001b');
      });

      it('advertises the arrow keys only when a picker has the focus', () => {
        const keys = (focus: NewRecordingScreen['focus']): string[] =>
          renderNewRecordingScreen(loaded({ focus }), plainContext()).hints.map(
            (hint) => hint.key,
          );
        expect(keys('browser')).toContain('←→');
        expect(keys('profile')).toContain('←→');
        expect(keys('name')).not.toContain('←→');
      });
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
