import { test, expect } from '@playwright/test';
for (const name of ['sections', 'tocmanager', 'footnotes', 'wetstyles', 'tableaccessibility', 'leftrowheaders']) {
  test('GC tool remains usable at 400 percent zoom equivalent: ' + name, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 225 }); await page.goto('/');
    await page.waitForFunction(() => window.tinymce?.activeEditor?.initialized);
    await page.evaluate(name => {
      const editor = window.tinymce.activeEditor;
      editor.setContent('<h2>Document</h2><p>Content.</p><table><caption>Data</caption><thead><tr><th scope="col">Name</th><th scope="col">Count</th></tr></thead><tbody><tr><td>North</td><td>42</td></tr></tbody></table>');
      editor.selection.select(editor.getBody().querySelector('td'));
      const item = editor.ui.registry.getAll().buttons[name]; if (item.fetch) item.fetch(items => items[0].onAction()); else item.onAction();
    }, name);
    const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
    const body = dialog.locator('.gc-tool-body');
    expect(await body.evaluate(element => element.clientHeight)).toBeGreaterThan(30);
    expect(await body.evaluate(element => element.scrollWidth <= element.clientWidth)).toBeTruthy();
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBeTruthy();
    const action = dialog.locator('footer').getByRole('button').last(); await action.focus();
    const bounds = await action.boundingBox();
    expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThanOrEqual(225);
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  });
}
