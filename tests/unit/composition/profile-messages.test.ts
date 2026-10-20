import { describe, expect, it } from 'vitest';

import { ProfileCopyError } from '../../../src/browser-profiles/domain/profile-errors.ts';
import { browserLabelOf } from '../../../src/composition/browser-labels.ts';
import { explainProfileFailure } from '../../../src/composition/profile-messages.ts';

const FULL_DISK_ACCESS = /Full Disk Access/;
const PRIVACY_PATH = /System Settings . Privacy & Security/;
const RESTART = /restart the terminal/i;

describe('explainProfileFailure for source-unreadable', () => {
  it('names Full Disk Access and the terminal restart on macOS', () => {
    const error = new ProfileCopyError('source-unreadable', 'Local State');
    const message = explainProfileFailure(error, 'brave', 'darwin').message;
    expect(message).toMatch(FULL_DISK_ACCESS);
    expect(message).toMatch(PRIVACY_PATH);
    expect(message).toMatch(RESTART);
    expect(message).toContain('Brave');
    expect(message).not.toContain('could not be found');
    expect(message).not.toMatch(/[\\/](Users|home)/);
  });

  it.each(['linux', 'win32'])(
    'gives the generic permission hint on %s',
    (platform) => {
      const error = new ProfileCopyError('source-unreadable', 'Default');
      const message = explainProfileFailure(error, 'chrome', platform).message;
      expect(message).toBe(
        `The ${browserLabelOf('chrome')} profile to copy cannot be read: permission denied. Check that your user can read it and try again.`,
      );
      expect(message).not.toMatch(FULL_DISK_ACCESS);
    },
  );

  it('keeps a missing source worded as not found on every platform', () => {
    const error = new ProfileCopyError('source-missing', 'Local State');
    for (const platform of ['darwin', 'linux']) {
      expect(explainProfileFailure(error, 'brave', platform).message).toBe(
        'The Brave profile to copy could not be found. Is Brave still installed?',
      );
    }
  });

  it('leaves an unrelated error unchanged', () => {
    const original = new Error('disk full');
    expect(explainProfileFailure(original, 'brave', 'darwin')).toBe(original);
  });
});
