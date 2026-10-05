import { describe, expect, it } from 'vitest';

import {
  ensureBrowser,
  MANUAL_INSTALL_COMMAND,
  type EnsureBrowserEvent,
} from '../../../src/environment-setup/application/ensure-browser.ts';
import type { BrowserInstallation } from '../../../src/environment-setup/application/ports/browser-installation.ts';

interface Harness {
  readonly events: string[];
  readonly calls: string[];
  run(platform?: string): ReturnType<typeof ensureBrowser>;
}

function harness(options: {
  isInstalledBefore: boolean;
  isInstalledAfter?: boolean;
  exitCode?: number | null;
  hasSignalExit?: boolean;
  lines?: readonly string[];
  throws?: Error;
}): Harness {
  const events: string[] = [];
  const calls: string[] = [];
  let checks = 0;
  const installation: BrowserInstallation = {
    isInstalled: () => {
      checks += 1;
      calls.push('check');
      const isInstalled =
        checks === 1
          ? options.isInstalledBefore
          : (options.isInstalledAfter ?? false);
      return Promise.resolve(isInstalled);
    },
    install: (onLine) => {
      calls.push('install');
      options.lines?.forEach(onLine);
      if (options.throws !== undefined) return Promise.reject(options.throws);
      const exitCode =
        options.hasSignalExit === true ? null : (options.exitCode ?? 0);
      return Promise.resolve({ exitCode });
    },
  };
  const onEvent = (event: EnsureBrowserEvent): void => {
    events.push(event.kind === 'missing' ? 'missing' : event.line);
    calls.push(event.kind);
  };
  return {
    events,
    calls,
    run: (platform = 'darwin') =>
      ensureBrowser({ installation, platform, onEvent }),
  };
}

describe('ensureBrowser', () => {
  it('does not install when Chromium is present', async () => {
    const h = harness({ isInstalledBefore: true });

    expect(await h.run()).toEqual({ kind: 'ready', linuxHint: null });
    expect(h.calls).toEqual(['check']);
  });

  it('announces the missing browser before it installs, then re-checks', async () => {
    const h = harness({
      isInstalledBefore: false,
      isInstalledAfter: true,
      lines: ['Downloading 1/2', 'Downloading 2/2'],
    });

    const result = await h.run();

    expect(result.kind).toBe('ready');
    expect(h.calls).toEqual([
      'check',
      'missing',
      'install',
      'install-output',
      'install-output',
      'check',
    ]);
    expect(h.events).toEqual(['missing', 'Downloading 1/2', 'Downloading 2/2']);
  });

  it('fails with the manual command on a non-zero exit', async () => {
    const h = harness({ isInstalledBefore: false, exitCode: 1 });

    expect(await h.run()).toEqual({
      kind: 'failed',
      manualCommand: MANUAL_INSTALL_COMMAND,
      exitCode: 1,
    });
    expect(MANUAL_INSTALL_COMMAND).toBe(
      'pnpm exec patchright install chromium',
    );
  });

  it('prints a manual command that goes through patchright, never playwright', () => {
    expect(MANUAL_INSTALL_COMMAND).toMatch(/\bpatchright install chromium$/);
    expect(MANUAL_INSTALL_COMMAND).not.toMatch(/playwright/i);
  });

  it('carries whatever non-zero exit code the installer returned', async () => {
    const h = harness({ isInstalledBefore: false, exitCode: 137 });

    expect(await h.run()).toMatchObject({ kind: 'failed', exitCode: 137 });
  });

  it('fails when the installer exited 0 but Chromium is still absent', async () => {
    const h = harness({
      isInstalledBefore: false,
      isInstalledAfter: false,
      exitCode: 0,
    });

    expect(await h.run()).toMatchObject({ kind: 'failed', exitCode: 0 });
  });

  it('does not crash when the installer cannot even start (offline)', async () => {
    const h = harness({
      isInstalledBefore: false,
      throws: new Error('getaddrinfo ENOTFOUND cdn.playwright.dev'),
    });

    const result = await h.run();

    expect(result).toMatchObject({ kind: 'failed', exitCode: null });
    expect(h.events).toContain('getaddrinfo ENOTFOUND cdn.playwright.dev');
  });

  it('treats a signal exit (null code) as a failure', async () => {
    const h = harness({
      isInstalledBefore: false,
      isInstalledAfter: true,
      hasSignalExit: true,
    });

    expect(await h.run()).toMatchObject({ kind: 'failed', exitCode: null });
  });

  it('carries the Linux dependency hint on linux only', async () => {
    const linux = await harness({ isInstalledBefore: true }).run('linux');
    const mac = await harness({ isInstalledBefore: true }).run('darwin');

    expect(linux).toMatchObject({ kind: 'ready' });
    expect(linux.kind === 'ready' ? linux.linuxHint : null).toContain(
      'install-deps',
    );
    expect(mac).toEqual({ kind: 'ready', linuxHint: null });
  });
});
