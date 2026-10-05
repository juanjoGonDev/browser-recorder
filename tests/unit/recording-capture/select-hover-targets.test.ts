import { describe, expect, it } from 'vitest';
import type { HoverEntry } from '../../../src/recording-capture/domain/select-hover-targets.ts';
import { selectHoverTargets } from '../../../src/recording-capture/domain/select-hover-targets.ts';

function entry(
  element: string,
  overrides: Partial<Omit<HoverEntry<string>, 'element'>> = {},
): HoverEntry<string> {
  return {
    element,
    enteredAtMs: 0,
    depth: 3,
    isAncestorOfTarget: false,
    isRoot: false,
    didMutate: false,
    ...overrides,
  };
}

describe('src/recording-capture/domain/select-hover-targets.ts', () => {
  it('selects the outermost entered ancestor for a CSS-only menu', () => {
    const trace = [
      entry('menu', { depth: 2, isAncestorOfTarget: true, enteredAtMs: 100 }),
      entry('submenu', {
        depth: 4,
        isAncestorOfTarget: true,
        enteredAtMs: 180,
      }),
    ];
    expect(selectHoverTargets(trace, 400)).toEqual([
      { element: 'menu', ageMs: 300 },
    ]);
  });

  it('picks the outermost ancestor even when the pointer entered an inner one first', () => {
    const trace = [
      entry('inner', { depth: 5, isAncestorOfTarget: true, enteredAtMs: 50 }),
      entry('outer', { depth: 2, isAncestorOfTarget: true, enteredAtMs: 90 }),
    ];
    expect(selectHoverTargets(trace, 100)).toEqual([
      { element: 'outer', ageMs: 10 },
    ]);
  });

  it('never selects html or body even though they are ancestors', () => {
    const trace = [
      entry('html', { depth: 0, isAncestorOfTarget: true, isRoot: true }),
      entry('body', { depth: 1, isAncestorOfTarget: true, isRoot: true }),
      entry('menu', { depth: 2, isAncestorOfTarget: true, enteredAtMs: 20 }),
    ];
    expect(selectHoverTargets(trace, 70)).toEqual([
      { element: 'menu', ageMs: 50 },
    ]);
  });

  it('selects the last non-ancestor whose hover mutated the DOM', () => {
    const trace = [
      entry('tooltip', { didMutate: true, enteredAtMs: 10 }),
      entry('avatar', { didMutate: true, enteredAtMs: 60 }),
      entry('banner', { didMutate: false, enteredAtMs: 90 }),
    ];
    expect(selectHoverTargets(trace, 120)).toEqual([
      { element: 'avatar', ageMs: 60 },
    ]);
  });

  it('emits nothing for pointer noise without a mutation', () => {
    const trace = [
      entry('logo', { enteredAtMs: 10 }),
      entry('footer', { enteredAtMs: 20 }),
    ];
    expect(selectHoverTargets(trace, 100)).toEqual([]);
    expect(selectHoverTargets([], 100)).toEqual([]);
  });

  it('combines both rules and orders the result by enter time', () => {
    const trace = [
      entry('menu', { depth: 2, isAncestorOfTarget: true, enteredAtMs: 200 }),
      entry('popover', { didMutate: true, enteredAtMs: 50 }),
    ];
    expect(selectHoverTargets(trace, 260)).toEqual([
      { element: 'popover', ageMs: 210 },
      { element: 'menu', ageMs: 60 },
    ]);
  });

  it('never reports a negative age', () => {
    const trace = [
      entry('menu', { isAncestorOfTarget: true, enteredAtMs: 500 }),
    ];
    expect(selectHoverTargets(trace, 450)).toEqual([
      { element: 'menu', ageMs: 0 },
    ]);
  });
});
