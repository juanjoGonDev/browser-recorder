import { EventEmitter } from 'node:events';
import type { CDPSession } from 'patchright';

export interface SentCall {
  readonly method: string;
  readonly params: Record<string, unknown> | undefined;
}

export interface FrameNode {
  readonly id: string;
  readonly children?: readonly FrameNode[];
}

type Handler = (params: Record<string, unknown> | undefined) => unknown;

/**
 * A scripted CDP session: it answers the few protocol methods the capture
 * adapters use from a frame tree it holds, hands out one execution context id
 * per frame document (stable until the frame navigates) and lets a test emit
 * protocol events.
 */
export class FakeCdp extends EventEmitter {
  readonly sent: SentCall[] = [];
  readonly handlers = new Map<string, Handler>();
  tree: FrameNode;
  private nextContextId = 100;
  private readonly contextByFrame = new Map<string, number>();
  private readonly goneFrames = new Set<string>();

  constructor(tree: FrameNode = { id: 'main' }) {
    super();
    this.tree = tree;
  }

  send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    this.sent.push({ method, params });
    const custom = this.handlers.get(method);
    if (custom !== undefined)
      return Promise.resolve().then(() => custom(params));
    return Promise.resolve().then(() => this.answer(method, params));
  }

  asSession(): CDPSession {
    return this as unknown as CDPSession;
  }

  methods(): string[] {
    return this.sent.map(({ method }) => method);
  }

  callsTo(method: string): SentCall[] {
    return this.sent.filter((call) => call.method === method);
  }

  /** The frame commits a new document: the next world gets a new context id. */
  navigate(frameId: string): void {
    this.contextByFrame.delete(frameId);
    this.emit('Page.frameNavigated', { frame: { id: frameId, url: 'x' } });
  }

  /**
   * The document changed and no event told anyone (a missed event). Returns
   * the context id the page now runs the world in.
   */
  renewSilently(frameId: string): number {
    this.contextByFrame.delete(frameId);
    return this.createWorld(frameId).executionContextId;
  }

  detach(frameId: string): void {
    this.goneFrames.add(frameId);
    this.contextByFrame.delete(frameId);
    this.emit('Page.frameDetached', { frameId, reason: 'remove' });
  }

  currentContextOf(frameId: string): number | undefined {
    return this.contextByFrame.get(frameId);
  }

  private answer(method: string, params?: Record<string, unknown>): unknown {
    if (method === 'Page.getFrameTree') {
      return { frameTree: toProtocolTree(this.tree) };
    }
    if (method === 'Page.createIsolatedWorld') {
      return this.createWorld(String(params?.['frameId']));
    }
    return {};
  }

  private createWorld(frameId: string): { executionContextId: number } {
    if (this.goneFrames.has(frameId)) {
      throw new Error('No frame for given id found');
    }
    const known = this.contextByFrame.get(frameId);
    if (known !== undefined) return { executionContextId: known };
    this.nextContextId += 1;
    this.contextByFrame.set(frameId, this.nextContextId);
    return { executionContextId: this.nextContextId };
  }
}

interface ProtocolTree {
  frame: { id: string };
  childFrames?: ProtocolTree[];
}

function toProtocolTree(node: FrameNode): ProtocolTree {
  return {
    frame: { id: node.id },
    ...(node.children === undefined
      ? {}
      : { childFrames: node.children.map(toProtocolTree) }),
  };
}
