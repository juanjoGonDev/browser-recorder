import { describe, expect, it } from 'vitest';

import {
  ACTIVATION_MUTATION_WINDOW_MS,
  isCausedByActivation,
} from '../../../src/recording-capture/domain/is-caused-by-activation.ts';

const ACTIVATED_AT_MS = 1000;

describe('src/recording-capture/domain/is-caused-by-activation.ts', () => {
  it('uses a window of 400 ms', () => {
    expect(ACTIVATION_MUTATION_WINDOW_MS).toBe(400);
  });

  it('never blames an activation that did not happen', () => {
    expect(isCausedByActivation(ACTIVATED_AT_MS, null)).toBe(false);
  });

  it('blames a mutation in the same instant', () => {
    expect(isCausedByActivation(ACTIVATED_AT_MS, ACTIVATED_AT_MS)).toBe(true);
  });

  it('blames a mutation 1 ms before the window closes', () => {
    expect(isCausedByActivation(ACTIVATED_AT_MS + 399, ACTIVATED_AT_MS)).toBe(
      true,
    );
  });

  it('stops blaming at the end of the window', () => {
    expect(isCausedByActivation(ACTIVATED_AT_MS + 400, ACTIVATED_AT_MS)).toBe(
      false,
    );
    expect(isCausedByActivation(ACTIVATED_AT_MS + 5000, ACTIVATED_AT_MS)).toBe(
      false,
    );
  });

  it('does not blame a mutation that came before the activation', () => {
    expect(isCausedByActivation(ACTIVATED_AT_MS - 1, ACTIVATED_AT_MS)).toBe(
      false,
    );
  });
});
