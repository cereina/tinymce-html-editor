import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

async function open(page, html) {
  await page.goto('/'); await page.waitForFunction(() => window.tinymce?.activeEditor?.initialized);
  await page.evaluate(html => { const e = window.tinymce.activeEditor; e.setContent(html); e.undoManager.clear(); e.undoManager.add(); e.ui.registry.getAll().buttons.documentqa.onAction(); }, html);
}

test('bilingual suggestions preserve markup, exclude code and attributes, and respect nested language', async ({ page }) => {
  await open(page, '<p>20 percent</p>');
  const result = await page.evaluate(async () => {
    const { reviewContent } = await import('/src/editor/content-style.ts');
    const root = document.createElement('div');
    root.innerHTML = '<p title="20 percent">20 percent <strong>July 31st</strong></p><p lang="fr-CA">20 pour cent et $50</p><pre>30 percent</pre><a href="https://example.com/40percent">40 percent</a><p lang="de">50 percent</p>';
    return reviewContent(root, 'en').map(({ original, replacement, language }) => ({ original, replacement, language }));
  });
  expect(result).toEqual([
    { original: '20 percent', replacement: '20%', language: 'en' },
    { original: 'July 31st', replacement: 'July\u00a031', language: 'en' },
    { original: '20 pour cent', replacement: '20\u00a0%', language: 'fr' },
    { original: '$50', replacement: '50\u00a0$', language: 'fr' },
  ]);
});

test('apply changes one occurrence and editor Undo restores it', async ({ page }) => {
  await open(page, '<p id="original" title="20 percent"><strong>20 percent</strong> and 20 percent.</p>');
  await page.getByRole('button', { name: /Apply suggestion 1:/ }).click();
  expect(await page.evaluate(() => window.tinymce.activeEditor.getContent())).toContain('<strong>20%</strong> and 20 percent.');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.evaluate(() => window.tinymce.activeEditor.undoManager.undo());
  expect(await page.evaluate(() => window.tinymce.activeEditor.getContent())).toContain('<strong>20 percent</strong> and 20 percent.');
});

test('ignore, language switch and review-only findings', async ({ page }) => {
  await open(page, '<p>20 % and 3 applications on 03/04/2026.</p>');
  await page.getByRole('button', { name: /Ignore suggestion 1:/ }).click();
  await expect(page.getByRole('heading', { name: 'Percentage format', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Small number in prose' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ambiguous numeric date' })).toBeVisible();
  await page.getByLabel('Content language', { exact: true }).selectOption('fr');
  await expect(page.getByRole('heading', { name: 'Percentage format', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Apply suggestion/ })).toHaveCount(1);
});

test('stale suggestions cannot overwrite changed text and normalized text is idempotent', async ({ page }) => {
  await open(page, '<p>20 percent</p>');
  const result = await page.evaluate(async () => {
    const { reviewContent, applyContentSuggestion } = await import('/src/editor/content-style.ts');
    const root = document.createElement('div'); document.body.append(root); root.textContent = '20 percent';
    const issue = reviewContent(root, 'en')[0]; root.firstChild.data = '30 percent';
    const stale = applyContentSuggestion(issue);
    root.textContent = '20% July\u00a031 and 20\u00a0years';
    const count = reviewContent(root, 'en').length; root.remove(); return { stale, count };
  });
  expect(result).toEqual({ stale: false, count: 0 });
});

test('grouped amounts are never partially rewritten', async ({ page }) => {
  await open(page, '<p>Reviewed content.</p>');
  expect(await page.evaluate(async () => {
    const { reviewContent } = await import('/src/editor/content-style.ts');
    const root = document.createElement('div'); root.textContent = '$50 000 and 100 000 $ and 100 000%';
    return reviewContent(root, 'fr').length;
  })).toBe(0);
});

test('style findings pass automated accessibility checks at narrow width', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await open(page, '<p>20 percent and 3 applications on July 31st.</p><p lang="fr">20 pour cent et $50.</p>');
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  expect(await page.evaluate(async () => (await window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
  })).violations.map(issue => issue.id))).toEqual([]);
  expect(await page.locator('.document-qa-content').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.getByLabel('Content language', { exact: true }).focus();
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('dialog[open]'))).toBe(true);
  }
});
