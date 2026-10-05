import { describe, expect, it } from 'vitest';

import { emptyField } from '../../../src/tui/domain/text-input.ts';
import { createStyle } from '../../../src/tui/render/ansi.ts';
import { renderField } from '../../../src/tui/render/field-view.ts';

const plain = createStyle(false);
const color = createStyle(true);

describe('src/tui/render/field-view.ts', () => {
  it('marks the cursor with a bar when color is off', () => {
    const spec = {
      field: { value: 'abc', cursor: 1 },
      width: 20,
      isFocused: true,
      placeholder: 'hint',
    };
    expect(renderField(spec, plain)).toBe('a▏bc');
    expect(renderField({ ...spec, field: emptyField('abc') }, plain)).toBe(
      'abc▏',
    );
  });

  it('marks the cursor with reverse video when color is on', () => {
    const spec = {
      field: { value: 'abc', cursor: 1 },
      width: 20,
      isFocused: true,
      placeholder: 'hint',
    };
    expect(renderField(spec, color)).toBe('a\u001b[7mb\u001b[27mc');
    expect(renderField({ ...spec, field: emptyField('abc') }, color)).toBe(
      'abc\u001b[7m \u001b[27m',
    );
  });

  it('shows the placeholder only for an empty unfocused field', () => {
    const base = {
      field: emptyField(),
      width: 20,
      isFocused: false,
      placeholder: 'hint',
    };
    expect(renderField(base, plain)).toBe('hint');
    expect(renderField({ ...base, field: emptyField('x') }, plain)).toBe('x');
    expect(renderField({ ...base, isFocused: true }, plain)).toBe('▏');
  });

  it('scrolls long values so the end stays visible', () => {
    const spec = {
      field: emptyField('abcdefghij'),
      width: 6,
      isFocused: true,
      placeholder: '',
    };
    expect(renderField(spec, plain)).toBe('fghij▏');
  });
});
