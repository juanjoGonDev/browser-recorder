import { describe, expect, it } from 'vitest';
import { pathRootsFor } from '../../../src/composition/path-roots.ts';

describe('src/composition/path-roots.ts', () => {
  it('reads the Windows folders from the environment', () => {
    expect(
      pathRootsFor(
        {
          LOCALAPPDATA: 'C:\\Users\\ana\\AppData\\Local',
          APPDATA: 'C:\\Users\\ana\\AppData\\Roaming',
          PROGRAMFILES: 'C:\\Program Files',
          'PROGRAMFILES(X86)': 'C:\\Program Files (x86)',
        },
        'C:\\Users\\ana',
      ),
    ).toEqual({
      home: 'C:\\Users\\ana',
      localAppData: 'C:\\Users\\ana\\AppData\\Local',
      appData: 'C:\\Users\\ana\\AppData\\Roaming',
      programFiles: 'C:\\Program Files',
      programFilesX86: 'C:\\Program Files (x86)',
      xdgConfigHome: null,
    });
  });

  it('treats unset and empty variables as missing roots', () => {
    expect(
      pathRootsFor(
        { XDG_CONFIG_HOME: '', LOCALAPPDATA: undefined },
        '/home/ana',
      ),
    ).toEqual({
      home: '/home/ana',
      localAppData: null,
      appData: null,
      programFiles: null,
      programFilesX86: null,
      xdgConfigHome: null,
    });
  });

  it('keeps the XDG config directory when set', () => {
    expect(
      pathRootsFor({ XDG_CONFIG_HOME: '/cfg' }, '/home/ana').xdgConfigHome,
    ).toBe('/cfg');
  });
});
