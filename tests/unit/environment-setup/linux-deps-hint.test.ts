import { describe, expect, it } from 'vitest';

import {
  linuxDepsHint,
  LINUX_DEPS_COMMAND,
} from '../../../src/environment-setup/domain/linux-deps-hint.ts';

const MISSING_LIBS =
  'browserType.launch: Host system is missing dependencies to run browsers.';
const SHARED_LIB =
  'chrome: error while loading shared libraries: libnss3.so: cannot open shared object file';

describe('linuxDepsHint', () => {
  it('prints the install-deps and with-deps commands for missing libraries on linux', () => {
    const hint = linuxDepsHint('linux', MISSING_LIBS);

    expect(hint).toContain('sudo pnpm exec playwright install-deps chromium');
    expect(hint).toContain('playwright install --with-deps chromium');
    expect(hint).toContain(LINUX_DEPS_COMMAND);
  });

  it('recognises a dynamic loader error', () => {
    expect(linuxDepsHint('linux', SHARED_LIB)).not.toBeNull();
  });

  it('stays silent on other platforms', () => {
    expect(linuxDepsHint('darwin', MISSING_LIBS)).toBeNull();
    expect(linuxDepsHint('win32', SHARED_LIB)).toBeNull();
  });

  it('stays silent for unrelated launch errors', () => {
    expect(linuxDepsHint('linux', 'Timeout 30000ms exceeded')).toBeNull();
  });
});
