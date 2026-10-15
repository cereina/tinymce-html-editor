import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const dirty = '<h2 id="intro">Introduction</h2><p class="MsoNormal">Keep this sentence.</p><p><a href="#missing">Broken reference</a></p>';

async function open(page, html = dirty) {
  await page.goto('/');
  await page.waitForFunction(() => window.tinymce?.activeEditor?.initialized);
  const before = await page.evaluate(html => {
    const editor = window.tinymce.activeEditor;
    editor.setContent(html); editor.undoManager.clear(); editor.undoManager.add();
    return editor.getContent();
  }, html);
  await page.evaluate(() => window.tinymce.activeEditor.ui.registry.getAll().buttons.cleanhtml.onAction());
  await expect(page.getByRole('dialog', { name: 'HTML Cleanup Report', exact: true })).toBeVisible();
  return before;
}

test('GC cleanup previews changes, applies cleanup, and supports undo', async ({ page }) => {
  const before = await open(page);
  await expect(page.locator('gcds-alert').first()).toContainText('Your document has not changed');
  await expect(page.getByRole('heading', { level: 3, name: 'Cleanup changes', exact: true })).toBeVisible();
  await expect(page.locator('.gc-cleanup-report')).toContainText('Word classes removed');
  expect(await page.evaluate(() => window.tinymce.activeEditor.getContent())).toBe(before);
  await page.getByRole('button', { name: 'Apply cleanup', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const after = await page.evaluate(() => window.tinymce.activeEditor.getContent());
  expect(after).not.toContain('MsoNormal'); expect(after).toContain('Keep this sentence.');
  await page.evaluate(() => window.tinymce.activeEditor.undoManager.undo());
  expect(await page.evaluate(() => window.tinymce.activeEditor.getContent())).toBe(before);
});

test('GC cleanup cancellation and Escape preserve content and restore focus', async ({ page }) => {
  for (const method of ['Cancel', 'Escape', 'Close HTML Cleanup Report']) {
    const before = await open(page);
    if (method === 'Escape') await page.keyboard.press('Escape');
    else await page.getByRole('button', { name: method, exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(() => window.tinymce.activeEditor.getContent())).toBe(before);
    expect(await page.evaluate(() => document.activeElement.tagName)).not.toBe('BODY');
  }
});

test('GC cleanup disables apply when no changes are required and traps focus', async ({ page }) => {
  await open(page, '<h2>Introduction</h2><p>Clean content.</p>');
  await expect(page.locator('gcds-alert').first()).toContainText('No automatic cleanup changes are required');
  await expect(page.getByRole('button', { name: 'Apply cleanup', exact: true })).toBeDisabled();
  await expect(page.getByRole('heading', { level: 2, name: 'HTML Cleanup Report' })).toBeFocused();
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press(key);
      expect(await page.evaluate(() => !!document.activeElement.closest('dialog[open]'))).toBeTruthy();
      expect(await page.evaluate(() => document.activeElement.textContent)).not.toBe('Apply cleanup');
    }
  }
});

test('GC cleanup warns about broken references and passes accessibility scans at desktop and mobile widths', async ({ page }) => {
  await open(page);
  const warning = page.locator('gcds-alert').nth(1);
  await expect(warning).toContainText('missing');
  expect(await warning.evaluate(element => element.alertRole)).toBe('warning');
  await expect(page.locator('dialog table')).toHaveCount(0);
  await expect(page.locator('dialog h1')).toHaveCount(0);
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 800 });
    const violations = await page.evaluate(async () => (await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    })).violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) })));
    expect(violations).toEqual([]);
  }
});

test('GC cleanup supports keyboard scrolling and a 400 percent zoom equivalent viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 225 });
  await open(page);
  const body = page.getByRole('region', { name: 'HTML cleanup report contents' });
  await body.focus(); await page.keyboard.press('PageDown');
  await expect.poll(() => body.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect(await body.evaluate(element => element.scrollWidth <= element.clientWidth)).toBeTruthy();
  expect(await body.evaluate(element => element.clientHeight)).toBeGreaterThan(30);
  const bounds = await page.locator('dialog').boundingBox();
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(225);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('GC cleanup screenshots for review', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await open(page);
  await page.screenshot({ path: testInfo.outputPath('cleanup-desktop.png') });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.screenshot({ path: testInfo.outputPath('cleanup-mobile.png') });
});
