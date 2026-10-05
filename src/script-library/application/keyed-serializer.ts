/** Runs tasks sharing a key one at a time, in call order; keys are independent. */
export interface KeyedSerializer {
  run<T>(key: string, task: () => Promise<T>): Promise<T>;
}

export function createKeyedSerializer(): KeyedSerializer {
  const tails = new Map<string, Promise<unknown>>();
  return {
    run<T>(key: string, task: () => Promise<T>): Promise<T> {
      const previous = tails.get(key) ?? Promise.resolve();
      const result = previous.then(task);
      const tail = result.catch(() => undefined);
      tails.set(key, tail);
      void tail.then(() => {
        if (tails.get(key) === tail) tails.delete(key);
      });
      return result;
    },
  };
}
