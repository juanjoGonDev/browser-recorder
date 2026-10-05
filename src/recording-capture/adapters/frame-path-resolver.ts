import type { CDPSession } from 'patchright';
import { PAGE_API_KEY } from '../domain/in-page-message.ts';
import type { CaptureWorld } from '../application/ports/capture-world.ts';

const FALLBACK_SELECTOR = 'iframe';

interface FrameTree {
  readonly frame: { readonly id: string; readonly parentId?: string };
  readonly childFrames?: readonly FrameTree[];
}

/** A CDP session that hosts frames, with the capture world running in them. */
export interface FrameHost {
  readonly cdp: CDPSession;
  readonly world: CaptureWorld;
}

/** The sessions that together hold every frame of one page. */
export interface FrameHosts {
  /** Registers a session; the returned function unregisters it. */
  add(host: FrameHost): () => void;
  list(): readonly FrameHost[];
}

export function createFrameHosts(): FrameHosts {
  const hosts = new Set<FrameHost>();
  return {
    add(host) {
      hosts.add(host);
      return () => {
        hosts.delete(host);
      };
    },
    list: () => [...hosts],
  };
}

interface FrameLink {
  readonly frameId: string;
  /** Absent for the top frame of the page. */
  readonly parentId: string | undefined;
  readonly host: FrameHost;
}

/**
 * Every frame the hosts hold. A frame in its own process is the root of its
 * host's tree and still names its parent, which lives in another host.
 */
function collectLinks(
  tree: FrameTree,
  host: FrameHost,
  links: Map<string, FrameLink>,
): void {
  const { id, parentId } = tree.frame;
  links.set(id, { frameId: id, parentId, host });
  for (const child of tree.childFrames ?? []) collectLinks(child, host, links);
}

async function linksOf(
  hosts: readonly FrameHost[],
): Promise<Map<string, FrameLink>> {
  const links = new Map<string, FrameLink>();
  for (const host of hosts) {
    try {
      const { frameTree } = await host.cdp.send('Page.getFrameTree');
      collectLinks(frameTree, host, links);
    } catch {
      // A session that is gone holds no frames any more.
    }
  }
  return links;
}

const CALL_CSS_PATH = `function (key) {
  const api = window[Symbol.for(key)];
  return api ? api.cssPath(this) : null;
}`;

/** The selector of a frame's owner element, asked of the parent's host. */
async function selectorOfFrame(
  host: FrameHost,
  frameId: string,
  parentId: string,
): Promise<string> {
  const { cdp, world } = host;
  const contextId = await world.contextOf(parentId);
  if (contextId === undefined) return FALLBACK_SELECTOR;
  const owner = await cdp.send('DOM.getFrameOwner', { frameId });
  const { object } = await cdp.send('DOM.resolveNode', {
    backendNodeId: owner.backendNodeId,
    executionContextId: contextId,
  });
  if (object.objectId === undefined) return FALLBACK_SELECTOR;
  const { result } = await cdp.send('Runtime.callFunctionOn', {
    objectId: object.objectId,
    functionDeclaration: CALL_CSS_PATH,
    arguments: [{ value: PAGE_API_KEY }],
    returnByValue: true,
  });
  await cdp.send('Runtime.releaseObject', { objectId: object.objectId });
  return typeof result.value === 'string' ? result.value : FALLBACK_SELECTOR;
}

export interface FramePathResolver {
  /** Iframe CSS selectors from the top frame down to the frame, outermost first. */
  resolve(frameId: string): Promise<readonly string[]>;
}

/** The frames from the top frame down to `frameId`, outermost first. */
function chainTo(
  frameId: string,
  links: ReadonlyMap<string, FrameLink>,
): FrameLink[] {
  const chain: FrameLink[] = [];
  let link = links.get(frameId);
  while (link?.parentId !== undefined) {
    chain.unshift(link);
    link = links.get(link.parentId);
  }
  return chain;
}

/**
 * Names the iframe elements leading to a frame by asking the capture script
 * of each parent frame, in its isolated world, for their CSS path. A frame
 * keeps its place in its parent, so every answer is remembered. A frame that
 * vanished before it could be resolved answers with an empty path.
 */
export function createFramePathResolver(hosts: FrameHosts): FramePathResolver {
  const known = new Map<string, readonly string[]>();
  const compute = async (frameId: string): Promise<readonly string[]> => {
    const links = await linksOf(hosts.list());
    const path: string[] = [];
    for (const { frameId: id, parentId } of chainTo(frameId, links)) {
      const parent = parentId === undefined ? undefined : links.get(parentId);
      if (parent === undefined || parentId === undefined) return [];
      path.push(await selectorOfFrame(parent.host, id, parentId));
    }
    return path;
  };
  return {
    async resolve(frameId) {
      const cached = known.get(frameId);
      if (cached !== undefined) return cached;
      try {
        const path = await compute(frameId);
        known.set(frameId, path);
        return path;
      } catch {
        return [];
      }
    },
  };
}
