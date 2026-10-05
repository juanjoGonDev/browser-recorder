import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BrowserContext, Frame, Page } from 'patchright';
import { describe, expect, it } from 'vitest';
import { ForbiddenCdpMethodError } from '../../../src/recording-capture/adapters/guarded-cdp.ts';
import { openGuardedSession } from '../../../src/recording-capture/adapters/guarded-session.ts';
import { FakeCdp } from '../../support/fake-cdp.ts';

const ADAPTERS = join(import.meta.dirname, '../../../src/recording-capture');

function contextOpening(session: FakeCdp, opened: unknown[] = []) {
  return {
    newCDPSession: (target: unknown) => {
      opened.push(target);
      return Promise.resolve(session.asSession());
    },
  } as unknown as BrowserContext;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sourceFiles(join(dir, entry.name))
      : [join(dir, entry.name)],
  );
}

describe('src/recording-capture/adapters/guarded-session.ts', () => {
  it('opens the session for the page or frame it was asked for', async () => {
    const opened: unknown[] = [];
    const page = {} as Page;
    const frame = {} as Frame;
    const context = contextOpening(new FakeCdp(), opened);
    await openGuardedSession(context, page);
    await openGuardedSession(context, frame);
    expect(opened).toEqual([page, frame]);
  });

  it('refuses the forbidden enable calls and forwards everything else', async () => {
    const fake = new FakeCdp();
    const session = await openGuardedSession(contextOpening(fake), {} as Page);
    const raw = session as unknown as {
      send(method: string): Promise<unknown>;
    };
    await expect(
      raw.send(['Runtime', 'enable'].join('.')),
    ).rejects.toBeInstanceOf(ForbiddenCdpMethodError);
    await raw.send('Page.enable');
    expect(fake.methods()).toEqual(['Page.enable']);
  });

  it('is the only place of the capture feature that opens a CDP session', () => {
    const openers = sourceFiles(ADAPTERS)
      .filter((file) => file.endsWith('.ts'))
      .filter((file) => readFileSync(file, 'utf8').includes('.newCDPSession('))
      .map((file) => file.slice(ADAPTERS.length + 1));
    expect(openers).toEqual(['adapters/guarded-session.ts']);
  });
});
