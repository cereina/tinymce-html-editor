import type { Editor } from 'tinymce';
import { openGcToolDialog } from '../prototype/tool-dialog';
import { openFigureList } from './figure-list';

interface ImageSettings { src: string; caption: string; alt: string; decorative: boolean }

/** Only suggest an adjacent prose paragraph, never headings or another image. */
function captionAbove(image: HTMLImageElement): HTMLParagraphElement | null {
  const block = image.closest('figure') ?? image.closest('p') ?? image;
  let previous = block.previousSibling;
  while (previous && (previous.nodeType === 8 || (previous.nodeType === 3 && !previous.textContent?.trim()))) previous = previous.previousSibling;
  if (!(previous instanceof image.ownerDocument.defaultView!.HTMLParagraphElement) || !previous.textContent?.trim() ||
    previous.querySelector('img,picture,video,audio,iframe,object,embed,input,button,select,textarea,[contenteditable="false"]') ||
    previous.closest('[contenteditable="false"]')) return null;
  return previous;
}

function plainText(element: Element): string { return (element.textContent ?? '').replace(/\s+/g, ' ').trim(); }

/** Split inline ancestors without losing sibling text, links or duplicating IDs. */
function splitAround(element: Element, target: Element): [Element | null, Element, Element | null] {
  if (element === target) return [null, element, null];
  const parts: Node[][] = [[], [], []];
  let passed = false;
  for (const child of Array.from(element.childNodes)) {
    if (child === target || child.contains(target)) {
      const [before, middle, after] = splitAround(child as Element, target);
      if (before) parts[0].push(before);
      parts[1].push(middle);
      if (after) parts[2].push(after);
      passed = true;
    } else parts[passed ? 2 : 0].push(child);
  }
  let usedId = false;
  const wrappers = parts.map(nodes => {
    if (!nodes.some(node => node.nodeType === 1 || node.textContent?.trim())) return null;
    const wrapper = element.cloneNode(false) as Element;
    if (usedId) wrapper.removeAttribute('id');
    usedId = true;
    wrapper.append(...nodes);
    return wrapper;
  });
  return [wrappers[0], wrappers[1]!, wrappers[2]];
}

function captionId(body: HTMLElement): string {
  const ids = new Set(Array.from(body.querySelectorAll('[id]'), node => node.id));
  let index = 1;
  while (ids.has('img_' + index)) index++;
  return 'img_' + index;
}

export function applyImageFigure(editor: Editor, image: HTMLImageElement, settings: ImageSettings): void {
  const doc = image.ownerDocument;
  let figure = image.closest('figure');
  const paragraph = image.closest('p');
  if (!figure) {
    figure = doc.createElement('figure');
    const payload = image.closest('picture') ?? image;
    if (paragraph) {
      const [before, middle, after] = splitAround(paragraph, payload);
      for (const attribute of Array.from(middle.attributes)) figure.setAttribute(attribute.name, attribute.value);
      figure.append(...Array.from(middle.childNodes));
      paragraph.replaceWith(...[before, figure, after].filter((node): node is Element => !!node));
    } else {
      const link = payload.parentElement?.tagName === 'A' ? payload.parentElement : payload;
      link.before(figure); figure.append(link);
    }
  } else if (paragraph && paragraph.closest('figure') === figure) {
    paragraph.replaceWith(...Array.from(paragraph.childNodes));
  }
  let caption = Array.from(figure.children).find(child => child.tagName === 'FIGCAPTION') as HTMLElement | undefined;
  if (!caption) { caption = doc.createElement('figcaption'); figure.prepend(caption); }
  if (!caption.id) caption.id = captionId(editor.getBody());
  const strong = doc.createElement('strong'); strong.textContent = settings.caption;
  caption.replaceChildren(strong); figure.prepend(caption);
  editor.dom.setAttrib(image, 'src', settings.src);
  image.setAttribute('alt', settings.decorative ? '' : settings.alt);
  image.classList.add('img-responsive');
  if (!settings.decorative) {
    if (['presentation', 'none'].includes(image.getAttribute('role') ?? '')) image.removeAttribute('role');
    if (image.getAttribute('aria-hidden') === 'true') image.removeAttribute('aria-hidden');
  }
}

export function openImageFigures(editor: Editor): void {
  const images = Array.from(editor.getBody().querySelectorAll<HTMLImageElement>('img'))
    .filter(image => !image.closest('[contenteditable="false"]'));
  let index = 0;
  const next = () => {
    while (index < images.length && !editor.getBody().contains(images[index])) index++;
    if (index >= images.length) { openFigureList(editor); return; }
    const image = images[index];
    const existing = image.closest('figure')?.querySelector('figcaption');
    const suggestion = captionAbove(image);
    const originalSuggestion = suggestion?.outerHTML;
    const suggestedText = suggestion ? plainText(suggestion) : '';
    openGcToolDialog(editor, {
      title: `Review image ${index + 1} of ${images.length}`,
      body: { type: 'panel', items: [
        { type: 'htmlpanel', html: '<p>Provide the image source path and caption. The caption appears above the image. Alternative text describes the image’s purpose; it is required unless the image is decorative. Apply changes to this image, skip it, or close to stop. Earlier applied changes remain available through editor Undo.</p>' },
        { type: 'input', name: 'src', label: 'Image source path (required)', placeholder: 'For example: images/photo.jpg or https://example.ca/photo.jpg' },
        { type: 'input', name: 'caption', label: 'Image caption (required)' },
        ...(suggestion ? [
          { type: 'input' as const, name: 'suggestedCaption', label: 'Suggested caption from paragraph above (editable)' },
          { type: 'checkbox' as const, name: 'useAbove', label: 'Use the suggested caption and remove the original paragraph above the image' },
          { type: 'htmlpanel' as const, html: '<p>Select the checkbox to accept the suggestion instead of the Image caption field. Leave it unchecked to keep the original paragraph. The paragraph is removed only when you apply.</p>' },
        ] : []),
        { type: 'checkbox', name: 'decorative', label: 'This image is decorative' },
        { type: 'input', name: 'alt', label: 'Alternative text (required unless decorative)', placeholder: 'Describe the image’s information or purpose. Decorative images receive an empty alt attribute.' },
      ] },
      initialData: { src: image.getAttribute('src') ?? '', caption: existing?.textContent ?? 'Add image caption', suggestedCaption: suggestedText, useAbove: false,
        alt: image.getAttribute('alt') ?? '', decorative: image.hasAttribute('alt') && image.getAttribute('alt') === '' },
      buttons: [{ type: 'cancel', text: 'Close' }, { type: 'custom', name: 'skip', text: 'Skip image' },
        { type: 'submit', text: index === images.length - 1 ? 'Apply' : 'Apply and next', buttonType: 'primary' }],
      onAction: api => { api.close(); index++; next(); },
      onSubmit: api => {
        const data = api.getData();
        const useAbove = data.useAbove === true;
        const settings: ImageSettings = { src: String(data.src).trim(), caption: String(useAbove ? data.suggestedCaption : data.caption).trim(), alt: String(data.alt).trim(), decorative: data.decorative === true };
        let error = '';
        if (!settings.src) error = 'Enter an image source path.';
        else if (/[\u0000-\u001f\u007f]/.test(settings.src)) error = 'Remove control characters from the image source path.';
        else if (/^[\u0000-\u0020]*[a-z][a-z0-9+.-]*:/i.test(settings.src) && !/^(https?:|blob:|data:image\/(png|jpeg|gif|webp|avif);)/i.test(settings.src)) error = 'Use a relative image path, an HTTP or HTTPS URL, or a supported image data URL.';
        else if (!settings.caption) error = 'Enter an image caption.';
        else if (!settings.decorative && !settings.alt) error = 'Enter alternative text or mark the image as decorative.';
        else if (settings.decorative && image.closest('a') && !image.closest('a')!.textContent?.trim() &&
          !image.closest('a')!.hasAttribute('aria-label') && !image.closest('a')!.hasAttribute('aria-labelledby') &&
          !Array.from(image.closest('a')!.querySelectorAll('img')).some(other => other !== image && other.alt.trim())) error = 'This image is the only label for a link. Provide alternative text describing the link destination instead of marking it decorative.';
        else if (!editor.getBody().contains(image)) error = 'This image is no longer in the document. Close and reopen Review images.';
        else if (useAbove && (!suggestion || captionAbove(image) !== suggestion || suggestion.outerHTML !== originalSuggestion)) error = 'The paragraph above this image changed. Close and reopen Review images to refresh the suggestion.';
        if (error) { editor.notificationManager.open({ type: 'error', text: error }); return; }
        editor.undoManager.transact(() => {
          applyImageFigure(editor, image, settings);
          if (useAbove && suggestion) {
            const caption = image.closest('figure')!.querySelector('figcaption')!;
            const strong = caption.querySelector('strong')!;
            // Keep inline links/IDs when the suggested wording was accepted unchanged.
            if (settings.caption === suggestedText) strong.replaceChildren(...Array.from(suggestion.childNodes));
            else {
              // Preserve anchor targets even when the coder edits the suggested wording.
              suggestion.querySelectorAll('[id]').forEach(node => {
                const anchor = image.ownerDocument.createElement('span'); anchor.id = node.id; caption.append(anchor);
              });
            }
            const metadata = image.ownerDocument.createElement('span');
            for (const attribute of Array.from(suggestion.attributes)) metadata.setAttribute(attribute.name, attribute.value);
            if (metadata.attributes.length) { strong.replaceWith(metadata); metadata.append(strong); }
            suggestion.remove();
          }
        });
        editor.nodeChanged(); editor.setDirty(true); api.close(); index++; next();
      },
    });
  };
  if (!images.length) {
    openGcToolDialog(editor, { title: 'Review images', body: { type: 'panel', items: [
      { type: 'htmlpanel', html: '<p>No editable images were found. Add images to the document, then run Review images.</p>' },
    ] }, buttons: [{ type: 'cancel', text: 'Close' }] });
  } else next();
}

export function registerImageFigures(editor: Editor): void {
  editor.ui.registry.addButton('imagefigures', { text: 'Review images', tooltip: 'Review images: captions and alternative text', onAction: () => openImageFigures(editor) });
}
