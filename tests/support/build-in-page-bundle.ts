import path from 'node:path';
import { bundleInPage } from '../../scripts/build.ts';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

/** Where the Playwright adapter injects the capture script from. */
export const IN_PAGE_BUNDLE_PATH = path.join(
  ROOT,
  'dist',
  'in-page',
  'capture-script.js',
);

/**
 * Vitest `globalSetup` for the integration and e2e projects: bundles the
 * in-page capture script once, so every test file can inject the same file
 * the shipped CLI does without running a full tsc build.
 */
export default async function buildInPageBundle(): Promise<void> {
  await bundleInPage(ROOT);
}
