import { test, expect } from '@playwright/test';
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
