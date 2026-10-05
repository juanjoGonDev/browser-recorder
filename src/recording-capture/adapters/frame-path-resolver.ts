import type { CDPSession } from 'playwright';
import { PAGE_API_KEY } from '../domain/in-page-message.ts';
import type { CaptureWorld } from './isolated-world-capture.ts';

const FALLBACK_SELECTOR = 'iframe';

interface FrameTree {
  readonly frame: { readonly id: string };
  readonly childFrames?: readonly FrameTree[];
}

/** child frame id -> parent frame id, for every frame below the root. */
function parentsOf(
  tree: FrameTree,
  parents = new Map<string, string>(),
): Map<string, string> {
  for (const child of tree.childFrames ?? []) {
    parents.set(child.frame.id, tree.frame.id);
    parentsOf(child, parents);
  }
  return parents;
}

const CALL_CSS_PATH = `function (key) {
  const api = window[Symbol.for(key)];
  return api ? api.cssPath(this) : null;
}`;

interface FrameLink {
  readonly frameId: string;
  readonly parentId: string;
}

async function selectorOfFrame(
  cdp: CDPSession,
  world: CaptureWorld,
  { frameId, parentId }: FrameLink,
): Promise<string> {
  const contextId = world.isolatedContextOf(parentId);
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

/**
 * Names the iframe elements leading to a frame by asking the capture script
 * of each parent frame, in its isolated world, for their CSS path. A frame
 * keeps its place in its parent, so every answer is remembered. A frame that
 * vanished before it could be resolved answers with an empty path.
 */
export function createFramePathResolver(
  cdp: CDPSession,
  world: CaptureWorld,
): FramePathResolver {
  const known = new Map<string, readonly string[]>();
  const compute = async (frameId: string): Promise<readonly string[]> => {
    const { frameTree } = await cdp.send('Page.getFrameTree');
    const parents = parentsOf(frameTree);
    const chain: string[] = [];
    for (let id = frameId; parents.has(id); id = parents.get(id) ?? id) {
      chain.unshift(id);
    }
    const path: string[] = [];
    for (const id of chain) {
      path.push(
        await selectorOfFrame(cdp, world, {
          frameId: id,
          parentId: parents.get(id) ?? id,
        }),
      );
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
