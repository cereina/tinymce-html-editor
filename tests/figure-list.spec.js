import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
async function open(page) {
  await page.goto('/'); await page.waitForFunction(() => window.tinymce?.activeEditor?.initialized);
  await page.evaluate(pixel => {
    const e = window.tinymce.activeEditor;
    e.setContent(`<h2>Introduction</h2><p>Welcome.</p><p><img src="${pixel}" alt="A forest"></p><figure><figcaption id="img_8"><strong>A lake</strong></figcaption><img src="${pixel}" alt="Lake"></figure>`);
    e.ui.registry.getAll().buttons.imagefigures.onAction();
  }, pixel);
  await page.getByRole('textbox', { name: 'Image caption (required)', exact: true }).fill('A forest');
  await page.getByRole('button', { name: 'Apply and next', exact: true }).click();
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'List of figures', exact: true })).toBeVisible();
}
test('completion offers optional H2 list, preserves caption links through serialization and supports Undo', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('combobox', { name: 'Heading level', exact: true })).toHaveValue('2');
  await expect(page.getByRole('dialog')).toContainText('document start places it before the first content');
  await page.getByRole('textbox', { name: 'Section heading (required)', exact: true }).fill('Images in this document');
  await page.getByRole('button', { name: 'Insert list', exact: true }).click();
  const result = await page.evaluate(() => {
    const e = window.tinymce.activeEditor; const html = e.getContent(); e.setContent(html);
    const b = e.getBody(); const s = b.querySelector('[data-image-contents]');
    return { first: b.firstElementChild === s, title: s.querySelector('h2').textContent, labels: [...s.querySelectorAll('a')].map(a => a.textContent), targets: [...s.querySelectorAll('a')].map(a => e.getDoc().getElementById(decodeURIComponent(a.hash.slice(1)))?.tagName), labelled: e.getDoc().getElementById(s.getAttribute('aria-labelledby'))?.textContent };
  });
  expect(result).toEqual({ first: true, title: 'Images in this document', labels: ['A forest', 'A lake'], targets: ['FIGCAPTION', 'FIGCAPTION'], labelled: 'Images in this document' });
});
test('collapse layout has heading in summary, selectable level, insertion at end and Undo', async ({ page }) => {
  await open(page);
  await page.getByRole('combobox', { name: 'Section layout', exact: true }).selectOption('details');
  await page.getByRole('combobox', { name: 'Heading level', exact: true }).selectOption('3');
  await page.getByRole('combobox', { name: 'Insertion location (new list)', exact: true }).selectOption('end');
  await page.getByRole('button', { name: 'Insert list', exact: true }).click();
  expect(await page.evaluate(() => {
    const b = window.tinymce.activeEditor.getBody(); const d = b.querySelector('details[data-image-contents]'); return { last: b.lastElementChild === d, heading: d.querySelector('summary > h3')?.textContent, count: d.querySelectorAll(':scope > ul > li').length, closed: !d.hasAttribute('open') };
  })).toEqual({ last: true, heading: 'List of figures', count: 2, closed: true });
  await page.evaluate(() => window.tinymce.activeEditor.undoManager.undo());
  expect(await page.evaluate(() => window.tinymce.activeEditor.getBody().querySelector('[data-image-contents]'))).toBeNull();
  expect(await page.evaluate(() => window.tinymce.activeEditor.getBody().querySelectorAll('figure').length)).toBe(2);
});
test('cancel leaves images unchanged, blank heading validates, and repeated use updates one list', async ({ page }) => {
  await open(page);
  await page.getByRole('textbox', { name: 'Section heading (required)', exact: true }).fill('');
  await page.getByRole('button', { name: 'Insert list', exact: true }).click();
  await expect(page.locator('.gc-tool-validation')).toContainText('Enter a section heading');
  const before = await page.evaluate(() => window.tinymce.activeEditor.getContent());
  await page.getByRole('button', { name: 'Not now', exact: true }).click();
  expect(await page.evaluate(() => window.tinymce.activeEditor.getContent())).toBe(before);
  await page.evaluate(async () => { const { openFigureList } = await import('/src/editor/figure-list.ts'); openFigureList(window.tinymce.activeEditor); });
  await page.getByRole('button', { name: 'Insert list', exact: true }).click();
  await page.evaluate(async () => { const { openFigureList } = await import('/src/editor/figure-list.ts'); openFigureList(window.tinymce.activeEditor); });
  await page.getByRole('combobox', { name: 'Section layout', exact: true }).selectOption('details');
  await page.getByRole('button', { name: 'Update list', exact: true }).click();
  expect(await page.evaluate(() => window.tinymce.activeEditor.getBody().querySelectorAll('[data-image-contents]').length)).toBe(1);
});
test('list dialog passes narrow viewport accessibility and traps keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 }); await open(page);
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  expect(await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => v.id))).toEqual([]);
  expect(await page.locator('.gc-tool-body').evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
  for (let i = 0; i < 16; i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement.closest('dialog[open]'))).toBe(true); }
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('exported collapse list keeps H1 first, repairs duplicate IDs and opens by keyboard', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const b = window.tinymce.activeEditor.getBody(); const title = b.ownerDocument.createElement('h1'); title.textContent = 'Page title'; b.prepend(title);
    b.querySelectorAll('figcaption').forEach(caption => { caption.id = 'duplicate-caption'; });
  });
  await page.getByRole('combobox', { name: 'Section layout', exact: true }).selectOption('details');
  await page.getByRole('button', { name: 'Insert list', exact: true }).click();
  const html = await page.evaluate(() => {
    const e = window.tinymce.activeEditor; e.setContent(e.getContent()); return e.getContent();
  });
  await page.setContent('<!doctype html><html lang="en"><head><title>Figure list export test</title></head><body><main>' + html + '</main></body></html>');
  expect(await page.locator('main > :first-child').evaluate(e => e.tagName)).toBe('H1');
  await expect(page.locator('details summary > h2')).toHaveText('List of figures');
  expect(await page.locator('details li a').evaluateAll(links => links.map(a => document.getElementById(decodeURIComponent(a.hash.slice(1)))?.tagName))).toEqual(['FIGCAPTION', 'FIGCAPTION']);
  const ids = await page.locator('[id]').evaluateAll(nodes => nodes.map(e => e.id)); expect(new Set(ids).size).toBe(ids.length);
  await page.locator('summary').focus(); await page.keyboard.press('Enter'); await expect(page.locator('details')).toHaveAttribute('open', '');
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  expect(await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => v.id))).toEqual([]);
});
