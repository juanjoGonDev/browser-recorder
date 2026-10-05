import { afterEach, describe, expect, it } from 'vitest';
import type { FixtureServer } from '../../support/fixture-server.ts';
import { startFixtureServer } from '../../support/fixture-server.ts';

describe('tests/support/fixture-server.ts', () => {
  const servers: FixtureServer[] = [];

  async function start(): Promise<FixtureServer> {
    const server = await startFixtureServer();
    servers.push(server);
    return server;
  }

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  it('listens on an ephemeral loopback port, different for each server', async () => {
    const first = await start();
    const second = await start();
    const firstPort = Number(new URL(first.baseUrl).port);
    const secondPort = Number(new URL(second.baseUrl).port);

    expect(new URL(first.baseUrl).hostname).toBe('127.0.0.1');
    expect(firstPort).toBeGreaterThan(0);
    expect(secondPort).toBeGreaterThan(0);
    expect(firstPort).not.toBe(secondPort);
  });

  it('serves a fixture page as HTML', async () => {
    const server = await start();
    const response = await fetch(server.urlFor('button.html'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('data-testid="save-button"');
  });

  it('serves the index at the root', async () => {
    const server = await start();
    const response = await fetch(server.baseUrl);
    expect(await response.text()).toContain('browser-recorder fixture site');
  });

  it('answers 404 for a page that does not exist', async () => {
    const server = await start();
    const response = await fetch(server.urlFor('missing.html'));
    expect(response.status).toBe(404);
  });

  it('never serves a file outside the site directory', async () => {
    const server = await start();
    const response = await fetch(`${server.baseUrl}/..%2f..%2fpackage.json`);
    expect(response.status).toBe(404);
  });

  it('collects what a page reports to /__report, in order', async () => {
    const server = await start();
    const first = await fetch(`${server.baseUrl}/__report?state=a%20b`);
    await fetch(`${server.baseUrl}/__report?state=c`);

    expect(first.status).toBe(204);
    expect(server.reports()).toEqual(['a b', 'c']);
  });

  it('forgets reports once they are cleared', async () => {
    const server = await start();
    await fetch(`${server.baseUrl}/__report?state=x`);
    server.clearReports();
    await fetch(`${server.baseUrl}/__report?state=y`);

    expect(server.reports()).toEqual(['y']);
  });

  it('refuses connections once closed and tolerates a second close', async () => {
    const server = await start();
    const url = server.urlFor('button.html');
    await server.close();
    await server.close();

    await expect(fetch(url)).rejects.toThrow();
  });
});
