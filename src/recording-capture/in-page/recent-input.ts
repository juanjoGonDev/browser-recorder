// A few listeners need to know what another one just saw: a click that
// follows Enter is the key's doing, a click after a drag is not a click and a
// click right after a mouse click is the label's forward to its control.
type Mark = 'enter' | 'drag' | 'click';

const lastSeenAt = new Map<Mark, number>();

export function markInput(mark: Mark): void {
  lastSeenAt.set(mark, performance.now());
}

export function clearInput(mark: Mark): void {
  lastSeenAt.delete(mark);
}

export function isRecentInput(mark: Mark, withinMs: number): boolean {
  const seenAt = lastSeenAt.get(mark);
  return seenAt !== undefined && performance.now() - seenAt <= withinMs;
}
