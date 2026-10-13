import { describe, expect, it } from 'vitest';

import {
  LINUX_DEPS_COMMAND,
  LINUX_INSTALL_WITH_DEPS_COMMAND,
  MANUAL_INSTALL_COMMAND,
  PATCHRIGHT_VERSION,
} from '../../../src/shared/domain/patchright-install-commands.ts';

describe('patchright-install-commands', () => {
  it('pins browser recovery to the package runtime dependency', () => {
    expect(PATCHRIGHT_VERSION).toBe('1.63.0');
    expect(MANUAL_INSTALL_COMMAND).toBe(
      'npm exec -y -p patchright@1.63.0 -- patchright install chromium',
    );
  });

  it('uses npm exec for Linux system dependency recovery', () => {
    expect(LINUX_DEPS_COMMAND).toBe(
      'sudo npm exec -y -p patchright@1.63.0 -- patchright install-deps chromium',
    );
    expect(LINUX_INSTALL_WITH_DEPS_COMMAND).toBe(
      'npm exec -y -p patchright@1.63.0 -- patchright install --with-deps chromium',
    );
  });
});
