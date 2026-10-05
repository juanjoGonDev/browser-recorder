export function nest(value: number): number {
  if (value > 0) {
    if (value > 1) {
      if (value > 2) {
        if (value > 3) {
          return value;
        }
      }
    }
  }
  return 0;
}
