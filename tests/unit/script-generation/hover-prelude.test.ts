import { describe, expect, it } from 'vitest';

import type { FakeLocator } from '../../support/load-hover-prelude.ts';
import { loadHoverPrelude } from '../../support/load-hover-prelude.ts';

const { hoverTimeoutMs, createHovering } = loadHoverPrelude();
const TIMEOUT_MS = 2000;

function hoveringAt(step: number | null): {
  hover: (locator: FakeLocator | null) => Promise<void>;
  lines: string[];
} {
  const lines: string[] = [];
  const hovering = createHovering({
    timeoutMs: TIMEOUT_MS,
    print: (line) => lines.push(line),
    describeStep: () => step,
  });
  return { hover: hovering.hover, lines };
}

function rejecting(message: string): FakeLocator {
  return { hover: () => Promise.reject(new Error(message)) };
}

describe('src/script-generation/domain/hover-prelude.ts', () => {
  it('waits two seconds for a hover by default', () => {
    expect(hoverTimeoutMs).toBe(TIMEOUT_MS);
  });

  it('prints nothing when the hover works, and hands the timeout to the locator', async () => {
    const seen: number[] = [];
    const { hover, lines } = hoveringAt(2);
    await hover({
      hover: (options) => {
        seen.push(options.timeout);
        return Promise.resolve();
      },
    });
    expect(seen).toStrictEqual([TIMEOUT_MS]);
    expect(lines).toStrictEqual([]);
  });

  it('prints one warning that names the 1-based step when the hover is rejected', async () => {
    const { hover, lines } = hoveringAt(14);
    await hover(rejecting('Timeout 2000ms exceeded.'));
    expect(lines).toStrictEqual([
      '::warn "Skipped the hover of step 15: Timeout 2000ms exceeded."',
    ]);
  });

  it('names a different step for a different position', async () => {
    const { hover, lines } = hoveringAt(0);
    await hover(rejecting('Element is not visible'));
    expect(lines).toStrictEqual([
      '::warn "Skipped the hover of step 1: Element is not visible"',
    ]);
  });

  it('keeps only the first line of the error, so no page markup leaks', async () => {
    const { hover, lines } = hoveringAt(3);
    await hover(
      rejecting('locator.hover: Timeout 2000ms exceeded.\n  - <p>secret</p>'),
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(
      '::warn "Skipped the hover of step 4: locator.hover: Timeout 2000ms exceeded."',
    );
  });

  it('never throws, even for a missing target', async () => {
    const { hover, lines } = hoveringAt(5);
    await expect(hover(null)).resolves.toBeUndefined();
    expect(lines).toStrictEqual([
      '::warn "Skipped the hover of step 6: the target was not found"',
    ]);
  });

  it('describes an unknown step without crashing', async () => {
    const { hover, lines } = hoveringAt(null);
    await hover(rejecting('boom'));
    expect(lines).toStrictEqual(['::warn "Skipped the hover of step -: boom"']);
  });
});
