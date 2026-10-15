import { test, expect } from '@playwright/test';
test('GC source toolbar controls share a bottom alignment on desktop', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1525, height: 900 }); await page.goto('/');
  await page.waitForFunction(() => window.tinymce?.activeEditor?.initialized);
  await page.evaluate(() => window.tinymce.activeEditor.ui.registry.getAll().buttons.sourcecodepro.onAction());
  const dialog = page.getByRole('dialog', { name: 'Source Code Pro', exact: true }); await expect(dialog).toBeVisible();
  const controls = [dialog.getByRole('button', { name: 'Format HTML', exact: true }), dialog.getByRole('button', { name: 'Format Selection', exact: true }), dialog.getByRole('combobox', { name: /^Indent/ }), dialog.getByRole('checkbox', { name: /^Format automatically/ })];
  const bounds = await Promise.all(controls.map(control => control.boundingBox()));
  // The checkbox's visible box is drawn on its wrapper; the native input
  // retains browser margins inside the component.
  bounds[3] = await controls[3].evaluate(input => { const rect = input.parentElement.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }; });
  const bottoms = bounds.map(rect => rect.y + rect.height);
  expect(Math.max(...bottoms) - Math.min(...bottoms), JSON.stringify(bounds)).toBeLessThanOrEqual(2);
  await page.screenshot({ path: testInfo.outputPath('source-desktop.png') });
});
test('GC source action buttons wrap inside a narrow viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 800 }); await page.goto('/');
  await page.waitForFunction(() => window.tinymce?.activeEditor?.initialized);
  await page.evaluate(() => window.tinymce.activeEditor.ui.registry.getAll().buttons.sourcecodepro.onAction());
  const dialog = page.getByRole('dialog', { name: 'Source Code Pro', exact: true }); await expect(dialog).toBeVisible();
  const actions = dialog.locator('gcds-button').getByRole('button');
  for (let i = 0; i < await actions.count(); i++) {
    await actions.nth(i).focus(); const bounds = await actions.nth(i).boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  }
  await page.screenshot({ path: testInfo.outputPath('source-mobile.png') });
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
});
