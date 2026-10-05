import { describe, expect, it } from 'vitest';

import { validateStartUrl } from '../../../src/script-library/domain/validate-start-url.ts';

describe('validateStartUrl', () => {
  it.each(['', '  ', 'http://localhost:3000/x', 'https://example.com'])(
    'accepts %j',
    (url) => {
      expect(validateStartUrl(url)).toBeNull();
    },
  );

  it.each([
    'example.com',
    'ftp://example.com',
    'javascript:alert(1)',
    'http://',
  ])('rejects %j', (url) => {
    expect(validateStartUrl(url)).toMatch(/http/i);
  });
});
