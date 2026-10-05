import type { Recording } from '../../shared/domain/recording.ts';

// Frozen signature: work package WP3 replaces this declaration with the
// implementation. Pure and deterministic: the same recording always yields the
// same bytes, and an unsupported event throws naming its kind and index.
export declare function generateScript(recording: Recording): string;
