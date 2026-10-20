import { describe, expect, it } from 'vitest';

import { MemoryProfileFileSystem } from '../../support/memory-profile-file-system.ts';

async function codeOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return (error as { code?: unknown }).code;
  }
  return null;
}

describe('MemoryProfileFileSystem deniedPaths', () => {
  it('rejects every operation on a denied path with EPERM', async () => {
    const fs = new MemoryProfileFileSystem();
    fs.addFile('/real/Local State', 'state');
    fs.addFile('/real/Default/Cookies', 'db');
    fs.deniedPaths.add('/real/Local State');
    fs.deniedPaths.add('/real/Default');
    expect(await codeOf(fs.readText('/real/Local State'))).toBe('EPERM');
    expect(await codeOf(fs.exists('/real/Local State'))).toBe('EPERM');
    expect(await codeOf(fs.list('/real/Default'))).toBe('EPERM');
    expect(await codeOf(fs.copyFile('/real/Local State', '/x'))).toBe('EPERM');
  });

  it('leaves other paths readable', async () => {
    const fs = new MemoryProfileFileSystem();
    fs.addFile('/real/Local State', 'state');
    fs.addFile('/other/Local State', 'ok');
    fs.deniedPaths.add('/real/Local State');
    expect(await fs.readText('/other/Local State')).toBe('ok');
    expect(await fs.exists('/other/Local State')).toBe(true);
  });
});
