import { BROWSER_TABLES } from '../browser-selection/domain/browser-catalog-table.ts';

const BUNDLED_LABEL = 'Chromium (bundled)';
const MAX_UNKNOWN_ID_LENGTH = 40;

function buildLabels(): ReadonlyMap<string, string> {
  const labels = new Map<string, string>([['bundled', BUNDLED_LABEL]]);
  for (const table of Object.values(BROWSER_TABLES)) {
    for (const candidate of table) {
      labels.set(candidate.browserId, candidate.label);
    }
  }
  return labels;
}

const LABELS = buildLabels();

/**
 * The name to show for a browser id. A recording file may hold any string, so
 * an id the catalogue does not know is shown as written, shortened.
 */
export function browserLabelOf(browserId: string): string {
  return (
    LABELS.get(browserId) ??
    (browserId.length > MAX_UNKNOWN_ID_LENGTH
      ? `${browserId.slice(0, MAX_UNKNOWN_ID_LENGTH)}...`
      : browserId)
  );
}
