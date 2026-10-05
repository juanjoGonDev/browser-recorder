import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import buildInPageBundle, {
  IN_PAGE_BUNDLE_PATH,
} from '../../support/build-in-page-bundle.ts';

describe('tests/support/build-in-page-bundle.ts', () => {
  it('writes the in-page bundle as a classic script with no module syntax', async () => {
    await buildInPageBundle();
    const bundle = readFileSync(IN_PAGE_BUNDLE_PATH, 'utf8');

    expect(bundle.length).toBeGreaterThan(0);
    expect(bundle).not.toMatch(/^\s*import[\s{]/m);
    expect(bundle).not.toMatch(/^\s*export[\s{]/m);
  });
});
