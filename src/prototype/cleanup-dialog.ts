import type { Editor } from 'tinymce';
import type { CleanupResult } from '../cleaning/html-cleaner';
import type {} from '@gcds-core/components/dist/types/components';
import { defineCustomElementGcdsButton, defineCustomElementGcdsText, defineCustomElementGcdsAlert } from '@gcds-core/components/dist/components/index.js';
import '@gcds-core/components/dist/gcds/gcds.css';
import './download-dialog.css';
import './cleanup-dialog.css';

[defineCustomElementGcdsButton, defineCustomElementGcdsText, defineCustomElementGcdsAlert].forEach(define => define());

export function openGcCleanupDialog(editor: Editor, result: CleanupResult, reportHtml: string): void {
  const opener = document.activeElement as HTMLElement | null;
  const dialog = document.createElement('dialog');
  dialog.className = 'gc-download gc-cleanup';
  dialog.setAttribute('aria-labelledby', 'gc-cleanup-title');
  dialog.setAttribute('aria-describedby', 'gc-cleanup-description');
  dialog.innerHTML = `
    <header class="gc-download-header">
      <div><h2 id="gc-cleanup-title" tabindex="-1">HTML Cleanup Report</h2>
        <gcds-text id="gc-cleanup-description" size="small" margin-bottom="0">Review the proposed changes before applying cleanup to your document.</gcds-text>
      </div>
    </header>
    <div class="gc-download-body" role="region" aria-label="HTML cleanup report contents" tabindex="0"></div>
    <footer class="gc-download-footer"></footer>`;
  const body = dialog.querySelector<HTMLElement>('.gc-download-body')!;
  const summary = document.createElement('gcds-alert');
  summary.alertRole = result.hasChanges ? 'info' : 'success';
  summary.heading = result.hasChanges ? 'Cleanup changes are ready to review' : 'No cleanup changes needed';
  summary.hideCloseBtn = true;
  summary.textContent = result.hasChanges
    ? 'Your document has not changed. Apply cleanup when you are ready, or cancel to keep it as it is. You can undo applied changes in the editor.'
    : 'No automatic cleanup changes are required. Review the findings below, then close this report.';
  body.append(summary);
  if (result.warnings.length) {
    const warning = document.createElement('gcds-alert');
    warning.alertRole = 'warning';
    warning.heading = 'Review recommended';
    warning.hideCloseBtn = true;
    const list = document.createElement('ul');
    result.warnings.forEach(message => { const item = document.createElement('li'); item.textContent = message; list.append(item); });
    warning.append(list);
    body.append(warning);
  } else {
    const message = document.createElement('gcds-text');
    message.size = 'small';
    message.textContent = 'No structural warnings detected.';
    body.append(message);
  }
  const report = document.createElement('div');
  report.className = 'gc-cleanup-report';
  // Only escaped labels and numeric cleanup statistics are rendered here.
  report.innerHTML = reportHtml;
  body.append(report);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    editor.off('remove', close);
    dialog.close(); dialog.remove();
    if (opener?.isConnected) opener.focus();
    if (document.activeElement === document.body) editor.focus();
  };
  const button = (label: string, primary = false) => {
    const host = document.createElement('gcds-button');
    host.type = 'button'; host.buttonRole = primary ? 'primary' : 'secondary'; host.textContent = label;
    return host;
  };
  const dismiss = button('Close'); dismiss.size = 'small';
  dismiss.setAttribute('aria-label', 'Close HTML Cleanup Report');
  dismiss.addEventListener('click', close);
  dialog.querySelector('header')!.append(dismiss);
  const cancel = button('Cancel'); cancel.addEventListener('click', close);
  const apply = button('Apply cleanup', true); apply.disabled = !result.hasChanges;
  apply.addEventListener('click', () => {
    if (!result.hasChanges) return;
    editor.undoManager.transact(() => editor.setContent(result.cleanedHtml));
    close();
    editor.notificationManager.open({ text: 'HTML cleanup completed.', type: 'success', timeout: 3000 });
  });
  dialog.querySelector('footer')!.append(cancel, apply);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
    if (event.key !== 'Tab') return;
    const hosts: HTMLElement[] = [dismiss, body, cancel, ...(apply.disabled ? [] : [apply])];
    const targets = hosts.map(host => host.shadowRoot?.querySelector<HTMLElement>('button') ?? host);
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    const position = targets.indexOf(active as HTMLElement);
    const next = position < 0 ? (event.shiftKey ? targets.length - 1 : 0)
      : (position + (event.shiftKey ? -1 : 1) + targets.length) % targets.length;
    event.preventDefault(); targets[next]!.focus();
  }, true);
  document.body.append(dialog);
  editor.on('remove', close);
  dialog.showModal();
  dialog.querySelector<HTMLElement>('h2')!.focus();
}
