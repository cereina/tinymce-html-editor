import { test, expect } from '@playwright/test';
const complex = '<h2>Complex data</h2><table><caption>Grouped population</caption><thead><tr><th rowspan="2" scope="col">Region</th><th colspan="2" scope="colgroup">Year</th></tr><tr><th scope="col">2025</th><th scope="col">2026</th></tr></thead><tbody><tr><th scope="row">North</th><td colspan="2">42</td></tr><tr><th scope="row">South</th><td>30</td><td>40</td></tr></tbody></table>';

test('GC complex header choices survive cell navigation and apply to the selected data cell', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/');
  await page.waitForFunction(() => window.tinymce?.activeEditor?.initialized);
  await page.evaluate(html => {
    const editor = window.tinymce.activeEditor; editor.setContent(html); editor.undoManager.clear(); editor.undoManager.add();
    editor.selection.select(editor.getBody().querySelector('td'));
    editor.ui.registry.getAll().buttons.tableaccessibility.onAction();
  }, complex);
  await page.getByRole('button', { name: 'Review relationships', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Complex Table Accessibility' })).toBeVisible();
  const cells = page.locator('.table-a11y-cell-button'); await cells.first().click();
  const checkbox = page.getByRole('checkbox').first();
  const previous = await checkbox.isChecked();
  const label = await page.locator('dialog gcds-checkboxes').first().evaluate(element => element.options[0].label);
  const headerId = label.match(/ID:\s*(\S+)/)[1];
  await checkbox.focus(); await page.keyboard.press('Space');
  if (previous) await expect(checkbox).not.toBeChecked(); else await expect(checkbox).toBeChecked();
  await cells.nth(1).click(); await cells.first().click();
  if (previous) await expect(checkbox).not.toBeChecked(); else await expect(checkbox).toBeChecked();
  await page.screenshot({ path: testInfo.outputPath('complex-review-desktop.png') });
  await page.setViewportSize({ width: 320, height: 800 });
  const dismiss = page.getByRole('button', { name: 'Close complex table review', exact: true }); await dismiss.focus();
  const dismissBounds = await dismiss.boundingBox(); expect(dismissBounds.x).toBeGreaterThanOrEqual(0); expect(dismissBounds.x + dismissBounds.width).toBeLessThanOrEqual(320);
  await page.screenshot({ path: testInfo.outputPath('complex-review-mobile.png') });
  await page.getByRole('button', { name: 'Apply relationships', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const headers = await page.evaluate(() => window.tinymce.activeEditor.getBody().querySelector('td').getAttribute('headers').split(/\s+/));
  if (previous) expect(headers).not.toContain(headerId); else expect(headers).toContain(headerId);
  await page.evaluate(() => window.tinymce.activeEditor.undoManager.undo());
  expect(await page.evaluate(() => window.tinymce.activeEditor.getBody().querySelector('td').hasAttribute('headers'))).toBe(false);
});
