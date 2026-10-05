import { describe, expect, it } from 'vitest';

import {
  isValidSlug,
  slugify,
} from '../../../src/script-library/domain/slugify.ts';

describe('slugify', () => {
  it('strips separators, quotes and dot segments from an unsafe name', () => {
    expect(slugify('../My Test: "A/B"')).toBe('my-test-a-b');
  });

  it('folds diacritics to ASCII', () => {
    expect(slugify('Café Ñandú')).toBe('cafe-nandu');
  });

  it('limits the slug to 60 characters without a trailing hyphen', () => {
    const slug = slugify(`${'a'.repeat(59)} bbb`);
    expect(slug).toBe('a'.repeat(59));
    expect(slugify('x'.repeat(100))).toHaveLength(60);
  });

  it('falls back for empty or symbol-only names', () => {
    expect(slugify('')).toBe('recording');
    expect(slugify('***')).toBe('recording');
  });

  it.each(['CON', 'nul', 'Com1', 'LPT9', 'aux'])(
    'does not return the Windows reserved name %s',
    (name) => {
      const slug = slugify(name);
      expect(slug).not.toBe(name.toLowerCase());
      expect(isValidSlug(slug)).toBe(true);
    },
  );

  it('keeps a name that merely starts with a reserved word', () => {
    expect(slugify('console log')).toBe('console-log');
  });
});

describe('isValidSlug', () => {
  it.each(['login-flow', 'a', 'a1-b2'])('accepts %s', (slug) => {
    expect(isValidSlug(slug)).toBe(true);
  });

  it.each(['../x', 'a/b', 'C:\\x', 'has space', '', 'A', '-a', 'a-', 'a--b'])(
    'rejects %j',
    (slug) => {
      expect(isValidSlug(slug)).toBe(false);
    },
  );
});
