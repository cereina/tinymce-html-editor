import type { Editor, Ui } from 'tinymce';
import './accessibility.css';
import { enhanceGcModal, modalTabTargets } from '../prototype/modal-actions';

/** Use the platform's modal semantics, including inert background and focus
 * containment. The existing tool remains responsible for its own teardown. */
export function openAccessibleModal(dialog: HTMLDialogElement, editor: Editor, cancel: () => void): void {
  const opener = document.activeElement as HTMLElement | null;
  const panel = dialog.querySelector<HTMLElement>('[role="dialog"]');
  dialog.classList.add('accessible-modal');
  const disconnectGc = enhanceGcModal(dialog);
  if (panel) {
    dialog.setAttribute('aria-labelledby', panel.getAttribute('aria-labelledby')!);
    panel.removeAttribute('role');
    panel.removeAttribute('aria-modal');
    panel.removeAttribute('aria-labelledby');
  }
  dialog.addEventListener('cancel', event => { event.preventDefault(); cancel(); });
  // Capture before legacy document handlers; only the top dialog closes.
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopImmediatePropagation(); cancel();
    }
    if (event.key === 'Tab') {
      const controls = modalTabTargets(dialog);
      if (controls.length) {
        let active = document.activeElement;
        while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
        const current = controls.indexOf(active as HTMLElement);
        const next = current < 0
          ? (event.shiftKey ? controls.length - 1 : 0)
          : (current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
        event.preventDefault();
        controls[next].focus();
      }
    }
  }, true);
  const restore = () => {
    if (document.activeElement !== document.body) return;
    if (opener?.isConnected && !opener.closest('[inert]')) opener.focus();
    if (document.activeElement === document.body) editor.focus();
  };
  const observer = new MutationObserver(() => {
    if (!dialog.isConnected) { observer.disconnect(); disconnectGc(); restore(); }
  });
  observer.observe(document.body, { childList: true });
  dialog.showModal();
  const title = dialog.querySelector<HTMLElement>('h1,h2');
  if (title) { title.tabIndex = -1; title.focus(); }
  const removeEditor = () => { if (dialog.isConnected) cancel(); };
  editor.on('remove', removeEditor);
  const cleanup = new MutationObserver(() => { if (!dialog.isConnected) { editor.off('remove', removeEditor); cleanup.disconnect(); } });
  cleanup.observe(document.body, { childList: true });
}

function labelledSpec<T extends { text?: string; tooltip?: string }>(spec: T): T {
  const { text, tooltip } = spec;
  if (text && tooltip && !tooltip.toLowerCase().includes(text.toLowerCase())) {
    return { ...spec, tooltip: text + ': ' + tooltip };
  }
  return spec;
}

/** TinyMCE uses the tooltip as the accessible name of text toolbar controls. */
export function registerAccessibleToolLabels(editor: Editor): void {
  const registry = editor.ui.registry;
  const addButton = registry.addButton.bind(registry);
  const addMenuButton = registry.addMenuButton.bind(registry);
  registry.addButton = (name, spec) => addButton(name, labelledSpec(spec));
  registry.addMenuButton = (name, spec) => addMenuButton(name, labelledSpec(spec));
}

export function installEditorAccessibility(editor: Editor): void {
  editor.iframeElement?.setAttribute('title', 'Document HTML editor');
  // Silver owns its title markup. Preserve its IDs, classes and ARIA references
  // while adjusting only the app window heading, never authored iframe content.
  const updateTitles = () => {
    document.querySelectorAll<HTMLHeadingElement>('.tox-dialog h1.tox-dialog__title').forEach(title => {
      const heading = document.createElement('h2');
      Array.from(title.attributes).forEach(attribute => heading.setAttribute(attribute.name, attribute.value));
      heading.append(...Array.from(title.childNodes));
      title.replaceWith(heading);
    });
  };
  const updateWindowStructure = () => {
    updateTitles();
    document.querySelectorAll<HTMLElement>('.tox-dialog__body-content').forEach(body => {
      body.tabIndex = 0;
      body.setAttribute('data-alloy-tabstop', 'true');
      body.setAttribute('role', 'region');
      const title = body.closest('.tox-dialog')?.querySelector('.tox-dialog__title')?.textContent?.trim();
      body.setAttribute('aria-label', (title || 'Dialog') + ' contents');
    });
  };
  const titleObserver = new MutationObserver(updateWindowStructure);
  titleObserver.observe(document.body, { childList: true, subtree: true });
  editor.on('OpenWindow', updateWindowStructure);
  editor.on('remove', () => { titleObserver.disconnect(); editor.off('OpenWindow', updateWindowStructure); });
  const originalOpen = editor.windowManager.open.bind(editor.windowManager);
  const labelItems = (items: Ui.Dialog.BodyComponentSpec[], title: string): Ui.Dialog.BodyComponentSpec[] =>
    items.map(item => {
      if (item.type === 'textarea' && !item.label) {
        return { ...item, label: title === 'Source Code' ? 'Document HTML source' : item.name };
      }
      if (item.type === 'panel' || item.type === 'grid' || item.type === 'bar' || item.type === 'label') {
        return { ...item, items: labelItems(item.items, title) };
      }
      return item;
    });
  editor.windowManager.open = (spec, params) => {
    const body = spec.body.type === 'tabpanel'
      ? { ...spec.body, tabs: spec.body.tabs.map(tab => ({ ...tab, items: labelItems(tab.items, spec.title) })) }
      : { ...spec.body, items: labelItems(spec.body.items, spec.title) };
    return originalOpen({ ...spec, body }, params);
  };
}
