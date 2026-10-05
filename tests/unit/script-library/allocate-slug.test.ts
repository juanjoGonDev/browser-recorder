import { describe, expect, it } from 'vitest';

import { allocateSlug } from '../../../src/script-library/domain/allocate-slug.ts';

describe('allocateSlug', () => {
  it('keeps the base slug when it is free', () => {
    expect(allocateSlug('login-flow', ['other'])).toBe('login-flow');
  });

  it('appends -2 on the first collision', () => {
    expect(allocateSlug('login-flow', ['login-flow'])).toBe('login-flow-2');
  });

  it('keeps counting past taken suffixes', () => {
    expect(allocateSlug('login-flow', ['login-flow', 'login-flow-2'])).toBe(
      'login-flow-3',
    );
  });

  it('reuses a gap left by a deleted recording', () => {
    expect(allocateSlug('a', ['a', 'a-3'])).toBe('a-2');
  });
});
