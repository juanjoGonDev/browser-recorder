import { describe, expect, it } from 'vitest';

import { createBrowserCatalog } from '../../../src/browser-selection/application/browser-catalog.ts';
import type { FileProbe } from '../../../src/browser-selection/application/ports/file-probe.ts';
import type { PathRoots } from '../../../src/browser-selection/domain/expand-path.ts';

const roots: PathRoots = {
  home: '/Users/ana',
  localAppData: 'C:\\Users\\ana\\AppData\\Local',
  appData: null,
  programFiles: 'C:\\Program Files',
  programFilesX86: 'C:\\Program Files (x86)',
  xdgConfigHome: null,
};

function fakeProbe(files: readonly string[], dirs: readonly string[] = []) {
  const probe: FileProbe = {
    isFile: (path) => Promise.resolve(files.includes(path)),
    isDirectory: (path) => Promise.resolve(dirs.includes(path)),
  };
  return probe;
}

function catalogOn(platform: string, probe: FileProbe) {
  return createBrowserCatalog({
    probe,
    platform,
    roots,
    isBundledInstalled: () => Promise.resolve(true),
  });
}

const braveMac = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const braveMacData =
  '/Users/ana/Library/Application Support/BraveSoftware/Brave-Browser';

describe('createBrowserCatalog', () => {
  it('lists an installed macOS Brave with its executable and data folder', async () => {
    const catalog = catalogOn('darwin', fakeProbe([braveMac], [braveMacData]));
    expect(await catalog.list()).toEqual([
      {
        browserId: 'brave',
        label: 'Brave',
        executablePath: braveMac,
        userDataDir: braveMacData,
      },
      {
        browserId: 'bundled',
        label: 'Chromium (bundled)',
        executablePath: null,
        userDataDir: null,
      },
    ]);
  });

  it('lists exactly the bundled browser when nothing is installed', async () => {
    const catalog = catalogOn('darwin', fakeProbe([]));
    const ids = (await catalog.list()).map((b) => b.browserId);
    expect(ids).toEqual(['bundled']);
  });

  it('keeps table order and puts the bundled browser last', async () => {
    const chrome = '/usr/bin/google-chrome';
    const brave = '/usr/bin/brave';
    const catalog = catalogOn('linux', fakeProbe([chrome, brave]));
    const ids = (await catalog.list()).map((b) => b.browserId);
    expect(ids).toEqual(['brave', 'chrome', 'bundled']);
  });

  it('picks the first candidate path that exists', async () => {
    const second = '/usr/bin/brave';
    const third = '/opt/brave.com/brave/brave';
    const catalog = catalogOn('linux', fakeProbe([third, second]));
    const [brave] = await catalog.list();
    expect(brave.executablePath).toBe(second);
  });

  it('does not detect a browser whose path is a directory, not a file', async () => {
    const probe: FileProbe = {
      isFile: () => Promise.resolve(false),
      isDirectory: (path) => Promise.resolve(path === braveMac),
    };
    const ids = (await catalogOn('darwin', probe).list()).map(
      (b) => b.browserId,
    );
    expect(ids).toEqual(['bundled']);
  });

  it('finds a browser under the user Applications folder', async () => {
    const inHome =
      '/Users/ana/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
    const catalog = catalogOn('darwin', fakeProbe([inHome]));
    const [brave] = await catalog.list();
    expect(brave.executablePath).toBe(inHome);
  });

  it('offers no data folder when the folder is not on disk', async () => {
    const catalog = catalogOn('darwin', fakeProbe([braveMac], []));
    const [brave] = await catalog.list();
    expect(brave.executablePath).toBe(braveMac);
    expect(brave.userDataDir).toBeNull();
  });

  it('lists Opera without a data folder even when its folder exists', async () => {
    const opera = '/Applications/Opera.app/Contents/MacOS/Opera';
    const catalog = catalogOn('darwin', fakeProbe([opera], ['/Users/ana']));
    const [found] = await catalog.list();
    expect(found).toEqual({
      browserId: 'opera',
      label: 'Opera',
      executablePath: opera,
      userDataDir: null,
    });
  });

  it('expands Windows templates and handles spaces in the path', async () => {
    const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const data = 'C:\\Users\\ana\\AppData\\Local\\Google\\Chrome\\User Data';
    const catalog = catalogOn('win32', fakeProbe([chrome], [data]));
    const [found] = await catalog.list();
    expect(found).toEqual({
      browserId: 'chrome',
      label: 'Google Chrome',
      executablePath: chrome,
      userDataDir: data,
    });
  });

  it('skips Windows candidates whose root variable is not set', async () => {
    const x86 =
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const probe = fakeProbe([x86]);
    const without = createBrowserCatalog({
      probe,
      platform: 'win32',
      roots: { ...roots, programFilesX86: null },
      isBundledInstalled: () => Promise.resolve(true),
    });
    expect((await without.list()).map((b) => b.browserId)).toEqual(['bundled']);
    expect((await catalogOn('win32', probe).list())[0]?.executablePath).toBe(
      x86,
    );
  });

  it('lists only the bundled browser on an unknown OS', async () => {
    const everything: FileProbe = {
      isFile: () => Promise.resolve(true),
      isDirectory: () => Promise.resolve(true),
    };
    const ids = (await catalogOn('freebsd', everything).list()).map(
      (b) => b.browserId,
    );
    expect(ids).toEqual(['bundled']);
  });

  it('finds a listed browser by id and answers null for an absent one', async () => {
    const catalog = catalogOn('darwin', fakeProbe([braveMac]));
    expect((await catalog.find('brave'))?.executablePath).toBe(braveMac);
    expect((await catalog.find('bundled'))?.executablePath).toBeNull();
    expect(await catalog.find('chrome')).toBeNull();
  });
});
