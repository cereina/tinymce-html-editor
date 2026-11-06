import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const simple = '<h2>Data</h2><table id="outer" class="custom"><caption>Population</caption><tbody><tr><td>Region</td><td>Total</td></tr><tr><td>North</td><td>42</td></tr></tbody></table>';
async function settings(page) {
  await page.evaluate(() => { const e = window.tinymce.activeEditor; e.selection.select(e.getBody().querySelector('#outer td,#outer th')); e.ui.registry.getAll().buttons.tableaccessibility.onAction(); });
}
async function open(page, html = simple) {
  await page.goto('/'); await page.waitForFunction(() => window.tinymce?.activeEditor?.initialized);
  await page.evaluate(html => { const e = window.tinymce.activeEditor; e.setContent(html); e.undoManager.clear(); e.undoManager.add(); }, html); await settings(page);
}
async function toggle(page, name) { await page.getByRole('checkbox', { name, exact: true }).focus(); await page.keyboard.press('Space'); }
// Inspect authored output, excluding TinyMCE's temporary visual-aid classes.
const classes = page => page.evaluate(() => new DOMParser().parseFromString(window.tinymce.activeEditor.getContent(), 'text/html').querySelector('#outer').className);

test('both classes default to checked, apply preserves unrelated classes, and Undo/Redo works', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('checkbox', { name: 'table', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'table-bordered', exact: true })).toBeChecked();
  expect(await classes(page)).toBe('custom');
  await page.getByRole('button', { name: 'Apply accessibility', exact: true }).click();
  expect((await classes(page)).split(/\s+/).sort()).toEqual(['custom', 'table', 'table-bordered']);
  await page.evaluate(() => window.tinymce.activeEditor.undoManager.undo()); expect(await classes(page)).toBe('custom');
  await page.evaluate(() => window.tinymce.activeEditor.undoManager.redo()); expect(await classes(page)).toContain('table-bordered');
});
test('unchecking both persists through reopening and HTML roundtrip', async ({ page }) => {
  await open(page); await toggle(page, 'table'); await toggle(page, 'table-bordered');
  await page.getByRole('button', { name: 'Apply accessibility', exact: true }).click();
  expect(await classes(page)).toBe('custom');
  await page.evaluate(() => { const e = window.tinymce.activeEditor; e.setContent(e.getContent()); });
  await settings(page);
  await expect(page.getByRole('checkbox', { name: 'table', exact: true })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'table-bordered', exact: true })).not.toBeChecked();
});
test('existing classes initialize independently and cancellation preserves the table', async ({ page }) => {
  await open(page, simple.replace('class="custom"', 'class="custom table-bordered"'));
  await expect(page.getByRole('checkbox', { name: 'table', exact: true })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'table-bordered', exact: true })).toBeChecked();
  await toggle(page, 'table-bordered'); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await classes(page)).toBe('custom table-bordered');
});
test('each class can be added or removed independently', async ({ page }) => {
  await open(page); await toggle(page, 'table-bordered');
  await page.getByRole('button', { name: 'Apply accessibility', exact: true }).click();
  expect((await classes(page)).split(/\s+/).sort()).toEqual(['custom', 'table']);
  await settings(page); await toggle(page, 'table'); await toggle(page, 'table-bordered');
  await page.getByRole('button', { name: 'Apply accessibility', exact: true }).click();
  expect((await classes(page)).split(/\s+/).sort()).toEqual(['custom', 'table-bordered']);
});
test('complex relationship review stages classes and applies them with the table', async ({ page }) => {
  const complex = '<h2>Data</h2><table id="outer" class="custom"><caption>Totals</caption><thead><tr><th colspan="2">Regions</th></tr><tr><th>North</th><th>South</th></tr></thead><tbody><tr><td>42</td><td>21</td></tr></tbody></table>';
  await open(page, complex); await toggle(page, 'table-bordered');
  await page.getByRole('button', { name: 'Review relationships', exact: true }).click();
  expect(await classes(page)).toBe('custom');
  await page.getByRole('button', { name: 'Apply relationships', exact: true }).click();
  expect((await classes(page)).split(/\s+/).sort()).toEqual(['custom', 'table']);
});
test('new checkboxes are keyboard accessible and dialog passes automated accessibility checks', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 }); await open(page);
  await toggle(page, 'table'); await expect(page.getByRole('checkbox', { name: 'table', exact: true })).not.toBeChecked();
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  expect(await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => v.id))).toEqual([]);
  expect(await page.locator('.gc-tool-body').evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
});
