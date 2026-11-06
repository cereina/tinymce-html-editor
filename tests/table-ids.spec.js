import { test, expect } from '@playwright/test';
const simple = '<table><caption>Totals</caption><tbody><tr><td>Region</td><td>Total</td></tr><tr><td>North</td><td>42</td></tr></tbody></table>';
async function ready(page, html) {
  await page.goto('/'); await page.waitForFunction(() => window.tinymce?.activeEditor?.initialized);
  await page.evaluate(html => { const e = window.tinymce.activeEditor; e.setContent(html); e.undoManager.clear(); e.undoManager.add(); }, html);
}
async function settings(page, index = 0) {
  await page.evaluate(index => { const e = window.tinymce.activeEditor; e.selection.select(e.getBody().querySelectorAll('table')[index].querySelector('td,th')); e.ui.registry.getAll().buttons.tableaccessibility.onAction(); }, index);
}
const ids = page => page.evaluate(() => [...window.tinymce.activeEditor.getBody().querySelectorAll('table')].map(table => table.id));
test('tables receive sequential IDs on apply, persist in output, and keep them on reapply', async ({ page }) => {
  await ready(page, simple + simple);
  for (let index = 0; index < 2; index++) { await settings(page, index); await page.getByRole('button', { name: 'Apply accessibility', exact: true }).click(); }
  expect(await ids(page)).toEqual(['table-1', 'table-2']);
  await page.evaluate(() => { const e = window.tinymce.activeEditor; e.setContent(e.getContent()); });
  await settings(page); await page.getByRole('button', { name: 'Apply accessibility', exact: true }).click();
  expect(await ids(page)).toEqual(['table-1', 'table-2']);
});
test('existing IDs survive and generated IDs avoid all document IDs', async ({ page }) => {
  await ready(page, '<p id="table-1">Anchor</p>' + simple.replace('<table>', '<table id="custom-id">') + simple.replace('<table>', '<table id="table-2">') + simple);
  await settings(page); await page.getByRole('button', { name: 'Apply accessibility', exact: true }).click();
  await settings(page, 2); await page.getByRole('button', { name: 'Apply accessibility', exact: true }).click();
  expect(await ids(page)).toEqual(['custom-id', 'table-2', 'table-3']);
});
test('cancel does not assign an ID and Undo/Redo restores the applied ID', async ({ page }) => {
  await ready(page, simple); await settings(page);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); expect(await ids(page)).toEqual(['']);
  await settings(page); await page.getByRole('button', { name: 'Apply accessibility', exact: true }).click(); expect(await ids(page)).toEqual(['table-1']);
  await page.evaluate(() => window.tinymce.activeEditor.undoManager.undo()); expect(await ids(page)).toEqual(['']);
  await page.evaluate(() => window.tinymce.activeEditor.undoManager.redo()); expect(await ids(page)).toEqual(['table-1']);
});
test('complex table IDs remain staged until relationships are applied', async ({ page }) => {
  const complex = '<table><caption>Totals</caption><thead><tr><th colspan="2">Regions</th></tr><tr><th>North</th><th>South</th></tr></thead><tbody><tr><td>42</td><td>21</td></tr></tbody></table>';
  await ready(page, complex); await settings(page); await page.getByRole('button', { name: 'Review relationships', exact: true }).click();
  expect(await ids(page)).toEqual(['']);
  await page.getByRole('button', { name: 'Apply relationships', exact: true }).click(); expect(await ids(page)).toEqual(['table-1']);
});
