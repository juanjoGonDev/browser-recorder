import { describe, expect, it } from 'vitest';

import { exitCodeFor } from '../../../src/cli/domain/exit-code.ts';

describe('src/cli/domain/exit-code.ts', () => {
  it('maps every outcome to its documented code', () => {
    expect(exitCodeFor({ kind: 'success' })).toBe(0);
    expect(exitCodeFor({ kind: 'failure' })).toBe(1);
    expect(exitCodeFor({ kind: 'usage' })).toBe(2);
  });

  it('adds 128 to the signal number on an interrupt', () => {
    expect(exitCodeFor({ kind: 'interrupted', signal: 'SIGINT' })).toBe(130);
    expect(exitCodeFor({ kind: 'interrupted', signal: 'SIGTERM' })).toBe(143);
    expect(exitCodeFor({ kind: 'interrupted', signal: 'SIGBREAK' })).toBe(149);
  });
});
