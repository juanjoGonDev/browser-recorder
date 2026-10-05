import type { CDPSession } from 'patchright';

/** Which execution context of the capture world belongs to which frame. */
export interface WorldContexts {
  /**
   * The context of the world in a frame, asked of the browser the first time.
   * `undefined` when the browser does not know the frame (it is gone, or it
   * lives in another process).
   */
  contextOf(frameId: string): Promise<number | undefined>;
  /** The frame a known context belongs to. */
  frameOf(contextId: number): string | undefined;
  /** Looks up every frame of the page again, replacing what was remembered. */
  refresh(): Promise<void>;
}

interface FrameTree {
  readonly frame: { readonly id: string };
  readonly childFrames?: readonly FrameTree[];
}

function frameIdsOf(tree: FrameTree): string[] {
  return [
    tree.frame.id,
    ...(tree.childFrames ?? []).flatMap((child) => frameIdsOf(child)),
  ];
}

/** Both directions of the frame to context relation, kept consistent. */
function createRelation() {
  const contextByFrame = new Map<string, number>();
  const frameByContext = new Map<number, string>();
  return {
    contextOf: (frameId: string) => contextByFrame.get(frameId),
    frameOf: (contextId: number) => frameByContext.get(contextId),
    set(frameId: string, contextId: number): void {
      contextByFrame.set(frameId, contextId);
      frameByContext.set(contextId, frameId);
    },
    drop(frameId: string): void {
      const contextId = contextByFrame.get(frameId);
      contextByFrame.delete(frameId);
      if (contextId !== undefined) frameByContext.delete(contextId);
    },
  };
}

/**
 * Without the Runtime domain no event announces new contexts, so they are
 * looked up: `Page.createIsolatedWorld` answers the same id for the same named
 * world of the same document. A new document (`Page.frameNavigated`) or a
 * frame that left (`Page.frameDetached`) invalidates what was remembered.
 */
export function createWorldContexts(
  cdp: CDPSession,
  worldName: string,
): WorldContexts {
  const relation = createRelation();
  cdp.on('Page.frameNavigated', (event) => {
    relation.drop(event.frame.id);
  });
  cdp.on('Page.frameDetached', (event) => {
    relation.drop(event.frameId);
  });

  const contextOf = async (frameId: string): Promise<number | undefined> => {
    const known = relation.contextOf(frameId);
    if (known !== undefined) return known;
    try {
      const { executionContextId } = await cdp.send(
        'Page.createIsolatedWorld',
        { frameId, worldName },
      );
      relation.set(frameId, executionContextId);
      return executionContextId;
    } catch {
      return undefined;
    }
  };

  return {
    contextOf,
    frameOf: relation.frameOf,
    async refresh() {
      const { frameTree } = await cdp.send('Page.getFrameTree');
      for (const frameId of frameIdsOf(frameTree)) {
        relation.drop(frameId);
        await contextOf(frameId);
      }
    },
  };
}
