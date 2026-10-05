import { describe, expect, it } from 'vitest';

import {
  createPainter,
  formatCancelled,
  formatFailure,
  formatSuccess,
  formatWarning,
} from '../../../src/cli/domain/format-result.ts';

const PLAIN = createPainter(false);
const COLOR = createPainter(true);

describe('src/cli/domain/format-result.ts', () => {
  it('prints the success line with whole seconds to one decimal', () => {
    expect(formatSuccess('Demo', 12_345, PLAIN)).toBe(
      '✔ Demo replayed in 12.3s',
    );
    expect(formatSuccess('Demo', 400, PLAIN)).toBe('✔ Demo replayed in 0.4s');
  });

  it('names the failing step and its kind', () => {
    expect(
      formatFailure(
        {
          name: 'Demo',
          step: { index: 2, kind: 'click' },
          message: 'locator gone',
          stderrTail: ['at x', 'at y'],
        },
        PLAIN,
      ),
    ).toStrictEqual([
      '✖ Demo failed at step 3 (click): locator gone',
      '  at x',
      '  at y',
    ]);
  });

  it('omits the step when the failure happened before any step', () => {
    expect(
      formatFailure(
        { name: 'Demo', step: null, message: 'launch failed', stderrTail: [] },
        PLAIN,
      ),
    ).toStrictEqual(['✖ Demo failed: launch failed']);
  });

  it('keeps only the first line of a multi-line message in the summary', () => {
    const [summary] = formatFailure(
      {
        name: 'Demo',
        step: { index: 0, kind: 'fill' },
        message: 'Timeout 10000ms exceeded.\nCall log:\n  - waiting',
        stderrTail: [],
      },
      PLAIN,
    );
    expect(summary).toBe(
      '✖ Demo failed at step 1 (fill): Timeout 10000ms exceeded.',
    );
  });

  it('strips control characters from every untrusted part', () => {
    const lines = formatFailure(
      {
        name: 'Evil\u001b[2J',
        step: null,
        message: 'boom\u0007',
        stderrTail: ['tail\u001b[0m'],
      },
      PLAIN,
    );
    expect(lines.join('\n')).not.toMatch(/\u001b|\u0007/u);
  });

  it('prints the cancellation and the warning lines', () => {
    expect(formatCancelled('Demo', PLAIN)).toBe('■ Demo cancelled');
    expect(formatWarning('Brave is not installed here.')).toBe(
      '! Brave is not installed here.',
    );
  });

  it('paints only when color is on', () => {
    expect(formatSuccess('Demo', 1000, COLOR)).toContain('\u001b[');
    expect(formatSuccess('Demo', 1000, PLAIN)).not.toContain('\u001b[');
    expect(formatCancelled('Demo', COLOR)).toContain('\u001b[');
    expect(
      formatFailure(
        { name: 'Demo', step: null, message: 'x', stderrTail: ['t'] },
        COLOR,
      ).join(''),
    ).toContain('\u001b[');
  });
});
