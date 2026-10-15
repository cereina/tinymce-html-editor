import { test, expect } from '@playwright/test';
const html = '<h2 id="intro">Introduction</h2><p class="text-center">Review the document.</p><table><caption>Population</caption><thead><tr><th scope="col">Region</th><th scope="col">Total</th></tr></thead><tbody><tr><th scope="row">North</th><td>42</td></tr></tbody></table>';
async function ready(page, content = html) {
  await page.goto('/'); await page.waitForFunction(() => window.tinymce?.activeEditor?.initialized);
  await page.evaluate(content => {
    const editor = window.tinymce.activeEditor; editor.setContent(content); editor.undoManager.clear(); editor.undoManager.add();
    editor.selection.select(editor.getBody().querySelector('td') ?? editor.getBody().querySelector('p'));
  }, content);
}
async function action(page, name, index = 0) {
  await page.evaluate(({ name, index }) => { const item = window.tinymce.activeEditor.ui.registry.getAll().buttons[name]; if (item.fetch) item.fetch(items => items[index].onAction()); else item.onAction(); }, { name, index });
  await expect(page.getByRole('dialog')).toBeVisible();
}
for (const name of ['sections', 'tocmanager', 'footnotes', 'wetstyles', 'tableaccessibility', 'leftrowheaders']) {
  test('GC tool components, keyboard containment, and cancellation: ' + name, async ({ page }) => {
    await ready(page); const before = await page.evaluate(() => window.tinymce.activeEditor.getContent()); await action(page, name);
    await expect(page.locator('dialog gcds-button').first()).toBeVisible();
    await expect(page.locator('dialog h2')).toBeFocused();
    for (const key of ['Tab', 'Shift+Tab']) for (let i = 0; i < 18; i++) {
      await page.keyboard.press(key); expect(await page.evaluate(() => !!document.activeElement.closest('dialog[open]'))).toBeTruthy();
    }
    await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(() => window.tinymce.activeEditor.getContent())).toBe(before);
    expect(await page.evaluate(() => document.activeElement.tagName)).not.toBe('BODY');
  });
}

test('GC WET class choices, inline validation, apply, and undo', async ({ page }) => {
  await ready(page, '<h2>Document</h2><p class="text-center">Content.</p>'); await action(page, 'wetstyles');
  const centered = page.getByRole('checkbox', { name: /^text-center/ }); await expect(centered).toBeChecked(); await centered.focus(); await page.keyboard.press('Space'); await expect(centered).not.toBeChecked();
  const margin = page.getByRole('checkbox', { name: /^mrgn-tp-md/ });
  await page.getByText(/^mrgn-tp-md —/).click(); await expect(margin).toBeChecked();
  const custom = page.getByRole('textbox', { name: /^Other class names/ }); await custom.fill('bad@class');
  await page.getByRole('button', { name: 'Apply classes', exact: true }).click();
  await expect(page.locator('gcds-alert.gc-tool-validation')).toContainText('Invalid class name');
  await custom.fill('custom-class'); await page.getByRole('button', { name: 'Apply classes', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const classes = await page.evaluate(() => window.tinymce.activeEditor.getBody().querySelector('p').className);
  expect(classes).toContain('mrgn-tp-md'); expect(classes).toContain('custom-class'); expect(classes).not.toContain('text-center');
  await page.evaluate(() => window.tinymce.activeEditor.undoManager.undo());
  expect(await page.evaluate(() => window.tinymce.activeEditor.getBody().querySelector('p').className)).toBe('text-center');
});

test('GC TOC checkbox and select values reach the existing generator', async ({ page }) => {
  await ready(page); await action(page, 'tocmanager');
  await page.getByRole('textbox', { name: /^TOC heading text/ }).fill('Contents');
  const nested = page.getByRole('checkbox', { name: /^Nest TOC entries/ }); await expect(nested).toBeChecked(); await nested.focus(); await page.keyboard.press('Space'); await expect(nested).not.toBeChecked();
  await page.getByRole('combobox', { name: /^TOC heading level/ }).selectOption('3');
  await page.getByRole('button', { name: 'Create TOC', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const result = await page.evaluate(() => { const toc = window.tinymce.activeEditor.getBody().querySelector('nav[data-generated-toc]'); return { nested: toc.getAttribute('data-toc-nested'), heading: toc.querySelector('h3').textContent }; });
  expect(result).toEqual({ nested: 'false', heading: 'Contents' });
});

test('GC source settings persist and action buttons preserve source editing', async ({ page }) => {
  await ready(page); await action(page, 'sourcecodepro');
  await page.getByRole('combobox', { name: /^Indent/ }).selectOption('2');
  await page.getByRole('checkbox', { name: /^Format automatically/ }).focus(); await page.keyboard.press('Space');
  await page.keyboard.press('Escape'); await action(page, 'sourcecodepro');
  await expect(page.getByRole('combobox', { name: /^Indent/ })).toHaveValue('2');
  await expect(page.getByRole('checkbox', { name: /^Format automatically/ })).toBeChecked();
  await page.getByRole('checkbox', { name: /^Format automatically/ }).focus(); await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('GC imported-footnote cancellation preserves the imported version', async ({ page }) => {
  await ready(page, '<h2>Document</h2><p>Text<sup><a href="#footnote-1" id="footnote-ref-1">1</a></sup></p><ol><li id="footnote-1">Footnote body <a href="#footnote-ref-1">Return</a></li></ol>');
  const before = await page.evaluate(() => window.tinymce.activeEditor.getContent()); await action(page, 'footnotes', 1);
  await page.getByRole('button', { name: 'Keep imported version', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); expect(await page.evaluate(() => window.tinymce.activeEditor.getContent())).toBe(before);
});

test('GC remaining popup review screenshots', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await ready(page);
  for (const name of ['sections', 'tocmanager', 'footnotes', 'wetstyles', 'tableaccessibility', 'leftrowheaders', 'sourcecodepro', 'tableworkstation']) {
    await action(page, name); await page.screenshot({ path: testInfo.outputPath(name + '.png') });
    await page.setViewportSize({ width: 320, height: 800 }); await page.screenshot({ path: testInfo.outputPath(name + '-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});
