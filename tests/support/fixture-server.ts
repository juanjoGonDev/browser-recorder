import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

const SITE_ROOT = path.resolve(import.meta.dirname, '..', 'fixtures', 'site');
const LOOPBACK = '127.0.0.1';
const INDEX_PAGE = 'index.html';

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

export interface FixtureServer {
  /** `http://127.0.0.1:<port>`, no trailing slash. */
  readonly baseUrl: string;
  urlFor(page: string): string;
  /** The `state` query of every `/__report` call, oldest first. */
  reports(): readonly string[];
  clearReports(): void;
  close(): Promise<void>;
}

/** The absolute path of a requested page, or `null` when it escapes the site. */
function resolveInsideSite(requestUrl: string): string | null {
  const pathname = new URL(requestUrl, 'http://fixture.invalid').pathname;
  const requested = decodeURIComponent(pathname).replace(/^\/+/, '');
  const resolved = path.resolve(SITE_ROOT, requested || INDEX_PAGE);
  const relative = path.relative(SITE_ROOT, resolved);
  const isInside =
    relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
  return isInside ? resolved : null;
}

interface Reply {
  readonly status: number;
  readonly contentType: string;
  readonly body: Buffer | string;
}

function respond(response: ServerResponse, reply: Reply): void {
  response.writeHead(reply.status, { 'content-type': reply.contentType });
  response.end(reply.body);
}

const NOT_FOUND: Reply = {
  status: 404,
  contentType: 'text/plain',
  body: 'Not found',
};

const REPORT_PATH = '/__report';
const NO_CONTENT = 204;

async function serve(
  requestUrl: string,
  response: ServerResponse,
): Promise<void> {
  const file = resolveInsideSite(requestUrl);
  if (file === null) {
    respond(response, NOT_FOUND);
    return;
  }
  try {
    const content = await readFile(file);
    const type =
      CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream';
    respond(response, { status: 200, contentType: type, body: content });
  } catch {
    respond(response, NOT_FOUND);
  }
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, LOOPBACK, () => {
      resolve((server.address() as AddressInfo).port);
    });
  });
}

/** Serves `tests/fixtures/site` on an ephemeral loopback port. */
export async function startFixtureServer(): Promise<FixtureServer> {
  const reports: string[] = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://fixture.invalid');
    if (url.pathname === REPORT_PATH) {
      // Pages tell the test what they show, so a replay can be checked from
      // outside the browser that is closed when the script ends.
      reports.push(url.searchParams.get('state') ?? '');
      response.writeHead(NO_CONTENT).end();
      return;
    }
    void serve(request.url ?? '/', response);
  });
  const port = await listen(server);
  const baseUrl = `http://${LOOPBACK}:${String(port)}`;
  let closing: Promise<void> | null = null;
  return {
    baseUrl,
    urlFor: (page) => `${baseUrl}/${page}`,
    reports: () => [...reports],
    clearReports() {
      reports.length = 0;
    },
    close() {
      closing ??= new Promise((resolve, reject) => {
        server.close((error) => {
          if (error === undefined) resolve();
          else reject(error);
        });
        server.closeAllConnections();
      });
      return closing;
    },
  };
}
