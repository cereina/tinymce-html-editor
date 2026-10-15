import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const simple = '<h2>Document</h2><table id="outer"><caption>Population</caption><tbody><tr><td>Region</td><td>Total</td></tr><tr><td>North</td><td>42</td></tr></tbody></table>';
const complex = '<h2>Complex data</h2><table id="outer"><caption>Grouped population</caption><thead><tr><th rowspan="2" scope="col">Region</th><th colspan="2" scope="colgroup">Year</th></tr><tr><th scope="col">2025</th><th scope="col">2026</th></tr></thead><tbody><tr><th scope="row">North</th><td colspan="2">42</td></tr><tr><th scope="row">South</th><td>30</td><td>40</td></tr></tbody></table>';
async function ready(page, html = simple) {
  await page.goto('/'); await page.waitForFunction(() => window.tinymce?.activeEditor?.initialized);
  await page.evaluate(html => { const editor = window.tinymce.activeEditor; editor.setContent(html); editor.undoManager.clear(); editor.undoManager.add(); }, html);
}
async function settings(page) {
  await page.evaluate(() => { const editor = window.tinymce.activeEditor; const table = editor.getBody().querySelector('#outer'); editor.selection.select(table.querySelector('td,th')); editor.ui.registry.getAll().buttons.tableaccessibility.onAction(); });
  await expect(page.getByRole('dialog', { name: 'Table Accessibility', exact: true })).toBeVisible();
}
async function confirmation(page) {
  await settings(page); await page.getByRole('button', { name: 'Remove header markup…', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Remove Table Header Markup', exact: true })).toBeVisible();
}
async function confirm(page) {
  await page.getByRole('button', { name: 'Remove header markup', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function snapshot(page) {
  return page.evaluate(() => {
    const table = window.tinymce.activeEditor.getBody().querySelector('#outer');
    const cells = [...table.rows].flatMap(row => [...row.cells]);
    return { headers: cells.filter(cell => cell.tagName === 'TH').length, attributes: cells.filter(cell => ['scope', 'headers', 'id'].some(name => cell.hasAttribute(name))).length, text: cells.map(cell => cell.textContent), caption: table.caption.textContent, thead: !!table.tHead };
  });
}

test('Applied table headers can be removed, undone, redone, and configured again', async ({ page }) => {
  await ready(page); await settings(page);
  await page.getByRole('combobox', { name: /^Top rows used/ }).selectOption('1');
  const rowHeader = page.getByRole('checkbox', { name: /^Use the first column/ }); await rowHeader.focus(); await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Apply accessibility', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  const applied = await page.evaluate(() => window.tinymce.activeEditor.getContent());
  expect((await snapshot(page)).headers).toBeGreaterThan(0);
  await confirmation(page); await confirm(page);
  expect(await snapshot(page)).toEqual({ headers: 0, attributes: 0, text: ['Region', 'Total', 'North', '42'], caption: 'Population', thead: false });
  await page.evaluate(() => window.tinymce.activeEditor.undoManager.undo()); expect(await page.evaluate(() => window.tinymce.activeEditor.getContent())).toBe(applied);
  await page.evaluate(() => window.tinymce.activeEditor.undoManager.redo()); expect((await snapshot(page)).headers).toBe(0);
  await settings(page); await page.getByRole('combobox', { name: /^Top rows used/ }).selectOption('1');
  await page.getByRole('button', { name: 'Apply accessibility', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await snapshot(page)).headers).toBeGreaterThan(0);
});

test('Complex-table generated IDs and headers can be cleared without changing merged cells', async ({ page }) => {
  await ready(page, complex); await settings(page);
  await page.getByRole('button', { name: 'Review relationships', exact: true }).click();
  await page.getByRole('button', { name: 'Apply relationships', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => window.tinymce.activeEditor.getBody().querySelectorAll('#outer td[headers]').length)).toBeGreaterThan(0);
  const before = (await snapshot(page)).text;
  await confirmation(page); await confirm(page);
  const after = await snapshot(page); expect(after.headers).toBe(0); expect(after.attributes).toBe(0); expect(after.text).toEqual(before);
  expect(await page.evaluate(() => window.tinymce.activeEditor.getBody().querySelector('#outer td[colspan="2"]').colSpan)).toBe(2);
  expect(await page.evaluate(() => window.tinymce.activeEditor.getBody().querySelector('#outer td[rowspan="2"]').rowSpan)).toBe(2);
});

test('Reset preserves referenced IDs, nested tables, content, caption, and other table markup', async ({ page }) => {
  await ready(page, '<h2>Document</h2><p><a href="#linked">Jump</a></p><table id="outer" class="custom"><caption>Outer</caption><thead><tr><th id="linked" scope="col">Linked</th><th id="unused" scope="col" abbr="N" aria-sort="ascending">Name</th></tr></thead><tbody><tr><td headers="linked unused">Value<table id="nested"><tbody><tr><th id="nested-header" scope="row">Inner</th><td headers="nested-header">Data</td></tr></tbody></table></td><td><strong>42</strong></td></tr></tbody></table><table id="other"><tbody><tr><th id="other-header" scope="row">Other</th></tr></tbody></table>');
  const before = await page.evaluate(() => ({ nested: window.tinymce.activeEditor.getBody().querySelector('#nested').outerHTML, other: window.tinymce.activeEditor.getBody().querySelector('#other').outerHTML, custom: window.tinymce.activeEditor.getBody().querySelector('#outer').className }));
  await confirmation(page); await confirm(page);
  const result = await page.evaluate(() => { const body = window.tinymce.activeEditor.getBody(); return { nested: body.querySelector('#nested').outerHTML, other: body.querySelector('#other').outerHTML, kept: body.querySelector('#linked')?.tagName, removed: !!body.querySelector('#unused'), caption: body.querySelector('#outer caption').textContent, strong: body.querySelector('#outer strong').textContent, custom: body.querySelector('#outer').className, headerAttrs: [...body.querySelector('#outer').rows].flatMap(row => [...row.cells]).some(cell => cell.hasAttribute('scope') || cell.hasAttribute('headers') || cell.hasAttribute('abbr') || cell.hasAttribute('aria-sort')) }; });
  expect(result).toEqual({ ...before, kept: 'TD', removed: false, caption: 'Outer', strong: '42', headerAttrs: false });
});

test('Reset confirmation supports cancellation, headings, keyboard access, and accessibility scans', async ({ page }) => {
  await ready(page, complex); const before = await page.evaluate(() => window.tinymce.activeEditor.getContent());
  for (const key of ['Cancel', 'Escape']) {
    await confirmation(page);
    await expect(page.getByRole('heading', { level: 2, name: 'Remove Table Header Markup' })).toBeFocused();
    if (key === 'Cancel') await page.getByRole('button', { name: 'Cancel', exact: true }).click(); else await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0); expect(await page.evaluate(() => window.tinymce.activeEditor.getContent())).toBe(before);
  }
  await confirmation(page); await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map(item => item.id))).toEqual([]);
    for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement.closest('dialog[open]'))).toBeTruthy(); }
  }
  await page.setViewportSize({ width: 320, height: 225 });
  await page.getByRole('heading', { level: 2, name: 'Remove Table Header Markup' }).focus();
  const submit = page.getByRole('button', { name: 'Remove header markup', exact: true }); await submit.focus();
  const bounds = await submit.boundingBox(); expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThanOrEqual(225);
});

test('Reset preserves ARIA ID references and row-group-dependent merged cells', async ({ page }) => {
  await ready(page, '<h2>Document</h2><p aria-describedby="aria-cell">Related information</p><table id="outer"><caption>Groups</caption><thead id="header-section"><tr><th id="aria-cell" rowspan="0" scope="col">Group</th><th id="remove-me" scope="col">Year</th></tr><tr><th scope="col">2026</th></tr></thead><tbody><tr><td>North</td><td>42</td></tr></tbody></table>');
  await confirmation(page); await confirm(page);
  expect(await page.evaluate(() => { const body = window.tinymce.activeEditor.getBody(); const table = body.querySelector('#outer'); return { groups: table.tBodies.length, section: body.querySelector('#header-section').tagName, span: body.querySelector('#aria-cell').getAttribute('rowspan'), cell: body.querySelector('#aria-cell').tagName, removed: !!body.querySelector('#remove-me'), reference: body.querySelector('p').getAttribute('aria-describedby') }; })).toEqual({ groups: 2, section: 'TBODY', span: '0', cell: 'TD', removed: false, reference: 'aria-cell' });
});
