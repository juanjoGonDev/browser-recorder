import { createStyle } from '../../src/tui/render/ansi.ts';
import type { RenderContext } from '../../src/tui/render/screen-view.ts';

/** An 80x24 terminal's content area, without color so assertions read plainly. */
export function plainContext(
  overrides: Partial<RenderContext> = {},
): RenderContext {
  return {
    width: 76,
    height: 21,
    style: createStyle(false),
    nowMs: 0,
    linuxHint: null,
    isBrowserAvailable: true,
    detectedBrowsers: [],
    ...overrides,
  };
}
