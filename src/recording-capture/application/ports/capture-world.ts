/**
 * Which isolated-world execution context belongs to a frame. It is a lookup
 * (not a cache filled from events) because the recorder never enables the
 * Runtime domain, so no event announces new contexts.
 */
export interface CaptureWorld {
  contextOf(frameId: string): Promise<number | undefined>;
}
