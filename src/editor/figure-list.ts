import type { Editor } from 'tinymce';
import { openGcToolDialog } from '../prototype/tool-dialog';

function captions(editor: Editor): HTMLElement[] {
  return Array.from(editor.getBody().querySelectorAll<HTMLElement>('figure > figcaption')).filter(caption =>
    caption.textContent?.trim() && !caption.closest('[contenteditable="false"]') &&
    Array.from(caption.parentElement!.querySelectorAll('img')).some(image => image.closest('figure') === caption.parentElement));
}

export function openFigureList(editor: Editor): void {
  const existing = editor.getBody().querySelector<HTMLElement>('[data-image-contents="true"]');
  const count = captions(editor).length;
  if (!count) return;
  const currentHeading = existing?.querySelector('h2,h3,h4,h5,h6');
  openGcToolDialog(editor, {
    title: 'List of figures',
    body: { type: 'panel', items: [
      { type: 'htmlpanel', html: `<p>Image review is complete. You can add a list linking to the ${count} image captions currently in the document, or choose Not now.</p><p>Choose where to add this section: document start places it before the first content, except a leading H1 page title; document end places it after the last content. A list near the beginning helps readers find images. Match the heading level to the surrounding document structure.</p>${existing ? '<p>The existing generated list will be updated at its current position; the insertion location applies only to a new list.</p>' : ''}` },
      { type: 'input', name: 'title', label: 'Section heading (required)' },
      { type: 'selectbox', name: 'level', label: 'Heading level', items: [2, 3, 4, 5, 6].map(level => ({ text: `H${level}`, value: String(level) })) },
      { type: 'selectbox', name: 'layout', label: 'Section layout', items: [
        { text: 'Heading with list below', value: 'standard' }, { text: 'Expand/collapse section', value: 'details' },
      ] },
      { type: 'selectbox', name: 'position', label: 'Insertion location (new list)', items: [
        { text: 'Document start — after a leading H1 title, if present', value: 'start' }, { text: 'Document end — after the last content', value: 'end' },
      ] },
    ] },
    initialData: { title: currentHeading?.textContent ?? 'List of figures', level: currentHeading?.tagName.slice(1) ?? '2', layout: existing?.tagName === 'DETAILS' ? 'details' : 'standard', position: 'start' },
    buttons: [{ type: 'cancel', text: 'Not now' }, { type: 'submit', text: existing ? 'Update list' : 'Insert list', buttonType: 'primary' }],
    onSubmit: api => {
      const data = api.getData(); const title = String(data.title).trim();
      const level = String(data.level); const layout = String(data.layout); const position = String(data.position);
      const currentCaptions = captions(editor);
      if (!title || !/^[2-6]$/.test(level) || !['standard', 'details'].includes(layout) || !['start', 'end'].includes(position) || !currentCaptions.length) {
        editor.notificationManager.open({ type: 'error', text: !title ? 'Enter a section heading.' : 'Review the list settings and make sure the document still has image captions.' }); return;
      }
      editor.undoManager.transact(() => {
        const body = editor.getBody(); const doc = editor.getDoc();
        const ids = new Set(Array.from(body.querySelectorAll('[id]'), node => node.id));
        const unique = (prefix: string) => { let index = 1; while (ids.has(prefix + index)) index++; const id = prefix + index; ids.add(id); return id; };
        const section = doc.createElement(layout === 'details' ? 'details' : 'section');
        section.setAttribute('data-image-contents', 'true');
        const previous = body.querySelector('[data-image-contents="true"]');
        const previousHeading = previous?.querySelector('h2,h3,h4,h5,h6');
        const heading = doc.createElement('h' + level); heading.id = previousHeading?.id || unique('figure-list-title-'); heading.textContent = title;
        section.setAttribute('aria-labelledby', heading.id);
        if (layout === 'details') {
          const summary = doc.createElement('summary'); summary.append(heading); section.append(summary);
        } else section.append(heading);
        const list = doc.createElement('ul');
        currentCaptions.forEach(caption => {
          if (!caption.id || Array.from(body.querySelectorAll('[id]')).find(node => node.id === caption.id) !== caption) caption.id = unique('img_');
          const item = doc.createElement('li'); const link = doc.createElement('a');
          link.setAttribute('href', '#' + encodeURIComponent(caption.id)); link.textContent = caption.textContent!.replace(/\s+/g, ' ').trim();
          // Paragraph spacing also keeps adjacent link targets apart on unstyled pages.
          const paragraph = doc.createElement('p'); paragraph.append(link);
          item.append(paragraph); list.append(item);
        });
        section.append(list);
        if (previous) previous.replaceWith(section);
        else if (position === 'end') body.append(section);
        else if (body.firstElementChild?.tagName === 'H1') body.firstElementChild.after(section);
        else body.prepend(section);
      });
      editor.nodeChanged(); editor.setDirty(true); api.close();
    },
  });
}
