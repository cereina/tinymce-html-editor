import type { Editor, Ui } from 'tinymce';
import './accessibility.css';

/** Use the platform's modal semantics, including inert background and focus
 * containment. The existing tool remains responsible for its own teardown. */
export function openAccessibleModal(dialog: HTMLDialogElement, editor: Editor, cancel: () => void): void {
  const opener = document.activeElement as HTMLElement | null;
  const panel = dialog.querySelector<HTMLElement>('[role="dialog"]');
  dialog.classList.add('accessible-modal');
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
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"],[contenteditable="true"]'
      )).filter(el => el.getClientRects().length && !el.closest('[hidden]'));
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }, true);
  const restore = () => {
    if (document.activeElement !== document.body) return;
    if (opener?.isConnected && !opener.closest('[inert]')) opener.focus();
    if (document.activeElement === document.body) editor.focus();
  };
  const observer = new MutationObserver(() => {
    if (!dialog.isConnected) { observer.disconnect(); restore(); }
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
