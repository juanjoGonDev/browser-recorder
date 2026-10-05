import { accessibleName } from './accessible-name.ts';
import { isDynamicId } from '../domain/is-dynamic-id.ts';
import { implicitRole } from './implicit-role.ts';

const MAX_LABEL_LENGTH = 60;
const ELLIPSIS = '…';

function tagWithId(element: Element): string {
  const tag = element.tagName.toLowerCase();
  return element.id !== '' && !isDynamicId(element.id)
    ? `${tag}#${element.id}`
    : tag;
}

/** The timeline label of an element, such as `button "Save"`. */
export function describeElement(element: Element): string {
  const name = accessibleName(element);
  const label =
    name === ''
      ? tagWithId(element)
      : `${implicitRole(element) ?? element.tagName.toLowerCase()} "${name}"`;
  return label.length <= MAX_LABEL_LENGTH
    ? label
    : `${label.slice(0, MAX_LABEL_LENGTH - ELLIPSIS.length)}${ELLIPSIS}`;
}
