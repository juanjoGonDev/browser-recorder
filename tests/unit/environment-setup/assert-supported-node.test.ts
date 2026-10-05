import { describe, expect, it } from 'vitest';

import {
  assertSupportedNode,
  MINIMUM_NODE,
} from '../../../src/environment-setup/domain/assert-supported-node.ts';

describe('assertSupportedNode', () => {
  it('rejects Node 20 and states the minimum version', () => {
    expect(() => {
      assertSupportedNode('v20.11.1');
    }).toThrow(/22\.13/);
    expect(MINIMUM_NODE).toBe('22.13.0');
  });

  it.each(['22.13.0', 'v22.13.0', '22.23.1', '23.0.0', '24.1.2', '100.0.0'])(
    'accepts %s',
    (version) => {
      expect(() => {
        assertSupportedNode(version);
      }).not.toThrow();
    },
  );

  it.each(['22.12.9', 'v22.0.0', '18.20.0'])('rejects %s', (version) => {
    expect(() => {
      assertSupportedNode(version);
    }).toThrow(version.replace(/^v/, ''));
  });

  it('rejects a version it cannot read rather than letting it pass', () => {
    expect(() => {
      assertSupportedNode('banana');
    }).toThrow(/banana/);
  });
});
