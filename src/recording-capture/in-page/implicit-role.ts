const TAG_ROLES: Readonly<Record<string, string>> = {
  button: 'button',
  textarea: 'textbox',
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  h5: 'heading',
  h6: 'heading',
  nav: 'navigation',
  main: 'main',
  header: 'banner',
  footer: 'contentinfo',
  aside: 'complementary',
  article: 'article',
  ul: 'list',
  ol: 'list',
  menu: 'list',
  li: 'listitem',
  table: 'table',
  tr: 'row',
  td: 'cell',
  th: 'columnheader',
  dialog: 'dialog',
  option: 'option',
  form: 'form',
  progress: 'progressbar',
  fieldset: 'group',
  details: 'group',
  output: 'status',
  hr: 'separator',
};

// Types with no ARIA role (password, color, file, date...) are left out on
// purpose: Playwright's getByRole does not match them either.
const INPUT_ROLES: Readonly<Record<string, string>> = {
  button: 'button',
  submit: 'button',
  reset: 'button',
  image: 'button',
  checkbox: 'checkbox',
  radio: 'radio',
  range: 'slider',
  number: 'spinbutton',
  search: 'searchbox',
  text: 'textbox',
  email: 'textbox',
  tel: 'textbox',
  url: 'textbox',
  '': 'textbox',
};

function explicitRole(element: Element): string | null {
  const [first] = (element.getAttribute('role') ?? '').trim().split(/\s+/);
  return first === undefined || first === '' ? null : first;
}

function inputRole(element: Element): string | null {
  const type = (element.getAttribute('type') ?? '').toLowerCase();
  return INPUT_ROLES[type] ?? null;
}

function selectRole(element: Element): string {
  const size = Number(element.getAttribute('size') ?? '0');
  return element.hasAttribute('multiple') || size > 1 ? 'listbox' : 'combobox';
}

function imageRole(element: Element): string {
  return element.getAttribute('alt') === '' ? 'presentation' : 'img';
}

function tagRole(element: Element): string | null {
  const tag = element.tagName.toLowerCase();
  switch (tag) {
    case 'a':
    case 'area':
      return element.hasAttribute('href') ? 'link' : null;
    case 'input':
      return inputRole(element);
    case 'select':
      return selectRole(element);
    case 'img':
      return imageRole(element);
    default:
      return TAG_ROLES[tag] ?? null;
  }
}

/** The ARIA role an element exposes: an explicit `role`, else its tag's. */
export function implicitRole(element: Element): string | null {
  return explicitRole(element) ?? tagRole(element);
}
