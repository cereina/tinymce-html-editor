import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

async function open(page, html) {
  await page.goto('/'); await page.waitForFunction(() => window.tinymce?.activeEditor?.initialized);
  await page.evaluate(html => { const e = window.tinymce.activeEditor; e.setContent(html); e.undoManager.clear(); e.undoManager.add(); e.ui.registry.getAll().buttons.imagefigures.onAction(); }, html);
}
const content = page => page.evaluate(() => window.tinymce.activeEditor.getContent());
const source = page => page.getByRole('textbox', { name: 'Image source path (required)', exact: true });
const alt = page => page.getByRole('textbox', { name: 'Alternative text (required unless decorative)', exact: true });
async function apply(page) {
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  const list = page.getByRole('dialog', { name: 'List of figures', exact: true });
  if (await list.isVisible()) await list.getByRole('button', { name: 'Not now', exact: true }).click();
}

test('image paths retain leading slashes through apply, serialization and reopening', async ({ page }) => {
  await open(page, '<p><img src="/en/img/original.jpg" alt="A forest"></p>');
  await expect(source(page)).toHaveValue('/en/img/original.jpg');
  for (const path of ['/en/img/', '/en/img/photo.jpg', 'images/photo.jpg', 'https://example.ca/en/img/photo.jpg']) {
    await source(page).fill(path);
    await apply(page);
    expect(await content(page)).toContain(`src="${path}"`);
    await page.evaluate(() => {
      const e = window.tinymce.activeEditor; const html = e.getContent(); e.setContent(html);
      e.ui.registry.getAll().buttons.imagefigures.onAction();
    });
    await expect(source(page)).toHaveValue(path);
  }
});

test('paragraph becomes a figure with caption first, responsive class, supplied path, and Undo', async ({ page }) => {
  await open(page, `<p id="photo" lang="fr"><img src="${pixel}" alt="A forest" class="existing" width="120"></p>`);
  await expect(source(page)).toHaveValue(pixel);
  await source(page).fill('images/forest.jpg');
  await page.getByRole('textbox', { name: 'Image caption (required)', exact: true }).fill('Forest in autumn');
  await alt(page).fill('Red and yellow leaves along a forest path');
  await apply(page);
  const result = await content(page);
  expect(result).toContain('<figure id="photo" lang="fr">');
  expect(result).toContain('<figcaption id="img_1"><strong>Forest in autumn</strong></figcaption>');
  expect(result).toContain('src="images/forest.jpg"');
  expect(result).toContain('class="existing img-responsive"');
  expect(result).toContain('width="120"');
  expect(result).not.toContain('<p');
  await page.evaluate(() => window.tinymce.activeEditor.undoManager.undo());
  expect(await content(page)).toContain('<p id="photo"');
  await page.evaluate(() => window.tinymce.activeEditor.undoManager.redo());
  expect(await content(page)).toContain('<figcaption');
});

test('all images are reviewed, decorative option gives empty alt, and IDs avoid collisions', async ({ page }) => {
  await open(page, `<h2 id="img_1">Pictures</h2><p><img src="${pixel}" alt="First"> between <img src="${pixel}"></p>`);
  await page.getByRole('button', { name: 'Apply and next', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review image 2 of 2' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'This image is decorative' }).focus(); await page.keyboard.press('Space');
  await apply(page);
  expect(await page.evaluate(() => {
    const b = window.tinymce.activeEditor.getBody(); return { ids: [...b.querySelectorAll('figcaption')].map(e => e.id), alts: [...b.querySelectorAll('img')].map(e => e.getAttribute('alt')), text: b.textContent };
  })).toEqual({ ids: ['img_2', 'img_3'], alts: ['First', ''], text: expect.stringContaining('between') });
});

test('validation, skip and cancellation leave unapplied images unchanged', async ({ page }) => {
  await open(page, `<p><img src="${pixel}"></p><p><img src="${pixel}" alt="Second"></p>`);
  const before = await content(page);
  await page.getByRole('button', { name: 'Apply and next', exact: true }).click();
  await expect(page.locator('.gc-tool-validation')).toContainText('Enter alternative text');
  expect(await content(page)).toBe(before);
  await source(page).fill('javascript:alert(1)'); await alt(page).fill('Description');
  await page.getByRole('button', { name: 'Apply and next', exact: true }).click();
  await expect(page.locator('.gc-tool-validation')).toContainText('Use a relative image path');
  await page.getByRole('button', { name: 'Skip image', exact: true }).click();
  await page.keyboard.press('Escape');
  expect(await content(page)).toBe(before);
});

test('preserves mixed paragraph text and image links without duplicate IDs or nested figures', async ({ page }) => {
  await open(page, `<p id="paragraph">Before <a id="link" href="#target"><strong>start <img src="${pixel}" alt="Destination"> end</strong></a> after.</p><h2 id="target">Target</h2>`);
  const originalIds = await page.evaluate(() => [...window.tinymce.activeEditor.getBody().querySelectorAll('[id]')].map(e => e.id));
  await apply(page);
  expect(await page.evaluate(() => {
    const b = window.tinymce.activeEditor.getBody(); return { text: b.textContent, figures: b.querySelectorAll('figure').length, href: b.querySelector('figure a').getAttribute('href'), ids: [...b.querySelectorAll('[id]')].map(e => e.id).sort(), pImages: b.querySelectorAll('p img').length };
  })).toEqual({ text: expect.stringMatching(/Before start Add image caption end after\.Target/), figures: 1, href: '#target', ids: [...originalIds, 'img_1'].sort(), pImages: 0 });
  await page.evaluate(() => window.tinymce.activeEditor.ui.registry.getAll().buttons.imagefigures.onAction());
  await apply(page);
  expect(await page.evaluate(() => window.tinymce.activeEditor.getBody().querySelectorAll('figure').length)).toBe(1);
});

test('unlabelled image-only links cannot become decorative', async ({ page }) => {
  await open(page, `<p><a href="#target"><img src="${pixel}" alt="Destination"></a></p><h2 id="target">Target</h2>`);
  await page.getByRole('checkbox', { name: 'This image is decorative' }).focus(); await page.keyboard.press('Space');
  await apply(page);
  await expect(page.locator('.gc-tool-validation')).toContainText('only label for a link');
});

test('image dialog keyboard, headings, accessibility scans and narrow layout', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await open(page, `<p><img src="${pixel}" alt="A tree"></p>`);
  await expect(page.getByRole('heading', { name: 'Review image 1 of 1', level: 2 })).toBeFocused();
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  expect(await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map(e => e.id))).toEqual([]);
  expect(await page.locator('.gc-tool-body').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/image-review-narrow.png', fullPage: true });
  for (let i = 0; i < 18; i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement.closest('dialog[open]'))).toBe(true); }
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('picture sources and existing caption IDs survive a repeated review', async ({ page }) => {
  await open(page, `<figure id="existing"><p><picture><source srcset="${pixel}" type="image/gif"><img src="${pixel}" alt="A tree"></picture></p><figcaption id="original-caption">Existing caption</figcaption></figure>`);
  await expect(page.getByRole('textbox', { name: 'Image caption (required)', exact: true })).toHaveValue('Existing caption');
  await apply(page);
  expect(await page.evaluate(() => {
    const b = window.tinymce.activeEditor.getBody(); return { figures: b.querySelectorAll('figure').length, first: b.querySelector('figure').firstElementChild.tagName, id: b.querySelector('figcaption').id, sources: b.querySelectorAll('picture source').length, paragraphs: b.querySelectorAll('p img').length };
  })).toEqual({ figures: 1, first: 'FIGCAPTION', id: 'original-caption', sources: 1, paragraphs: 0 });
});

test('empty document produces an accessible no-images message without changing content', async ({ page }) => {
  await open(page, '<h2>Text only</h2><p>Nothing to convert.</p>');
  await expect(page.getByRole('dialog', { name: 'Review images', exact: true })).toContainText('No editable images were found');
  const before = await content(page); await page.keyboard.press('Escape'); expect(await content(page)).toBe(before);
});

test('accepting text above moves it into the caption with preserved links and Undo', async ({ page }) => {
  await open(page, `<p id="caption-source">A <em>forest</em> near <a href="https://example.ca">Ottawa</a></p><p><img src="${pixel}" alt="Trees"></p>`);
  await expect(page.getByRole('textbox', { name: 'Suggested caption from paragraph above (editable)', exact: true })).toHaveValue('A forest near Ottawa');
  const accept = page.getByRole('checkbox', { name: 'Use the suggested caption and remove the original paragraph above the image', exact: true });
  await expect(accept).not.toBeChecked();
  await accept.focus(); await page.keyboard.press('Space');
  await apply(page);
  expect(await page.evaluate(() => {
    const b = window.tinymce.activeEditor.getBody(); return { p: b.querySelectorAll('p').length, caption: b.querySelector('figcaption').textContent, link: b.querySelector('figcaption a').getAttribute('href'), id: b.querySelectorAll('#caption-source').length };
  })).toEqual({ p: 0, caption: 'A forest near Ottawa', link: 'https://example.ca', id: 1 });
  await page.evaluate(() => window.tinymce.activeEditor.undoManager.undo());
  expect(await content(page)).toContain('<p id="caption-source">');
  expect(await content(page)).not.toContain('<figure');
});

test('declining or cancelling a caption suggestion keeps the paragraph', async ({ page }) => {
  await open(page, `<p>Original paragraph.</p><p><img src="${pixel}" alt="Trees"></p>`);
  await page.getByRole('textbox', { name: 'Image caption (required)', exact: true }).fill('A separate caption');
  await apply(page);
  expect(await content(page)).toContain('<p>Original paragraph.</p>');
  expect(await content(page)).toContain('<strong>A separate caption</strong>');
  await page.evaluate(() => window.tinymce.activeEditor.ui.registry.getAll().buttons.imagefigures.onAction());
  await page.getByRole('checkbox', { name: /Use the suggested caption/ }).focus(); await page.keyboard.press('Space');
  const before = await content(page); await page.keyboard.press('Escape'); expect(await content(page)).toBe(before);
});

test('edited suggestions apply and stale paragraphs are not removed', async ({ page }) => {
  await open(page, `<p>Original caption.</p><p><img src="${pixel}" alt="Trees"></p>`);
  await page.getByRole('textbox', { name: 'Suggested caption from paragraph above (editable)', exact: true }).fill('Edited caption.');
  await page.getByRole('checkbox', { name: /Use the suggested caption/ }).focus(); await page.keyboard.press('Space');
  await page.evaluate(() => { window.tinymce.activeEditor.getBody().querySelector('p').textContent = 'Changed while reviewing.'; });
  await apply(page);
  await expect(page.locator('.gc-tool-validation')).toContainText('paragraph above this image changed');
  expect(await content(page)).toContain('Changed while reviewing.');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.tinymce.activeEditor.ui.registry.getAll().buttons.imagefigures.onAction());
  await page.getByRole('textbox', { name: 'Suggested caption from paragraph above (editable)', exact: true }).fill('Edited caption.');
  await page.getByRole('checkbox', { name: /Use the suggested caption/ }).focus(); await page.keyboard.press('Space');
  await apply(page);
  expect(await content(page)).toContain('<strong>Edited caption.</strong>');
  expect(await content(page)).not.toContain('Changed while reviewing.');
});

test('headings and paragraphs containing images are not offered as captions', async ({ page }) => {
  await open(page, `<h2>A heading</h2><p><img src="${pixel}" alt="First"></p><p><img src="${pixel}" alt="Second"></p>`);
  await expect(page.getByRole('textbox', { name: /Suggested caption from paragraph/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Skip image', exact: true }).click();
  await expect(page.getByRole('textbox', { name: /Suggested caption from paragraph/ })).toHaveCount(0);
});
