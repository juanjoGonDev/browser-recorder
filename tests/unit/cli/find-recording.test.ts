import { describe, expect, it } from 'vitest';

import { findRecording } from '../../../src/cli/domain/find-recording.ts';

const CHOICES = [
  { slug: 'demo', name: 'Something else' },
  { slug: 'other', name: 'Demo' },
  { slug: 'my-flow', name: 'My Flow' },
  { slug: 'broken', name: null },
];

describe('src/cli/domain/find-recording.ts', () => {
  it('prefers an exact slug over a display name', () => {
    expect(findRecording(CHOICES, 'demo')).toStrictEqual({
      kind: 'found',
      slug: 'demo',
    });
  });

  it('matches the display name without caring about case', () => {
    expect(findRecording(CHOICES, 'my flow')).toStrictEqual({
      kind: 'found',
      slug: 'my-flow',
    });
    expect(findRecording(CHOICES, 'MY FLOW')).toStrictEqual({
      kind: 'found',
      slug: 'my-flow',
    });
  });

  it('matches a slug case-sensitively, so a different case falls to the name', () => {
    expect(findRecording(CHOICES, 'DEMO')).toStrictEqual({
      kind: 'found',
      slug: 'other',
    });
  });

  it('lists every candidate when the name is ambiguous', () => {
    const choices = [
      { slug: 'login', name: 'Login' },
      { slug: 'login-2', name: 'login' },
      { slug: 'zzz', name: 'Other' },
    ];
    expect(findRecording(choices, 'LOGIN')).toStrictEqual({
      kind: 'ambiguous',
      slugs: ['login', 'login-2'],
    });
  });

  it('finds an unreadable recording by slug only', () => {
    expect(findRecording(CHOICES, 'broken')).toStrictEqual({
      kind: 'found',
      slug: 'broken',
    });
    expect(findRecording(CHOICES, 'null')).toStrictEqual({ kind: 'not-found' });
  });

  it('reports no match', () => {
    expect(findRecording(CHOICES, 'missing')).toStrictEqual({
      kind: 'not-found',
    });
    expect(findRecording([], 'demo')).toStrictEqual({ kind: 'not-found' });
  });
});
