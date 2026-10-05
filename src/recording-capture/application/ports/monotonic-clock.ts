/** Milliseconds from a monotonic origin; never moves backward. */
export interface MonotonicClock {
  now(): number;
}
