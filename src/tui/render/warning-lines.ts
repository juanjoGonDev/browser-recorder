import { sanitize } from './layout.ts';
import type { RenderContext } from './screen-view.ts';

/** One visible line per caution; the text may come from the file system. */
export function warningLines(
  warnings: readonly string[],
  context: RenderContext,
): string[] {
  return warnings.map((warning) =>
    context.style.warning(`! ${sanitize(warning)}`),
  );
}
