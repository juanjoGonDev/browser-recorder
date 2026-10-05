import { describe, expect, it } from 'vitest';
import { isDynamicId } from '../../../src/recording-capture/domain/is-dynamic-id.ts';

describe('src/recording-capture/domain/is-dynamic-id.ts', () => {
  describe('ids generated at runtime', () => {
    it.each([
      ['item-12345', 'a run of four digits'],
      ['row_20240115', 'a date-like digit run'],
      ['550e8400-e29b-41d4-a716-446655440000', 'a uuid'],
      ['a1b2c3d4e5', 'a hex run of ten'],
      ['deadbeef', 'a hex run of eight'],
      [':r1:', 'a React useId value'],
      [':R2a5t6:', 'an uppercase React useId value'],
      ['radix-:r3:-trigger', 'a Radix id'],
      ['headlessui-menu-button-:r5:', 'a Headless UI id'],
      ['mui-98765', 'a MUI id'],
      ['mui-component-select-age', 'a MUI id without digits'],
      ['ember123', 'an Ember view id'],
    ])('treats %s as dynamic (%s)', (id) => {
      expect(isDynamicId(id)).toBe(true);
    });
  });

  describe('ids written by a person', () => {
    it.each([
      'submit-button',
      'user-42',
      'main-content',
      'email',
      'feedback-form',
      'step-3-of-5',
      'ember',
      'emberjs-docs',
      'remember1',
      'decade-12',
    ])('treats %s as stable', (id) => {
      expect(isDynamicId(id)).toBe(false);
    });

    it('treats an empty id as stable because there is nothing generated in it', () => {
      expect(isDynamicId('')).toBe(false);
    });
  });
});
