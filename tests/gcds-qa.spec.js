import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const dirty = '<h2>Introduction</h2><h4>Skipped level</h4><p><a href="#missing">Broken reference</a></p>';
const clean = '<h2>Introduction</h2><p>Reviewed content.</p>';
async function open(page, html = dirty) {
  await page.goto('/'); await page.waitForFunction(() => window.tinymce?.activeEditor?.initialized);
  await page.evaluate(html => { window.tinymce.activeEditor.setContent(html); window.tinymce.activeEditor.ui.registry.getAll().buttons.documentqa.onAction(); }, html);
  await expect(page.getByRole('dialog', { name: 'Document QA', exact: true })).toBeVisible();
}

test('GC QA reports issues and selects the associated document element', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('heading', { level: 4, name: 'Heading level is skipped' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 4, name: 'Broken internal link', exact: true })).toBeVisible();
  const before = await page.evaluate(() => window.tinymce.activeEditor.getContent());
  await page.getByRole('button', { name: /Go to issue \d+: Broken internal link/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => window.tinymce.activeEditor.selection.getContent())).toContain('Broken reference');
  expect(await page.evaluate(() => window.tinymce.activeEditor.getContent())).toBe(before);
});

test('GC QA reruns checks in place, announces the result, and preserves document content', async ({ page }) => {
  await open(page);
  await page.evaluate(html => window.tinymce.activeEditor.setContent(html), clean);
  const rerun = page.getByRole('button', { name: 'Re-run checks', exact: true });
  await rerun.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('gcds-alert')).toHaveCount(1);
  expect(await page.locator('gcds-alert').evaluate(element => element.heading)).toBe('Automated checks passed');
  await expect(page.getByRole('status', { name: 'QA check updates', exact: true })).toContainText('0 errors, 0 warnings, 0 review items');
  await expect(page.getByRole('button', { name: /Go to issue/ })).toHaveCount(0);
  await expect(rerun).toBeFocused();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  expect(await page.evaluate(() => window.tinymce.activeEditor.getContent())).toContain('Reviewed content.');
});

test('GC QA issue report passes accessibility scans and heading structure checks', async ({ page }) => {
  await open(page); await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 800 });
    const violations = await page.evaluate(async () => (await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    })).violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })));
    expect(violations).toEqual([]);
  }
  const levels = await page.locator('dialog').evaluate(dialog => [...dialog.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(element => Number(element.tagName.slice(1))));
  expect(levels[0]).toBe(2);
  for (let i = 1; i < levels.length; i++) { expect(levels[i]).toBeGreaterThanOrEqual(3); expect(levels[i]).toBeLessThanOrEqual(levels[i - 1] + 1); }
  await expect(page.locator('dialog table')).toHaveCount(0);
});

test('GC QA scrolls at 400 percent zoom equivalent and retains keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 225 }); await open(page);
  const body = page.getByRole('region', { name: 'Document accessibility report' });
  expect(await body.evaluate(element => element.clientHeight)).toBeGreaterThan(30);
  expect(await body.evaluate(element => element.scrollWidth <= element.clientWidth)).toBeTruthy();
  await body.focus(); await page.keyboard.press('PageDown');
  await expect.poll(() => body.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  for (const key of ['Tab', 'Shift+Tab']) for (let i = 0; i < 15; i++) {
    await page.keyboard.press(key); expect(await page.evaluate(() => !!document.activeElement.closest('dialog[open]'))).toBeTruthy();
  }
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement.tagName)).not.toBe('BODY');
});

test('GC QA screenshots for review', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await open(page);
  await page.screenshot({ path: testInfo.outputPath('qa-desktop.png') });
  await page.setViewportSize({ width: 320, height: 800 }); await page.screenshot({ path: testInfo.outputPath('qa-mobile.png') });
});
