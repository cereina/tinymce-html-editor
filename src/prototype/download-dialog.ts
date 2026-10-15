import type { Editor, Ui } from 'tinymce';
import type {} from '@gcds-core/components/dist/types/components';
import {
  defineCustomElementGcdsButton, defineCustomElementGcdsInput,
  defineCustomElementGcdsSelect, defineCustomElementGcdsText,
  defineCustomElementGcdsAlert,
} from '@gcds-core/components/dist/components/index.js';
import '@gcds-core/components/dist/gcds/gcds.css';
import './download-dialog.css';

[
  defineCustomElementGcdsButton, defineCustomElementGcdsInput,
  defineCustomElementGcdsSelect, defineCustomElementGcdsText,
  defineCustomElementGcdsAlert,
].forEach(define => define());

interface DownloadSpec {
  title: string;
  size?: string;
  body: Ui.Dialog.PanelSpec;
  buttons?: Ui.Dialog.DialogFooterButtonSpec[];
  initialData: Record<string, string>;
  onSubmit: (api: { getData: () => Record<string, string>; close: () => void }) => void;
}

let activeClose: (() => void) | undefined;

/** A deliberately isolated prototype: only Download Link uses GC components.
 * The existing serializer and editor transaction remain in download-link.ts. */
export function openGcDownloadDialog(editor: Editor, spec: DownloadSpec): void {
  activeClose?.();
  const opener = document.activeElement as HTMLElement | null;
  const bookmark = editor.selection.getBookmark(2, true);
  const dialog = document.createElement('dialog');
  dialog.className = 'gc-download';
  dialog.setAttribute('aria-labelledby', 'gc-download-title');
  dialog.setAttribute('aria-describedby', 'gc-download-description');
  dialog.innerHTML = `
    <header class="gc-download-header">
      <div>
        <h2 id="gc-download-title"></h2>
        <gcds-text id="gc-download-description" size="small" margin-bottom="0">
          Create a PDF download link for your document.
        </gcds-text>
      </div>
    </header>
    <div class="gc-download-body" role="region" aria-label="Download link settings" tabindex="0">
      <div class="gc-download-layout">
        <section aria-labelledby="gc-download-details-title">
          <h3 id="gc-download-details-title">Document details</h3>
          <div class="gc-download-fields"></div>
        </section>
        <aside class="gc-download-preview" aria-labelledby="gc-download-preview-title">
          <h3 id="gc-download-preview-title">Preview</h3>
          <gcds-text size="small" margin-bottom="200">Your link text updates as you type.</gcds-text>
          <div class="gc-download-preview-card">
            <span class="gc-download-file-icon" aria-hidden="true">PDF</span>
            <div>
              <p class="gc-download-preview-name"></p>
              <p class="gc-download-preview-meta"></p>
            </div>
          </div>
          <dl class="gc-download-destination">
            <dt>File destination</dt>
            <dd class="gc-download-preview-path"></dd>
          </dl>
          <gcds-text size="small" margin-bottom="0">
            Insert the link when you are ready. You can undo it in the editor.
          </gcds-text>
        </aside>
      </div>
    </div>
    <footer class="gc-download-footer"></footer>
  `;
  const title = dialog.querySelector<HTMLHeadingElement>('h2')!;
  title.textContent = spec.title;
  title.tabIndex = -1;
  const header = dialog.querySelector('header')!;
  const body = dialog.querySelector<HTMLElement>('.gc-download-body')!;
  const fields = dialog.querySelector<HTMLElement>('.gc-download-fields')!;
  const footer = dialog.querySelector<HTMLElement>('footer')!;
  const controls = new Map<string, HTMLGcdsInputElement | HTMLGcdsSelectElement>();
  let alert: HTMLGcdsAlertElement | undefined;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    editor.off('remove', close);
    dialog.close();
    dialog.remove();
    if (activeClose === close) activeClose = undefined;
    if (opener?.isConnected) opener.focus();
    if (document.activeElement === document.body) editor.focus();
  };
  function button(text: string, primary = false): HTMLGcdsButtonElement {
    const element = document.createElement('gcds-button');
    element.type = 'button';
    element.buttonRole = primary ? 'primary' : 'secondary';
    element.textContent = text;
    return element;
  }
  const closeButton = button('Close');
  closeButton.size = 'small';
  closeButton.setAttribute('aria-label', 'Close Insert Download Link');
  closeButton.addEventListener('click', close);
  header.append(closeButton);
  const cancel = button('Cancel');
  cancel.addEventListener('click', close);
  const insert = button('Insert download link', true);
  footer.append(cancel, insert);
  const values = (): Record<string, string> => Object.fromEntries(
    Array.from(controls, ([name, control]) => [name, control.value?.trim() ?? ''])
  );
  function preview(): void {
    const data = values();
    dialog.querySelector('.gc-download-preview-name')!.textContent = data.documentTitle || 'Your document title';
    const unit = data.language === 'fr' ? (data.unit === 'MB' ? 'Mo' : 'Ko') : data.unit;
    dialog.querySelector('.gc-download-preview-meta')!.textContent = 'PDF · ' + (data.fileSize || '—') + ' ' + unit;
    dialog.querySelector('.gc-download-preview-path')!.textContent = data.filePath || 'Your file path or URL';
  }
  spec.body.items.forEach(item => {
    if (item.type === 'input') {
      const input = document.createElement('gcds-input');
      input.inputId = 'gc-download-' + item.name;
      input.name = item.name;
      input.label = item.label ?? item.name;
      input.required = true;
      input.validateOn = 'other';
      input.hint = item.placeholder;
      input.value = spec.initialData[item.name] ?? '';
      if (item.name === 'fileSize') input.inputmode = 'decimal';
      controls.set(item.name, input);
      input.addEventListener('gcdsInput', () => {
        if (input.errorMessage) input.errorMessage = '';
        preview();
      });
      fields.append(input);
    } else if (item.type === 'selectbox') {
      const select = document.createElement('gcds-select');
      select.selectId = 'gc-download-' + item.name;
      select.name = item.name;
      select.label = item.label ?? item.name;
      item.items.forEach(item => {
        const option = document.createElement('option');
        option.value = item.value;
        option.textContent = item.text;
        select.append(option);
      });
      select.value = spec.initialData[item.name] ?? item.items[0]?.value ?? '';
      controls.set(item.name, select);
      select.addEventListener('gcdsChange', preview);
      fields.append(select);
    }
  });
  const messages: Record<string, string> = {
    documentTitle: 'Enter the document title.',
    filePath: 'Enter the file path or URL.',
    imageUrl: 'Enter the image URL.',
    fileSize: 'Enter a valid file size greater than 0.',
  };
  const focus = (host: HTMLElement) => {
    (host.shadowRoot?.querySelector<HTMLElement>('input,select,button') ?? host).focus();
  };
  function submit(): void {
    const data = values();
    const invalid = Object.keys(messages).filter(name => name === 'fileSize'
      ? !data[name] || !Number.isFinite(Number(data[name].replace(',', '.'))) || Number(data[name].replace(',', '.')) <= 0
      : !data[name]);
    controls.forEach((control, name) => {
      control.errorMessage = invalid.includes(name) ? messages[name] : '';
    });
    alert?.remove();
    alert = undefined;
    if (invalid.length) {
      alert = document.createElement('gcds-alert');
      alert.alertRole = 'danger';
      alert.heading = 'Check the highlighted fields';
      alert.hideCloseBtn = true;
      const list = document.createElement('ul');
      invalid.forEach(name => {
        const item = document.createElement('li');
        item.textContent = messages[name];
        list.append(item);
      });
      alert.append(list);
      body.prepend(alert);
      focus(controls.get(invalid[0]!)!);
      return;
    }
    editor.selection.moveToBookmark(bookmark);
    spec.onSubmit({ getData: () => data, close });
  }
  insert.addEventListener('click', submit);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    if (event.key === 'Enter' && event.composedPath()[0] instanceof HTMLInputElement) {
      event.preventDefault(); submit();
    }
    if (event.key === 'Tab') {
      const hosts: HTMLElement[] = [closeButton, body, ...controls.values(), cancel, insert];
      const tabbable = hosts.map(host => host.shadowRoot?.querySelector<HTMLElement>('input,select,button') ?? host);
      let active = document.activeElement;
      while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
      const position = tabbable.indexOf(active as HTMLElement);
      const next = position < 0 ? (event.shiftKey ? tabbable.length - 1 : 0)
        : (position + (event.shiftKey ? -1 : 1) + tabbable.length) % tabbable.length;
      event.preventDefault(); tabbable[next]!.focus();
    }
  }, true);
  preview();
  document.body.append(dialog);
  activeClose = close;
  editor.on('remove', close);
  dialog.showModal();
  title.focus();
}
