import type { Editor, Ui } from 'tinymce';
import type {} from '@gcds-core/components/dist/types/components';
import { defineCustomElementGcdsButton, defineCustomElementGcdsInput, defineCustomElementGcdsSelect, defineCustomElementGcdsCheckboxes, defineCustomElementGcdsAlert } from '@gcds-core/components/dist/components/index.js';
import '@gcds-core/components/dist/gcds/gcds.css';
import './download-dialog.css';
import './tool-dialog.css';

[defineCustomElementGcdsButton, defineCustomElementGcdsInput, defineCustomElementGcdsSelect, defineCustomElementGcdsCheckboxes, defineCustomElementGcdsAlert].forEach(define => define());
interface ToolApi { getData: () => Record<string, string | boolean>; close: () => void }
interface ToolSpec {
  title: string; size?: string; body: Ui.Dialog.PanelSpec;
  initialData?: Record<string, string | boolean>;
  buttons?: Ui.Dialog.DialogFooterButtonSpec[];
  onSubmit?: (api: ToolApi) => void; onCancel?: () => void; onClose?: () => void;
  onAction?: (api: ToolApi, details: { name: string }) => void;
}
let sequence = 0;

/** Render the app's simple report/form specifications with GC components.
 * Complex editor widgets retain their own implementations. */
export function openGcToolDialog(editor: Editor, spec: ToolSpec): void {
  const id = 'gc-tool-' + ++sequence;
  const opener = document.activeElement as HTMLElement | null;
  const dialog = document.createElement('dialog'); dialog.className = 'gc-download gc-tool';
  dialog.setAttribute('aria-labelledby', id + '-title');
  dialog.innerHTML = `<header class="gc-download-header"><h2 id="${id}-title" tabindex="-1"></h2></header>
    <div class="gc-download-body gc-tool-body" role="region" tabindex="0"></div><footer class="gc-download-footer"></footer>`;
  dialog.querySelector('h2')!.textContent = spec.title;
  const body = dialog.querySelector<HTMLElement>('.gc-tool-body')!;
  body.setAttribute('aria-label', spec.title + ' contents');
  const controls = new Map<string, HTMLGcdsInputElement | HTMLGcdsSelectElement | HTMLGcdsCheckboxesElement>();
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true; editor.off('remove', cancel); dialog.close(); dialog.remove(); spec.onClose?.();
    if (opener?.isConnected) opener.focus();
    if (document.activeElement === document.body) editor.focus();
  };
  const cancel = () => { if (closed) return; spec.onCancel?.(); close(); };
  const api: ToolApi = {
    getData: () => Object.fromEntries(Array.from(controls, ([name, control]) => [name,
      control.tagName === 'GCDS-CHECKBOXES' ? (Array.isArray(control.value) ? control.value.length > 0 : !!control.value) : control.value as string,
    ])), close,
  };
  const submit = () => {
    // Validation messages must be available inside the inert-background modal.
    const original = editor.notificationManager.open;
    editor.notificationManager.open = args => {
      if (dialog.isConnected && (args.type === 'error' || args.type === 'warning')) {
        body.querySelector('.gc-tool-validation')?.remove();
        const alert = document.createElement('gcds-alert'); alert.className = 'gc-tool-validation';
        alert.alertRole = args.type === 'error' ? 'danger' : 'warning'; alert.heading = 'Review your settings';
        alert.hideCloseBtn = true; alert.textContent = args.text; body.prepend(alert); body.focus(); body.scrollTop = 0;
      }
      return original.call(editor.notificationManager, args);
    };
    try { spec.onSubmit?.(api); } finally { editor.notificationManager.open = original; }
  };
  const button = (text: string, primary = false) => {
    const host = document.createElement('gcds-button'); host.type = 'button';
    host.buttonRole = primary ? 'primary' : 'secondary'; host.textContent = text; return host;
  };
  const dismiss = button('Close'); dismiss.size = 'small'; dismiss.setAttribute('aria-label', 'Close ' + spec.title);
  dismiss.addEventListener('click', cancel); dialog.querySelector('header')!.append(dismiss);
  const render = (items: Ui.Dialog.BodyComponentSpec[], parent: HTMLElement) => items.forEach(item => {
    if (item.type === 'htmlpanel') {
      const report = document.createElement('div'); report.className = 'gc-tool-report'; report.innerHTML = item.html;
      report.querySelectorAll('[style]').forEach(element => element.removeAttribute('style'));
      parent.append(report);
    } else if (item.type === 'input') {
      const input = document.createElement('gcds-input'); input.inputId = id + '-' + item.name; input.name = item.name;
      input.label = item.label || item.name; input.hint = item.placeholder; input.validateOn = 'other';
      input.value = String(spec.initialData?.[item.name] ?? ''); controls.set(item.name, input); parent.append(input);
    } else if (item.type === 'selectbox') {
      const select = document.createElement('gcds-select'); select.selectId = id + '-' + item.name; select.name = item.name;
      select.label = item.label || item.name; select.validateOn = 'other';
      item.items.forEach(option => { const node = document.createElement('option'); node.value = option.value; node.textContent = option.text; select.append(node); });
      select.value = String(spec.initialData?.[item.name] ?? item.items[0]?.value ?? ''); controls.set(item.name, select); parent.append(select);
    } else if (item.type === 'checkbox') {
      const checkbox = document.createElement('gcds-checkboxes'); checkbox.name = item.name; checkbox.validateOn = 'other';
      checkbox.options = [{ id: id + '-' + item.name, label: item.label || item.name, value: 'selected', checked: spec.initialData?.[item.name] === true }];
      checkbox.value = spec.initialData?.[item.name] === true ? ['selected'] : [];
      controls.set(item.name, checkbox); parent.append(checkbox);
    } else if (item.type === 'panel' || item.type === 'grid' || item.type === 'bar' || item.type === 'label') {
      const group = document.createElement('div'); render(item.items, group); parent.append(group);
    } else { throw new Error('Unsupported GC tool control: ' + item.type); }
  });
  render(spec.body.items, body);
  spec.buttons?.forEach(item => {
    const action = button(item.text ?? (item.type === 'submit' ? 'Apply' : 'Close'), 'buttonType' in item && item.buttonType === 'primary');
    action.disabled = 'enabled' in item && item.enabled === false;
    action.addEventListener('click', item.type === 'submit' ? submit : item.type === 'custom'
      ? () => spec.onAction?.(api, { name: item.name ?? '' }) : cancel); dialog.querySelector('footer')!.append(action);
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); cancel(); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); cancel(); }
    if (event.key === 'Enter' && event.composedPath()[0] instanceof HTMLInputElement && (event.composedPath()[0] as HTMLInputElement).type !== 'checkbox') { event.preventDefault(); submit(); }
    if (event.key !== 'Tab') return;
    const hosts = Array.from(dialog.querySelectorAll<HTMLElement>('gcds-button,gcds-input,gcds-select,gcds-checkboxes,[tabindex="0"]'));
    const targets = hosts.flatMap(host => host.shadowRoot ? Array.from(host.shadowRoot.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled])')) : [host]).filter(element => element.getClientRects().length);
    let active = document.activeElement; while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    const current = targets.indexOf(active as HTMLElement);
    const next = current < 0 ? (event.shiftKey ? targets.length - 1 : 0) : (current + (event.shiftKey ? -1 : 1) + targets.length) % targets.length;
    event.preventDefault(); targets[next]!.focus();
  }, true);
  document.body.append(dialog); editor.on('remove', cancel); dialog.showModal(); dialog.querySelector<HTMLElement>('h2')!.focus();
}
