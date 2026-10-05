import { describe, expect, it } from 'vitest';
import { filterStableClasses } from '../../../src/recording-capture/domain/filter-stable-classes.ts';

describe('src/recording-capture/domain/filter-stable-classes.ts', () => {
  it('keeps semantic component classes', () => {
    expect(
      filterStableClasses(['btn-primary', 'nav-item', 'search-box__input']),
    ).toEqual(['btn-primary', 'nav-item', 'search-box__input']);
  });

  it.each([
    ['css-1a2b3c', 'an Emotion hash'],
    ['sc-bdfBwQ', 'a styled-components hash'],
    ['jss123', 'a JSS counter'],
    ['jsx-1234567890', 'a styled-jsx hash'],
    ['Button_root__3kF9s', 'a CSS modules hash'],
    ['_a1B2c3', 'a leading-underscore hash'],
  ])('drops %s (%s)', (className) => {
    expect(filterStableClasses(['card', className])).toEqual(['card']);
  });

  it.each([
    'flex',
    'hidden',
    'p-4',
    '-mt-2',
    'mt-2',
    'w-1/2',
    'text-sm',
    'bg-red-500',
    'hover:bg-blue-600',
    'md:flex',
    'w-[320px]',
    'd-flex',
    'items-center',
    'justify-between',
  ])('drops the utility class %s', (className) => {
    expect(filterStableClasses(['card', className])).toEqual(['card']);
  });

  it('keeps semantic classes that merely start like a utility', () => {
    expect(
      filterStableClasses(['text-field', 'border-box', 'css-grid', 'flexbox']),
    ).toEqual(['text-field', 'border-box', 'css-grid', 'flexbox']);
  });

  it('keeps the original order and returns nothing for all-generated input', () => {
    expect(filterStableClasses(['z-last', 'a-first'])).toEqual([
      'z-last',
      'a-first',
    ]);
    expect(filterStableClasses(['css-9x8y7z', 'flex', 'p-2'])).toEqual([]);
  });
});
