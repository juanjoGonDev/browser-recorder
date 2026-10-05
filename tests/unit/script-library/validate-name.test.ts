import { describe, expect, it } from 'vitest';

import { validateName } from '../../../src/script-library/domain/validate-name.ts';

describe('validateName', () => {
  it('accepts a normal name', () => {
    expect(validateName('Login Flow')).toBeNull();
  });

  it('accepts the 1 and 80 character bounds', () => {
    expect(validateName('a')).toBeNull();
    expect(validateName('a'.repeat(80))).toBeNull();
  });

  it('rejects an empty or blank name', () => {
    expect(validateName('')).toMatch(/empty|required/i);
    expect(validateName('   ')).toMatch(/empty|required/i);
  });

  it('rejects a name over 80 characters', () => {
    expect(validateName('a'.repeat(81))).toMatch(/80/);
  });

  it.each(['bad\u0000name', 'tab\there', 'new\nline', 'del\u007f'])(
    'rejects control characters in %j',
    (name) => {
      expect(validateName(name)).toMatch(/control/i);
    },
  );
});
