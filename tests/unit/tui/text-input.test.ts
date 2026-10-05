import { describe, expect, it } from 'vitest';

import {
  applyEdit,
  emptyField,
  viewField,
} from '../../../src/tui/domain/text-input.ts';

describe('src/tui/domain/text-input.ts', () => {
  it('starts empty, or with the cursor after an initial value', () => {
    expect(emptyField()).toEqual({ value: '', cursor: 0 });
    expect(emptyField('Demo')).toEqual({ value: 'Demo', cursor: 4 });
  });

  it('inserts text at the cursor', () => {
    const typed = applyEdit(emptyField('ac'), { kind: 'insert', text: 'b' });
    expect(typed).toEqual({ value: 'acb', cursor: 3 });
    const middle = applyEdit(
      { value: 'ac', cursor: 1 },
      { kind: 'insert', text: 'b' },
    );
    expect(middle).toEqual({ value: 'abc', cursor: 2 });
  });

  it('drops control characters from inserted text', () => {
    const field = applyEdit(emptyField(), {
      kind: 'insert',
      text: 'a\u001b[31m\nb\u007f',
    });
    expect(field.value).toBe('a[31mb');
  });

  it('deletes the character before the cursor and stops at the start', () => {
    expect(
      applyEdit({ value: 'abc', cursor: 2 }, { kind: 'backspace' }),
    ).toEqual({
      value: 'ac',
      cursor: 1,
    });
    expect(applyEdit(emptyField('x'), { kind: 'backspace' })).toEqual(
      emptyField(),
    );
    expect(applyEdit(emptyField(), { kind: 'backspace' })).toEqual(
      emptyField(),
    );
  });

  it('clears the whole line', () => {
    expect(
      applyEdit({ value: 'abc', cursor: 1 }, { kind: 'clear-line' }),
    ).toEqual(emptyField());
  });

  it('moves the cursor within bounds', () => {
    const field = { value: 'ab', cursor: 1 };
    expect(applyEdit(field, { kind: 'move', direction: 'left' }).cursor).toBe(
      0,
    );
    expect(
      applyEdit({ value: 'ab', cursor: 0 }, { kind: 'move', direction: 'left' })
        .cursor,
    ).toBe(0);
    expect(applyEdit(field, { kind: 'move', direction: 'right' }).cursor).toBe(
      2,
    );
    expect(
      applyEdit(
        { value: 'ab', cursor: 2 },
        { kind: 'move', direction: 'right' },
      ).cursor,
    ).toBe(2);
  });

  it('shows a slice that always contains the cursor', () => {
    expect(viewField(emptyField('abc'), 10)).toEqual({
      text: 'abc',
      cursor: 3,
    });
    const long = emptyField('abcdefghij');
    expect(viewField(long, 5)).toEqual({ text: 'ghij', cursor: 4 });
    expect(viewField({ value: 'abcdefghij', cursor: 0 }, 5)).toEqual({
      text: 'abcd',
      cursor: 0,
    });
    expect(viewField({ value: 'abcdefghij', cursor: 6 }, 5)).toEqual({
      text: 'defg',
      cursor: 3,
    });
  });
});
