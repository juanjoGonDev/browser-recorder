import { describe, expect, it } from 'vitest';

import { BUNDLED_EPHEMERAL } from '../../../src/shared/domain/browser-choice.ts';
import type { BrowserChoice } from '../../../src/shared/domain/browser-choice.ts';
import type { AppAction } from '../../../src/tui/domain/app-action.ts';
import type {
  AppState,
  LibraryScreen,
} from '../../../src/tui/domain/app-state.ts';
import type { LibraryEntryView } from '../../../src/tui/domain/app-views.ts';
import {
  appReducer,
  initialState,
} from '../../../src/tui/domain/app-reducer.ts';
import { BRAVE_CHOICE } from '../../support/browser-fixtures.ts';
import { BROWSER_VIEWS, validEntry } from '../../support/tui-fixtures.ts';

const COPY_OF_DEFAULT = {
  browserId: 'brave',
  profileMode: 'copy-of-real',
  sourceProfile: 'Default',
} as const;

function run(state: AppState, ...actions: AppAction[]): AppState {
  return actions.reduce(appReducer, state);
}

function libraryWith(entries: readonly LibraryEntryView[]): AppState {
  return run(
    initialState(),
    { type: 'navigate', target: 'library' },
    { type: 'library-loaded', entries },
  );
}

function libraryScreen(state: AppState): LibraryScreen {
  if (state.screen.kind !== 'library') throw new Error('not the library');
  return state.screen;
}

function modeOf(state: AppState) {
  return libraryScreen(state).mode;
}

describe('src/tui/domain/reduce-browser-change.ts', () => {
  describe('begin-browser-change', () => {
    it('opens the mode on the selected recording and its current choice', () => {
      const state = run(
        libraryWith([
          validEntry('a', 'A', { browser: COPY_OF_DEFAULT }),
          validEntry('b', 'B'),
        ]),
        { type: 'move-selection', delta: 1 },
        { type: 'begin-browser-change' },
      );
      expect(modeOf(state)).toEqual({
        kind: 'change-browser',
        slug: 'b',
        current: BUNDLED_EPHEMERAL,
        focus: 'browser',
        browsers: null,
        browserIndex: 0,
        profileIndex: 0,
      });
      const first = run(
        libraryWith([validEntry('a', 'A', { browser: COPY_OF_DEFAULT })]),
        { type: 'begin-browser-change' },
      );
      expect(modeOf(first)).toMatchObject({
        slug: 'a',
        current: COPY_OF_DEFAULT,
      });
    });

    it('does nothing for an empty library or an unreadable entry', () => {
      const empty = libraryWith([]);
      expect(run(empty, { type: 'begin-browser-change' })).toEqual(empty);
      const broken = libraryWith([
        { kind: 'invalid', slug: 'x', reason: 'bad' },
      ]);
      expect(run(broken, { type: 'begin-browser-change' })).toEqual(broken);
    });

    it('clears a previous error and keeps the slug through a refresh', () => {
      const state = run(
        libraryWith([validEntry('a'), validEntry('b')]),
        { type: 'library-error', message: 'old' },
        { type: 'begin-browser-change' },
        { type: 'library-loaded', entries: [validEntry('b'), validEntry('a')] },
      );
      expect(libraryScreen(state).error).toBeNull();
      expect(modeOf(state)).toMatchObject({ slug: 'a' });
    });
  });

  describe('browsers-loaded', () => {
    const begin = (browser: BrowserChoice = COPY_OF_DEFAULT): AppState =>
      run(libraryWith([validEntry('a', 'A', { browser })]), {
        type: 'begin-browser-change',
      });

    it('preselects the current browser and profile', () => {
      const state = run(begin(), {
        type: 'browsers-loaded',
        browsers: BROWSER_VIEWS,
      });
      expect(modeOf(state)).toMatchObject({
        browsers: BROWSER_VIEWS,
        browserIndex: 0,
        profileIndex: 1,
      });
    });

    it('preselects the first option when the browser is not detected', () => {
      const opera = {
        browserId: 'opera',
        profileMode: 'managed',
        sourceProfile: null,
      } as const;
      const state = run(begin(opera), {
        type: 'browsers-loaded',
        browsers: BROWSER_VIEWS,
      });
      expect(modeOf(state)).toMatchObject({ browserIndex: 0, profileIndex: 0 });
    });

    it('is ignored once the mode was cancelled', () => {
      const cancelled = run(begin(), { type: 'cancel-mode' });
      const after = run(cancelled, {
        type: 'browsers-loaded',
        browsers: BROWSER_VIEWS,
      });
      expect(modeOf(after)).toEqual({ kind: 'browse' });
    });

    it('reports a detection failure and leaves an empty list', () => {
      const state = run(begin(), { type: 'browsers-failed', message: 'boom' });
      expect(modeOf(state)).toMatchObject({ browsers: [] });
      expect(libraryScreen(state).error).toBe('boom');
    });
  });

  describe('picker fields', () => {
    const loaded = (): AppState =>
      run(
        libraryWith([validEntry('a', 'A', { browser: BRAVE_CHOICE })]),
        { type: 'begin-browser-change' },
        { type: 'browsers-loaded', browsers: BROWSER_VIEWS },
      );

    it('switches the focus between browser and profile', () => {
      const profile = run(loaded(), { type: 'switch-field' });
      expect(modeOf(profile)).toMatchObject({ focus: 'profile' });
      expect(modeOf(run(profile, { type: 'switch-field' }))).toMatchObject({
        focus: 'browser',
      });
    });

    it('cycles the focused field and restarts the profile on a new browser', () => {
      const profile = run(
        loaded(),
        { type: 'switch-field' },
        { type: 'cycle-option', delta: 1 },
      );
      expect(modeOf(profile)).toMatchObject({
        browserIndex: 0,
        profileIndex: 1,
      });
      const browser = run(
        profile,
        { type: 'switch-field' },
        { type: 'cycle-option', delta: 1 },
      );
      expect(modeOf(browser)).toMatchObject({
        browserIndex: 1,
        profileIndex: 0,
      });
    });

    it('clears an error once the user changes the choice', () => {
      const failed = run(loaded(), { type: 'library-error', message: 'x' });
      expect(
        libraryScreen(run(failed, { type: 'cycle-option', delta: 1 })).error,
      ).toBeNull();
    });

    it('leaves the library browse mode alone', () => {
      const browse = libraryWith([validEntry('a')]);
      expect(
        modeOf(
          run(
            browse,
            { type: 'switch-field' },
            { type: 'cycle-option', delta: 1 },
          ),
        ),
      ).toEqual({
        kind: 'browse',
      });
    });
  });

  it('closes with cancel-mode', () => {
    const state = run(
      libraryWith([validEntry('a')]),
      { type: 'begin-browser-change' },
      { type: 'cancel-mode' },
    );
    expect(modeOf(state)).toEqual({ kind: 'browse' });
  });
});
