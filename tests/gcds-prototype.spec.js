import { test, expect } from '@playwright/test';

async function open(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.tinymce?.activeEditor?.initialized);
  await page.evaluate(() => window.tinymce.activeEditor.ui.registry.getAll().buttons.downloadlink.onAction());
  await expect(page.getByRole('dialog', { name: 'Insert Download Link', exact: true })).toBeVisible();
}

test('GC prototype contains keyboard focus, closes with Escape, and preserves content', async ({ page }) => {
  await open(page);
  const content = await page.evaluate(() => window.tinymce.activeEditor.getContent());
  await expect(page.getByRole('heading', { level: 2, name: 'Insert Download Link' })).toBeFocused();
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let i = 0; i < 22; i++) {
      await page.keyboard.press(key);
      expect(await page.evaluate(() => !!document.activeElement.closest('dialog[open]'))).toBeTruthy();
    }
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => window.tinymce.activeEditor.getContent())).toBe(content);
  expect(await page.evaluate(() => document.activeElement.tagName)).not.toBe('BODY');
});

test('GC preview uses document details and French size units without loading the destination', async ({ page }) => {
  await open(page);
  await page.getByRole('textbox', { name: /^Document title/ }).fill('Annual report');
  await page.getByRole('textbox', { name: /^File path or URL/ }).fill('/annual-report.pdf');
  await page.getByRole('textbox', { name: /^File size/ }).fill('2,5');
  await page.locator('gcds-select[name="unit"]').locator('select').selectOption('MB');
  await page.locator('gcds-select[name="language"]').locator('select').selectOption('fr');
  await expect(page.locator('.gc-download-preview-name')).toHaveText('Annual report');
  await expect(page.locator('.gc-download-preview-meta')).toHaveText('PDF · 2,5 Mo');
  await expect(page.locator('.gc-download-preview-path')).toHaveText('/annual-report.pdf');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('GC prototype reflows and keeps controls reachable at 400 percent zoom equivalent', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 225 });
  await open(page);
  const dimensions = await page.locator('dialog').evaluate(dialog => {
    const body = dialog.querySelector('.gc-download-body');
    const rect = dialog.getBoundingClientRect();
    return { width: rect.width, bottom: rect.bottom, bodyHeight: body.clientHeight, overflow: body.scrollWidth > body.clientWidth };
  });
  expect(dimensions.width).toBeLessThanOrEqual(320);
  expect(dimensions.bottom).toBeLessThanOrEqual(225);
  expect(dimensions.bodyHeight).toBeGreaterThan(30);
  expect(dimensions.overflow).toBe(false);
  await page.getByRole('textbox', { name: /^File size/ }).fill('12');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('GC prototype review screenshots', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page);
  await page.getByRole('textbox', { name: /^Document title/ }).fill('Annual accessibility report');
  await page.getByRole('textbox', { name: /^File path or URL/ }).fill('/documents/accessibility-report.pdf');
  await page.getByRole('textbox', { name: /^Image URL/ }).fill('/images/pdf-icon.png');
  await page.getByRole('textbox', { name: /^File size/ }).fill('273');
  await page.getByRole('heading', { level: 2 }).focus();
  await page.screenshot({ path: testInfo.outputPath('prototype-desktop.png') });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.screenshot({ path: testInfo.outputPath('prototype-mobile.png') });
});
