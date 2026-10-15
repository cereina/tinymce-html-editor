import { defineCustomElementGcdsButton, defineCustomElementGcdsSelect, defineCustomElementGcdsCheckboxes } from '@gcds-core/components/dist/components/index.js';
import '@gcds-core/components/dist/gcds/gcds.css';
import './modal-theme.css';

[defineCustomElementGcdsButton, defineCustomElementGcdsSelect, defineCustomElementGcdsCheckboxes].forEach(define => define());
let fieldSequence = 0;

/** Keep the mature editor/grid controls and their event handlers, while using
 * GC components for the window actions. Hidden native actions remain delegates
 * so formatting state and transactional behavior have a single owner. */
export function enhanceGcModal(dialog: HTMLDialogElement): () => void {
  dialog.classList.add('gc-enhanced');
  const actions = new Map<HTMLButtonElement, HTMLGcdsButtonElement>();
  const fields = new Map<HTMLInputElement | HTMLSelectElement, HTMLGcdsCheckboxesElement | HTMLGcdsSelectElement>();
  const sync = () => {
    dialog.querySelectorAll<HTMLButtonElement>(
      '.scp-header button,.scp-toolbar button,.scp-footer button,.table-workstation-header button,.table-workstation-actions button,.table-workstation-footer button,.table-a11y-review-header button,.table-a11y-review-footer button'
    ).forEach(original => {
      let host = actions.get(original);
      if (!host) {
        host = document.createElement('gcds-button'); host.type = 'button'; host.className = 'gc-modal-action';
        host.buttonRole = /primary/.test(original.className) ? 'primary' : 'secondary';
        host.size = 'small';
        host.textContent = original.textContent?.trim() === '×' ? 'Close' : original.textContent?.trim();
        const label = original.getAttribute('aria-label'); if (label) host.setAttribute('aria-label', label);
        host.addEventListener('click', event => { event.stopPropagation(); if (!original.disabled) original.click(); });
        original.before(host); original.hidden = true; original.dataset.gcOriginal = 'true'; actions.set(original, host);
      }
      if (host.disabled !== original.disabled) host.disabled = original.disabled;
    });
    dialog.querySelectorAll<HTMLSelectElement | HTMLInputElement>('.scp-select-label select,.scp-checkbox input,.table-a11y-header-option input[type="checkbox"]').forEach(original => {
      let host = fields.get(original);
      if (!host) {
        const wrapper = original.closest('label')!;
        const fieldId = 'gc-widget-field-' + ++fieldSequence;
        if (original instanceof HTMLSelectElement) {
          const select = document.createElement('gcds-select'); select.name = fieldId; select.selectId = fieldId;
          select.label = wrapper.querySelector('span')?.textContent?.trim() || 'Indent';
          Array.from(original.options).forEach(option => { const node = document.createElement('option'); node.value = option.value; node.textContent = option.text; select.append(node); });
          select.value = original.value; select.validateOn = 'other';
          select.addEventListener('gcdsChange', () => { original.value = select.value ?? ''; original.dispatchEvent(new Event('change', { bubbles: true })); });
          host = select;
        } else {
          const checkbox = document.createElement('gcds-checkboxes'); checkbox.name = fieldId; checkbox.validateOn = 'other';
          checkbox.options = [{ id: fieldId, label: wrapper.textContent?.replace(/\s+/g, ' ').trim() || 'Select header', value: 'selected', checked: original.checked }];
          checkbox.value = original.checked ? ['selected'] : [];
          checkbox.addEventListener('gcdsChange', () => {
            original.checked = Array.isArray(checkbox.value) ? checkbox.value.length > 0 : !!checkbox.value;
            original.dispatchEvent(new Event('change', { bubbles: true }));
          });
          host = checkbox;
        }
        wrapper.before(host); wrapper.hidden = true; wrapper.setAttribute('data-gc-original', 'true'); fields.set(original, host);
      }
      if (host.disabled !== original.disabled) host.disabled = original.disabled;
    });
  };
  sync();
  const observer = new MutationObserver(sync);
  observer.observe(dialog, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
  return () => observer.disconnect();
}

/** Native controls and GC shadow-root controls in document tab order. */
export function modalTabTargets(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(
    'gcds-button,gcds-select,gcds-checkboxes,button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"],[contenteditable="true"]'
  )).flatMap(host => host.tagName.startsWith('GCDS-')
    ? Array.from(host.shadowRoot?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled])') ?? [])
    : [host]).filter(element => element.getClientRects().length && !element.closest('[hidden]'));
}
