import { test, expect } from '@playwright/test';

const data = n => `<tr><td>Region ${n}</td><td>Forecast ${n}</td><td>Value ${n}</td></tr>`;
const group = name => `<tr><td colspan="3">Group ${name}</td></tr>`;
const html = '<table><caption>Regional forecast</caption><tbody><tr><td>Region</td><td colspan="2">Forecast</td></tr>' + data(2) + data(3) + group('A') + data(5) + data(6) + group('B') + data(8) + data(9) + group('C') + data(11) + '</tbody></table>';
async function open(page) {
  await page.evaluate(() => { const e = window.tinymce.activeEditor; e.selection.select(e.getBody().querySelector('table td,table th')); e.ui.registry.getAll().buttons.tableaccessibility.onAction(); });
}
async function ready(page, source = html) {
  await page.goto('/'); await page.waitForFunction(() => window.tinymce?.activeEditor?.initialized);
  await page.evaluate(html => { const e = window.tinymce.activeEditor; e.setContent(html); e.undoManager.clear(); e.undoManager.add(); }, source);
  await open(page);
}
async function toggle(page, name) { await page.getByRole('checkbox', { name, exact: true }).focus(); await page.keyboard.press('Space'); }
const review = page => page.getByRole('button', { name: /^(Review relationships|Apply accessibility)$/ }).click();
async function selectGroups(page) { for (const label of ['Row 4: Group A', 'Row 7: Group B', 'Row 10: Group C']) await toggle(page, label); }

for (const leftHeaders of [true, false]) test(`group associations with left row headers ${leftHeaders ? 'on' : 'off'}`, async ({ page }) => {
  await ready(page);
  await page.getByRole('combobox', { name: /^Top rows used/ }).selectOption('1');
  await selectGroups(page);
  if (leftHeaders) await toggle(page, 'Use the first column of data rows as row headers');
  if (!leftHeaders) await toggle(page, 'Add/normalize THEAD and TBODY');
  await review(page);
  await page.getByRole('button', { name: 'Select data cell: Value 8', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /Group B/ })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /Group A/ })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: /Group C/ })).not.toBeChecked();
  await page.getByRole('button', { name: 'Apply relationships', exact: true }).click();
  const result = await page.evaluate(() => {
    const e = window.tinymce.activeEditor; const table = e.getBody().querySelector('table');
    const get = text => Array.from(table.querySelectorAll('td')).find(cell => cell.textContent === text).headers.split(/\s+/).filter(Boolean).map(id => e.getDoc().getElementById(id)?.textContent);
    return { id: table.id, merges: [table.rows[0].cells[1].colSpan, ...[3,6,9].map(i => table.rows[i].cells[0].colSpan)], tags: [table.rows[0].cells[0].tagName, table.rows[7].cells[0].tagName, ...[3,6,9].map(i => table.rows[i].cells[0].tagName)], links: [2,5,8,11].map(i => get(`Value ${i}`)) };
  });
  expect(result).toEqual({ id: 'table-1', merges: [2,3,3,3], tags: ['TH', leftHeaders ? 'TH' : 'TD', 'TH','TH','TH'], links: [2,5,8,11].map((n,i) => ['Forecast', ...(i ? [`Group ${'ABC'[i-1]}`] : []), ...(leftHeaders ? [`Region ${n}`] : [])]) });
  await page.evaluate(() => { const e = window.tinymce.activeEditor; e.setContent(e.getContent()); });
  await open(page);
  await expect(page.getByRole('checkbox', { name: 'Row 7: Group B', exact: true })).toBeChecked();
});

test('requires a top header and leaves the table unchanged when the preview is cancelled', async ({ page }) => {
  await ready(page);
  const snapshot = () => page.evaluate(() => window.tinymce.activeEditor.getContent());
  const before = await snapshot();
  await page.getByRole('combobox', { name: /^Top rows used/ }).selectOption('0');
  await selectGroups(page); await review(page);
  await expect(page.locator('.gc-tool-validation')).toContainText('Choose top column header rows');
  await page.getByRole('combobox', { name: /^Top rows used/ }).selectOption('1'); await review(page);
  await page.getByRole('button', { name: 'Apply relationships', exact: true }).waitFor();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await snapshot()).toBe(before);
});

test('header reset clears saved group choices and Undo restores them', async ({ page }) => {
  await ready(page); await page.getByRole('combobox', { name: /^Top rows used/ }).selectOption('1'); await selectGroups(page); await review(page);
  await page.getByRole('button', { name: 'Apply relationships', exact: true }).click();
  await open(page); await page.getByRole('button', { name: 'Remove header markup…', exact: true }).click();
  await page.getByRole('button', { name: 'Remove header markup', exact: true }).click();
  const count = () => page.evaluate(() => window.tinymce.activeEditor.getBody().querySelectorAll('[data-table-group-header]').length);
  expect(await count()).toBe(0);
  await page.evaluate(() => window.tinymce.activeEditor.undoManager.undo()); expect(await count()).toBe(3);
});

test('deselecting a saved group removes its stale associations', async ({ page }) => {
  await ready(page); await page.getByRole('combobox', { name: /^Top rows used/ }).selectOption('1'); await selectGroups(page); await review(page);
  await page.getByRole('button', { name: 'Apply relationships', exact: true }).click();
  await open(page); await toggle(page, 'Row 7: Group B'); await review(page);
  await page.getByRole('button', { name: 'Apply relationships', exact: true }).click();
  expect(await page.evaluate(() => {
    const e = window.tinymce.activeEditor; const t = e.getBody().querySelector('table');
    const value = [...t.querySelectorAll('td')].find(cell => cell.textContent === 'Value 8');
    return { groupTag: t.rows[6].cells[0].tagName, labels: value.headers.split(/\s+/).map(id => e.getDoc().getElementById(id).textContent) };
  })).toEqual({ groupTag: 'TD', labels: ['Forecast', 'Group A'] });
});

test('vertical merges crossing a header boundary are flagged without modifying the table', async ({ page }) => {
  await ready(page, html.replace('<td>Region</td>', '<td rowspan="2">Region</td>').replace('<td>Region 2</td>', ''));
  const before = await page.evaluate(() => window.tinymce.activeEditor.getContent());
  await page.getByRole('combobox', { name: /^Top rows used/ }).selectOption('1'); await selectGroups(page); await review(page);
  await expect(page.locator('.gc-tool-validation')).toContainText('A vertical merge crosses a header boundary');
  expect(await page.evaluate(() => window.tinymce.activeEditor.getContent())).toBe(before);
});
