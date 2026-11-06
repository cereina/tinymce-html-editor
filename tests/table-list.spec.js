import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const table = '<table><caption>Population</caption><thead><tr><th scope="col">Region</th><th scope="col">Total</th></tr></thead><tbody><tr><td>North</td><td>42</td></tr></tbody></table>';
const toc = '<nav data-generated-toc="true"><h2>On this page</h2><ul><li><a href="#content-heading">Content</a></li></ul></nav>';
const figures = '<section data-image-contents="true"><h2>List of figures</h2><ul><li><p>Existing figures</p></li></ul></section>';
async function ready(page, html = '<h1>Page</h1>' + toc + figures + '<h2 id="content-heading">Content</h2>' + table + table.replace('Population', 'Employment').replace('<table>', '<table id="existing-table">')) {
  await page.goto('/'); await page.waitForFunction(() => window.tinymce?.activeEditor?.initialized);
  await page.evaluate(html => { const e = window.tinymce.activeEditor; e.setContent(html); e.undoManager.clear(); e.undoManager.add(); }, html);
}
async function open(page) { await page.evaluate(() => window.tinymce.activeEditor.ui.registry.getAll().buttons.tablelist.onAction()); }
const insert = page => page.getByRole('button', { name: 'Insert list', exact: true }).click();
test('default H2 inserts between TOC and figures and links captions to stable table IDs', async ({ page }) => {
  await ready(page); await open(page);
  await expect(page.getByRole('combobox', { name: 'Heading level', exact: true })).toHaveValue('2');
  await insert(page);
  expect(await page.evaluate(() => {
    const e = window.tinymce.activeEditor; e.setContent(e.getContent()); const b = e.getBody(); const s = b.querySelector('[data-table-contents]');
    return { before: s.previousElementSibling.tagName, after: s.nextElementSibling.getAttribute('data-image-contents'), title: s.querySelector('h2').textContent, labels: [...s.querySelectorAll('a')].map(a => a.textContent), targets: [...s.querySelectorAll('a')].map(a => e.getDoc().getElementById(decodeURIComponent(a.hash.slice(1)))?.tagName), ids: [...b.querySelectorAll('table')].map(t => t.id) };
  })).toEqual({ before: 'NAV', after: 'true', title: 'List of tables', labels: ['Population', 'Employment'], targets: ['TABLE', 'TABLE'], ids: ['table-1', 'existing-table'] });
});
test('missing captions including nested tables block generation and identify the table', async ({ page }) => {
  await ready(page, table.replace('North', 'North<table><tr><td>Nested data</td></tr></table>')); await open(page);
  await expect(page.getByRole('dialog')).toContainText('Table 2:');
  await expect(page.getByRole('button', { name: 'Insert list', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Go to first missing caption', exact: true }).click();
  expect(await page.evaluate(() => window.tinymce.activeEditor.selection.getNode().textContent)).toContain('Nested data');
  expect(await page.evaluate(() => [...window.tinymce.activeEditor.getBody().querySelectorAll('table')].map(t => t.id))).toEqual(['', '']);
});
test('rechecks captions on apply, validates title, and Cancel makes no change', async ({ page }) => {
  await ready(page); await open(page); const before = await page.evaluate(() => window.tinymce.activeEditor.getContent());
  await page.getByRole('textbox', { name: 'Section heading (required)', exact: true }).fill(''); await insert(page);
  await expect(page.locator('.gc-tool-validation')).toContainText('Enter a section heading');
  await page.getByRole('textbox', { name: 'Section heading (required)', exact: true }).fill('Tables');
  await page.evaluate(() => window.tinymce.activeEditor.getBody().querySelector('caption').remove()); await insert(page);
  await expect(page.locator('.gc-tool-validation')).toContainText('Every table must have');
  expect(await page.evaluate(() => window.tinymce.activeEditor.getBody().querySelector('[data-table-contents]'))).toBeNull();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.evaluate(html => window.tinymce.activeEditor.setContent(html), before); await open(page); await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.tinymce.activeEditor.getContent())).toBe(before);
});
test('collapse layout, heading choice, relocation, updating and Undo are supported', async ({ page }) => {
  await ready(page); await open(page);
  await page.getByRole('combobox', { name: 'Section layout', exact: true }).selectOption('details');
  await page.getByRole('combobox', { name: 'Heading level', exact: true }).selectOption('3');
  await page.getByRole('combobox', { name: 'Insertion location', exact: true }).selectOption('end'); await insert(page);
  await expect(page.locator('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => window.tinymce.activeEditor.getBody().lastElementChild.querySelector('summary > h3').textContent)).toBe('List of tables');
  await open(page); await page.getByRole('combobox', { name: 'Insertion location', exact: true }).selectOption('auto');
  await page.getByRole('button', { name: 'Update list', exact: true }).click();
  expect(await page.evaluate(() => { const b = window.tinymce.activeEditor.getBody(); const list = b.querySelector('[data-table-contents]'); return [b.querySelectorAll('[data-table-contents]').length, list.previousElementSibling.tagName]; })).toEqual([1, 'NAV']);
  await page.evaluate(() => window.tinymce.activeEditor.undoManager.undo());
  expect(await page.evaluate(() => window.tinymce.activeEditor.getBody().lastElementChild.hasAttribute('data-table-contents'))).toBe(true);
  await page.evaluate(() => window.tinymce.activeEditor.undoManager.undo());
  expect(await page.evaluate(() => [...window.tinymce.activeEditor.getBody().querySelectorAll('table')].map(t => t.id))).toEqual(['', 'existing-table']);
});
test('recommended fallback respects figures, H1 and selected block placement', async ({ page }) => {
  for (const prefix of [figures, '<h1>Page</h1>', '']) {
    await ready(page, prefix + '<p id="placement">Insert after this paragraph.</p>' + table); await open(page); await insert(page);
    expect(await page.evaluate(() => { const b = window.tinymce.activeEditor.getBody(); const s = b.querySelector('[data-table-contents]'); return s.previousElementSibling?.tagName ?? 'FIRST'; })).toBe(prefix.startsWith('<h1') ? 'H1' : 'FIRST');
  }
  await ready(page, '<p id="placement">Selected block</p>' + table);
  await page.evaluate(() => { const e = window.tinymce.activeEditor; e.selection.select(e.getBody().querySelector('#placement')); }); await open(page);
  await page.getByRole('combobox', { name: 'Insertion location', exact: true }).selectOption('cursor'); await insert(page);
  expect(await page.evaluate(() => window.tinymce.activeEditor.getBody().querySelector('#placement').nextElementSibling.hasAttribute('data-table-contents'))).toBe(true);
});
for (const layout of ['standard', 'details']) test(`section building preserves the ${layout} table list without extra wrappers`, async ({ page }) => {
  await ready(page); await open(page); await page.getByRole('combobox', { name: 'Section layout', exact: true }).selectOption(layout); await insert(page);
  const before = await page.evaluate(() => window.tinymce.activeEditor.getBody().querySelector('[data-table-contents]').outerHTML);
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => window.tinymce.activeEditor.ui.registry.getAll().buttons.sections.fetch(items => items[0].onAction()));
    await page.getByRole('button', { name: i ? 'Rebuild Sections' : 'Build Sections', exact: true }).click();
    expect(await page.evaluate(() => { const s = window.tinymce.activeEditor.getBody().querySelector('[data-table-contents]'); return [s.outerHTML, s.closest('section[data-heading-section]') === null, s.querySelectorAll('section').length]; })).toEqual([before, true, 0]);
  }
});
test('popup and exported collapse section pass accessibility and keyboard checks', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 }); await ready(page); await open(page);
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const scan = () => page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => v.id));
  expect(await scan()).toEqual([]);
  for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement.closest('dialog[open]'))).toBe(true); }
  await page.getByRole('combobox', { name: 'Section layout', exact: true }).selectOption('details'); await insert(page);
  const html = await page.evaluate(() => window.tinymce.activeEditor.getContent());
  await page.setContent('<!doctype html><html lang="en"><head><title>Table list test</title></head><body><main>' + html + '</main></body></html>');
  await page.locator('details[data-table-contents] summary').focus(); await page.keyboard.press('Enter'); await expect(page.locator('details[data-table-contents]')).toHaveAttribute('open', '');
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') }); expect(await scan()).toEqual([]);
});

test('empty documents cannot generate a table list', async ({ page }) => {
  await ready(page, '<h2>No data</h2><p>Text only.</p>'); await open(page);
  await expect(page.getByRole('dialog')).toContainText('No tables were found');
  await expect(page.getByRole('button', { name: 'Insert list', exact: true })).toHaveCount(0);
});
test('ID generation avoids non-table IDs and repairs duplicate table IDs', async ({ page }) => {
  await ready(page, '<p id="table-1">Reserved</p>' + table.replace('<table>', '<table id="duplicate-table">') + table.replace('<table>', '<table id="duplicate-table">') + table);
  await open(page); await insert(page);
  expect(await page.evaluate(() => [...window.tinymce.activeEditor.getBody().querySelectorAll('table')].map(t => t.id))).toEqual(['duplicate-table', 'table-2', 'table-3']);
});
test('conflicting navigation order is explained and can be overridden explicitly', async ({ page }) => {
  await ready(page, figures + toc + '<h2 id="content-heading">Content</h2>' + table); await open(page); await insert(page);
  await expect(page.locator('.gc-tool-validation')).toContainText('figures list currently precedes');
  expect(await page.evaluate(() => window.tinymce.activeEditor.getBody().querySelector('[data-table-contents]'))).toBeNull();
  await page.getByRole('combobox', { name: 'Insertion location', exact: true }).selectOption('end'); await insert(page);
  expect(await page.evaluate(() => window.tinymce.activeEditor.getBody().lastElementChild.hasAttribute('data-table-contents'))).toBe(true);
});
