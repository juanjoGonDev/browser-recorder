export interface Greeting {
  readonly text: string;
}

export function greet(name: string): Greeting {
  const isEmpty = name.length === 0;
  return { text: isEmpty ? 'Hello' : `Hello ${name}` };
}
