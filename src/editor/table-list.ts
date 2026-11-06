import type { Editor } from 'tinymce';
import { openGcToolDialog } from '../prototype/tool-dialog';

const tablesIn = (editor: Editor) => Array.from(editor.getBody().querySelectorAll('table'));
const missingCaptions = (tables: HTMLTableElement[]) => tables.filter(table => !table.caption?.textContent?.trim());
const escapeText = (text: string) => { const node = document.createElement('span'); node.textContent = text; return node.innerHTML; };

export function openTableList(editor: Editor): void {
  const tables = tablesIn(editor);
  const missing = missingCaptions(tables);
  if (!tables.length || missing.length) {
    openGcToolDialog(editor, {
      title: 'List of tables', body: { type: 'panel', items: [{ type: 'htmlpanel', html: !tables.length
        ? '<p>No tables were found. Add tables with captions before generating a List of tables.</p>'
        : `<h3>All tables need captions</h3><p>Add a non-empty caption to each table below using Table Accessibility, then reopen List of tables. No list or IDs have been changed.</p><ul>${missing.map(table => `<li>Table ${tables.indexOf(table) + 1}: ${table.rows.length} rows, missing or empty caption</li>`).join('')}</ul>` }] },
      buttons: [...(missing.length ? [{ type: 'custom' as const, name: 'go', text: 'Go to first missing caption' }] : []), { type: 'cancel', text: 'Close' }],
      onAction: api => { const table = missing.find(table => editor.getBody().contains(table)); if (!table) return; api.close(); editor.focus(); editor.selection.select(table.querySelector('td,th') ?? table); table.scrollIntoView({ block: 'center' }); },
    }); return;
  }
  const body = editor.getBody();
  const existing = body.querySelector<HTMLElement>('[data-table-contents="true"]');
  const currentHeading = existing?.querySelector('h2,h3,h4,h5,h6');
  let cursorBlock: HTMLElement | null = editor.selection.getNode();
  while (cursorBlock && cursorBlock !== body && cursorBlock.parentElement !== body) cursorBlock = cursorBlock.parentElement;
  if (cursorBlock === body) cursorBlock = null;
  openGcToolDialog(editor, {
    title: 'List of tables', body: { type: 'panel', items: [
      { type: 'htmlpanel', html: `<p>All ${tables.length} tables have captions. Each list entry will link its caption text to the table ID. Missing or duplicate IDs will be assigned unique table-N IDs when you apply.</p><p>Recommended placement is immediately below the TOC, before the List of figures. Without a TOC it goes before the figures list; without either list it goes at the start, after a leading H1 title. You can choose another location below. Match the heading level to the surrounding document.</p>${existing ? '<p>The existing generated list will be updated, rather than duplicated. Keep its position or choose a new location.</p>' : ''}` },
      { type: 'input', name: 'title', label: 'Section heading (required)' },
      { type: 'selectbox', name: 'level', label: 'Heading level', items: [2, 3, 4, 5, 6].map(level => ({ text: `H${level}`, value: String(level) })) },
      { type: 'selectbox', name: 'layout', label: 'Section layout', items: [{ text: 'Heading with list below', value: 'standard' }, { text: 'Expand/collapse section', value: 'details' }] },
      { type: 'selectbox', name: 'position', label: 'Insertion location', items: [
        ...(existing ? [{ text: 'Keep current position', value: 'keep' }] : []),
        { text: 'Recommended — below TOC and above figures list', value: 'auto' },
        { text: 'Document start — after a leading H1 title', value: 'start' },
        { text: 'Document end', value: 'end' },
        ...(cursorBlock && !cursorBlock.contains(existing) ? [{ text: 'After the content block selected before opening this window', value: 'cursor' }] : []),
      ] },
      { type: 'htmlpanel', html: `<h3>Table captions</h3><ol>${tables.map(table => `<li>${escapeText(table.caption!.textContent!.trim())}</li>`).join('')}</ol>` },
    ] },
    initialData: { title: currentHeading?.textContent ?? 'List of tables', level: currentHeading?.tagName.slice(1) ?? '2', layout: existing?.tagName === 'DETAILS' ? 'details' : 'standard', position: existing ? 'keep' : 'auto' },
    buttons: [{ type: 'cancel', text: 'Cancel' }, { type: 'submit', text: existing ? 'Update list' : 'Insert list', buttonType: 'primary' }],
    onSubmit: api => {
      const data = api.getData(); const title = String(data.title).trim(); const level = String(data.level); const layout = String(data.layout); const position = String(data.position);
      const current = tablesIn(editor); const previous = body.querySelector<HTMLElement>('[data-table-contents="true"]');
      const toc = body.querySelector<HTMLElement>('nav[data-generated-toc="true"]'); const figures = body.querySelector<HTMLElement>('[data-image-contents="true"]');
      let error = '';
      if (!title) error = 'Enter a section heading.';
      else if (!current.length || missingCaptions(current).length) error = 'Every table must have a non-empty caption. Close this window, add the missing captions, and reopen List of tables.';
      else if (!/^[2-6]$/.test(level) || !['standard', 'details'].includes(layout) || !['auto', 'start', 'end', 'cursor', 'keep'].includes(position)) error = 'Review your list settings.';
      else if (position === 'cursor' && (!cursorBlock || !body.contains(cursorBlock) || cursorBlock.contains(previous))) error = 'The selected insertion block changed. Choose another insertion location.';
      else if (position === 'keep' && !previous) error = 'The existing list was removed. Choose another insertion location.';
      else if (position === 'auto' && toc && figures && (toc.contains(figures) || figures.contains(toc) || !(toc.compareDocumentPosition(figures) & 4))) error = 'The figures list currently precedes or contains the TOC. Move it below the TOC or choose another insertion location.';
      if (error) { editor.notificationManager.open({ type: 'error', text: error }); return; }
      editor.undoManager.transact(() => {
        const doc = editor.getDoc(); const ids = new Set(Array.from(body.querySelectorAll('[id]'), node => node.id));
        const unique = (prefix: string) => { let n = 1; while (ids.has(prefix + n)) n++; const id = prefix + n; ids.add(id); return id; };
        const section = doc.createElement(layout === 'details' ? 'details' : 'section'); section.setAttribute('data-table-contents', 'true');
        const heading = doc.createElement('h' + level); heading.textContent = title; heading.id = previous?.querySelector('h2,h3,h4,h5,h6')?.id || unique('table-list-title-');
        section.setAttribute('aria-labelledby', heading.id);
        if (layout === 'details') { const summary = doc.createElement('summary'); summary.append(heading); section.append(summary); } else section.append(heading);
        const list = doc.createElement('ul');
        current.forEach(table => {
          if (!table.id.trim() || Array.from(body.querySelectorAll('[id]')).find(node => node.id === table.id) !== table) table.id = unique('table-');
          const item = doc.createElement('li'); const paragraph = doc.createElement('p'); const link = doc.createElement('a');
          link.setAttribute('href', '#' + encodeURIComponent(table.id)); link.textContent = table.caption!.textContent!.replace(/\s+/g, ' ').trim(); paragraph.append(link); item.append(paragraph); list.append(item);
        }); section.append(list);
        if (position === 'keep' && previous) previous.replaceWith(section);
        else {
          previous?.remove();
          if (position === 'cursor') cursorBlock!.after(section);
          else if (position === 'end') body.append(section);
          else if (position === 'auto' && toc) toc.after(section);
          else if (position === 'auto' && figures) figures.before(section);
          else if (body.firstElementChild?.tagName === 'H1') body.firstElementChild.after(section);
          else body.prepend(section);
        }
      });
      editor.nodeChanged(); editor.setDirty(true); api.close();
    },
  });
}

export function registerTableList(editor: Editor): void {
  editor.ui.registry.addButton('tablelist', { text: 'List of tables', tooltip: 'List of tables: generate links to table captions', onAction: () => openTableList(editor) });
}
