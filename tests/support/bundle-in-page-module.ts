import path from 'node:path';
import esbuild from 'esbuild';
import type { Page } from 'patchright';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
/** The global the bundled module's exports are reachable from in the page. */
export const MODULE_GLOBAL = 'inPageKit';

/**
 * Bundles one in-page module into a classic script that exposes its exports
 * as `window.inPageKit`, so a test can call pure DOM helpers inside real Chromium
 * without going through the whole capture script.
 */
export async function bundleModule(sourcePath: string): Promise<string> {
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, sourcePath)],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: MODULE_GLOBAL,
    platform: 'browser',
    target: 'es2023',
    legalComments: 'none',
  });
  const output = result.outputFiles.at(0);
  if (output === undefined)
    throw new Error(`esbuild emitted nothing for ${sourcePath}`);
  return output.text;
}

/** Loads the module into the page; call before `page.evaluate`. */
export async function loadModule(
  page: Page,
  sourcePath: string,
): Promise<void> {
  await page.addScriptTag({ content: await bundleModule(sourcePath) });
}
