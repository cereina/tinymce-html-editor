import type { Editor } from 'tinymce';
import { openGcToolDialog } from '../prototype/tool-dialog';

function ownedCells(table: HTMLTableElement): HTMLTableCellElement[] {
  return Array.from(table.rows).flatMap(row => Array.from(row.cells));
}

export function hasTableHeaderMarkup(table: HTMLTableElement): boolean {
  return !!table.tHead || ownedCells(table).some(cell => cell.tagName === 'TH' || ['scope', 'headers', 'id', 'abbr', 'axis', 'aria-sort'].some(name => cell.hasAttribute(name)) || ['columnheader', 'rowheader'].includes(cell.getAttribute('role') || ''));
}

/** Clear header semantics only for this table, preserving nested tables and
 * cell IDs still referenced by retained links or ARIA relationships. */
function removeHeaderMarkup(editor: Editor, table: HTMLTableElement): number {
  const cells = ownedCells(table);
  const owned = new Set<Element>(cells);
  const referenced = new Set<string>();
  const idRefs = ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-activedescendant', 'aria-details', 'aria-errormessage', 'aria-flowto', 'for'];
  editor.getBody().querySelectorAll('*').forEach(element => {
    const href = element.getAttribute('href');
    if (href?.startsWith('#')) {
      try { referenced.add(decodeURIComponent(href.slice(1))); } catch { referenced.add(href.slice(1)); }
    }
    [...idRefs, ...(owned.has(element) ? [] : ['headers'])].forEach(name => {
      (element.getAttribute(name) || '').split(/\s+/).filter(Boolean).forEach(id => referenced.add(id));
    });
  });
  let kept = 0;
  cells.forEach(original => {
    let cell = original;
    if (original.tagName === 'TH') {
      cell = original.ownerDocument.createElement('td');
      Array.from(original.attributes).forEach(attribute => cell.setAttribute(attribute.name, attribute.value));
      cell.append(...Array.from(original.childNodes)); original.replaceWith(cell);
    }
    ['scope', 'headers', 'abbr', 'axis', 'aria-sort', 'data-table-group-header'].forEach(name => cell.removeAttribute(name));
    if (['columnheader', 'rowheader'].includes(cell.getAttribute('role') || '')) cell.removeAttribute('role');
    if (cell.id) { if (referenced.has(cell.id)) kept++; else cell.removeAttribute('id'); }
  });
  // A THEAD would still be detected as header rows when reopening settings.
  if (table.tHead) {
    const head = table.tHead;
    const firstBody = table.tBodies[0];
    const boundedSpans = Array.from(head.rows).every((row, index) => Array.from(row.cells).every(cell => cell.rowSpan > 0 && cell.rowSpan <= head.rows.length - index));
    if (firstBody && !head.attributes.length && boundedSpans) {
      // Avoid introducing an extra row group into an ordinary simple table.
      firstBody.prepend(...Array.from(head.childNodes)); head.remove();
    } else {
      // Retain attributed sections and row-group-dependent spans (rowspan=0).
      const body = head.ownerDocument.createElement('tbody');
      Array.from(head.attributes).forEach(attribute => body.setAttribute(attribute.name, attribute.value));
      body.append(...Array.from(head.childNodes)); head.replaceWith(body);
    }
  }
  return kept;
}

export function openRemoveTableHeaderMarkup(editor: Editor, table: HTMLTableElement): void {
  openGcToolDialog(editor, {
    title: 'Remove Table Header Markup',
    body: { type: 'panel', items: [{ type: 'htmlpanel', html: `
      <p>Remove header markup from the selected table so you can configure its headers again.</p>
      <ul><li>Convert header cells (TH) to data cells (TD), and header row groups (THEAD) to body row groups (TBODY).</li>
      <li>Remove scope, headers, and header-specific cell attributes.</li>
      <li>Remove cell IDs unless they are still used by a link or an ARIA label or description.</li></ul>
      <p>Cell content, merged cells, the caption, and nested tables are preserved. You can undo this change.</p>
      <p>A data table still needs correctly configured headers before publication.</p>` }] },
    buttons: [{ type: 'cancel', text: 'Cancel' }, { type: 'submit', text: 'Remove header markup', buttonType: 'primary' }],
    onSubmit: api => {
      if (!table.isConnected) { api.close(); return; }
      let kept = 0;
      editor.undoManager.transact(() => { kept = removeHeaderMarkup(editor, table); editor.selection.select(table.rows[0]?.cells[0] || table); editor.nodeChanged(); });
      api.close();
      editor.notificationManager.open({ text: 'Table header markup removed.' + (kept ? ` ${kept} referenced cell ID(s) kept to preserve links and labels.` : ''), type: 'success', timeout: 5000 });
    },
  });
}
