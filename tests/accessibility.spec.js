import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');
const simple = '<h2 id="intro">Introduction</h2><p>Review the document.</p><table><caption>Population</caption><thead><tr><th id="region" scope="col">Region</th><th id="total" scope="col">Total</th></tr></thead><tbody><tr><th id="north" scope="row">North</th><td>42</td></tr><tr><th id="south" scope="row">South</th><td>56</td></tr></tbody></table>';
const complex = '<h2>Complex data</h2><table><caption>Grouped population</caption><thead><tr><th rowspan="2" scope="col">Region</th><th colspan="2" scope="colgroup">Year</th></tr><tr><th scope="col">2025</th><th scope="col">2026</th></tr></thead><tbody><tr><th scope="row">North</th><td colspan="2">42</td></tr><tr><th scope="row">South</th><td>30</td><td>40</td></tr></tbody></table>';
async function ready(page, html = simple) {
  await page.goto('/');
  await page.waitForFunction(() => window.tinymce?.activeEditor?.initialized);
  await page.evaluate(html => { const e = window.tinymce.activeEditor; e.setContent(html); e.undoManager.clear(); e.undoManager.add(); e.selection.select(e.getBody().querySelector('td') ?? e.getBody().querySelector('p')); }, html);
}
async function action(page, name, index = 0) {
  await page.evaluate(({ name, index }) => { const item = window.tinymce.activeEditor.ui.registry.getAll().buttons[name]; if (item.fetch) item.fetch(items => items[index].onAction()); else item.onAction(); }, { name, index });
}
async function audit(page) {
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] } });
    return r.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }));
  });
  expect(violations).toEqual([]);
}
async function openComplex(page) {
  await ready(page, complex); await action(page, 'tableaccessibility');
  await page.getByRole('button', { name: 'Review relationships', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}
const scenarios = [
  ['main'], ['sourcecodepro'], ['documentqa'], ['downloadlink'], ['cleanhtml'],
  ['sections',0], ['tocmanager',0], ['footnotes',0], ['wetstyles',0],
  ['tableworkstation',0], ['tableworkstation',2], ['tableaccessibility'], ['leftrowheaders'],
  ['command:mceLink'], ['command:mceCodeEditor'], ['command:SearchReplace'],
  ['command:mceTableProps'], ['command:mceTableCellProps'], ['command:mceTableRowProps'],
];
for (const [name, index] of scenarios) {
  test('WCAG scan: ' + name + (index === undefined ? '' : ' ' + index), async ({ page }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await ready(page);
    if (name.startsWith('command:')) await page.evaluate(command => window.tinymce.activeEditor.execCommand(command), name.slice(8));
    else if (name !== 'main') await action(page, name, index);
    if (name !== 'main') await expect(page.getByRole('dialog')).toBeVisible();
    await audit(page); expect(errors).toEqual([]);
    await page.setViewportSize({ width: 320, height: 800 }); await audit(page);
  });
}
for (const name of ['sourcecodepro','documentqa','tableworkstation','complex-reviewer']) {
  test('Keyboard containment, Escape, and focus return: ' + name, async ({ page }) => {
    if (name === 'complex-reviewer') await openComplex(page); else { await ready(page); await action(page,name); }
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => !!document.activeElement.closest('dialog[open]'))).toBeTruthy();
    for (let i=0;i<35;i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement.closest('dialog[open]'))).toBeTruthy(); }
    for (let i=0;i<35;i++) { await page.keyboard.press('Shift+Tab'); expect(await page.evaluate(() => !!document.activeElement.closest('dialog[open]'))).toBeTruthy(); }
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.activeElement.tagName)).not.toBe('BODY');
  });
}
for (const label of ['Document tools','Document structure tools','Accessibility tools','Code: HTML source tools']) {
  test('Expanded toolbar accessible names: '+label, async ({ page }) => {
    await ready(page); await page.getByRole('button',{name:label,exact:true}).focus(); await page.keyboard.press('Space'); await audit(page);
  });
}
test('Source edits apply, undo, and cancel without changing the document', async ({ page }) => {
  await ready(page); const before=await page.evaluate(()=>window.tinymce.activeEditor.getContent());
  await action(page,'sourcecodepro'); await page.getByRole('textbox',{name:'Document HTML source'}).fill('<h2>Changed content</h2>'); await page.getByRole('button',{name:'Apply',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); expect(await page.evaluate(()=>window.tinymce.activeEditor.getContent())).toContain('Changed content');
  await page.evaluate(()=>window.tinymce.activeEditor.undoManager.undo()); expect(await page.evaluate(()=>window.tinymce.activeEditor.getContent())).toBe(before);
  await action(page,'sourcecodepro'); await page.getByRole('textbox',{name:'Document HTML source'}).fill('<p>Discarded draft</p>'); await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>window.tinymce.activeEditor.getContent())).toBe(before);
});
test('Source keyboard opener and close return focus to the app', async ({ page }) => {
  await ready(page);await page.getByRole('button',{name:'Code: HTML source tools',exact:true}).focus();await page.keyboard.press('Space');
  await page.getByRole('button',{name:/Source Code Pro:/}).focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');
  await expect.poll(()=>page.evaluate(()=>document.activeElement.tagName)).not.toBe('BODY');
});
test('Pointer down outside source does not discard the draft', async ({ page }) => {
  await ready(page);await action(page,'sourcecodepro');await page.getByRole('textbox',{name:'Document HTML source'}).fill('<p>Draft</p>');
  await page.mouse.move(2,2);await page.mouse.down();await expect(page.getByRole('dialog')).toBeVisible();await page.mouse.move(100,100);await page.mouse.up();
  await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('textbox',{name:'Document HTML source'})).toContainText('Draft');
});
test('Source remains usable at 400 percent zoom equivalent', async ({ page }) => {
  await ready(page);await action(page,'sourcecodepro');await page.setViewportSize({width:320,height:225});
  expect(await page.locator('.scp-editor').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThan(100);
  await page.getByRole('textbox',{name:'Document HTML source'}).fill('<h2>Zoomed editing</h2>');
  await page.getByRole('button',{name:'Apply',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>window.tinymce.activeEditor.getContent())).toContain('Zoomed editing');
});
test('Document QA report can be scrolled with the keyboard', async ({ page }) => {
  await ready(page);await action(page,'documentqa');const report=page.getByRole('region',{name:'Document accessibility report'});
  await report.focus();await page.keyboard.press('PageDown');
  await expect.poll(()=>report.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
});
test('Complex reviewer selects another cell with the keyboard and exposes live validation', async ({ page }) => {
  await openComplex(page);const cells=page.locator('.table-a11y-cell-button');await expect(cells).toHaveCount(3);
  await cells.nth(1).focus();await page.keyboard.press('Enter');await expect(cells.nth(1)).toHaveAttribute('aria-pressed','true');
  await expect(page.getByLabel('Complex table description (optional)',{exact:true})).toBeVisible();
  await expect(page.locator('.table-a11y-validation-status')).toHaveAttribute('role','status');
  await audit(page);await page.getByRole('button',{name:'Apply relationships',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>window.tinymce.activeEditor.getContent())).toContain('headers=');
});
test('Download validation, insertion, and undo', async ({ page }) => {
  await ready(page);await action(page,'downloadlink');await page.getByRole('button',{name:'Insert download link',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Enter the document title.');await audit(page);
  await page.getByLabel('Document title',{exact:true}).fill('Report');await page.getByLabel('File path or URL',{exact:true}).fill('/report.pdf');
  await page.getByLabel('Image URL',{exact:true}).fill('/icon.png');await page.getByLabel('File size',{exact:true}).fill('273');
  await page.getByRole('button',{name:'Insert download link',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>window.tinymce.activeEditor.getContent())).toContain('report.pdf');
  await page.evaluate(()=>window.tinymce.activeEditor.undoManager.undo());expect(await page.evaluate(()=>window.tinymce.activeEditor.getContent())).not.toContain('report.pdf');
});
for (const [name,button] of [['sections','Build Sections'],['tocmanager','Create TOC']]) {
  test('Generated '+name+' create and remove dialogs',async({page})=>{
    await ready(page);await action(page,name);await page.getByRole('button',{name:button,exact:true}).click();await action(page,name,1);await expect(page.getByRole('dialog')).toBeVisible();await audit(page);
    await page.getByRole('dialog').locator('.tox-dialog__footer .tox-button:not(.tox-button--secondary)').click();await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}
test('Imported footnote review dialog',async({page})=>{
  await ready(page,'<h2>Document</h2><p>Text<sup><a href="#footnote-1" id="footnote-ref-1">1</a></sup></p><ol><li id="footnote-1">Footnote body <a href="#footnote-ref-1">Return</a></li></ol>');
  await action(page,'footnotes',1);await expect(page.getByRole('dialog')).toBeVisible();await audit(page);
  await page.getByRole('button',{name:'Convert to WET-BOEW',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>window.tinymce.activeEditor.getContent())).toContain('wb-fnote');
});

test('Text spacing and doubled text preserve source editing',async({page})=>{
  await ready(page);await action(page,'sourcecodepro');
  await page.addStyleTag({content:'*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}'});
  await page.evaluate(()=>{const sizes=Array.from(document.querySelectorAll('.scp-modal *')).map(el=>({el,size:parseFloat(getComputedStyle(el).fontSize)}));sizes.forEach(({el,size})=>el.style.fontSize=(size*2)+'px');});
  expect(await page.locator('.scp-editor').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThan(100);
  await page.getByRole('textbox',{name:'Document HTML source'}).fill('<p>Spaced text</p>');await page.getByRole('button',{name:'Apply',exact:true}).focus();await page.keyboard.press('Enter');
  expect(await page.evaluate(()=>window.tinymce.activeEditor.getContent())).toContain('Spaced text');
});
test('Word import success and undo',async({page})=>{
  await ready(page);const before=await page.evaluate(()=>window.tinymce.activeEditor.getContent());
  const fileChoice=page.waitForEvent('filechooser');await action(page,'importword');await (await fileChoice).setFiles('tests/fixtures/import.docx');
  await expect.poll(()=>page.evaluate(()=>window.tinymce.activeEditor.getContent())).toContain('Imported test document');
  await expect(page.getByRole('alert')).toContainText('successfully');await audit(page);
  await page.evaluate(()=>window.tinymce.activeEditor.undoManager.undo());expect(await page.evaluate(()=>window.tinymce.activeEditor.getContent())).toBe(before);
});
test('Word import failure preserves the document and announces the error',async({page})=>{
  await ready(page);const before=await page.evaluate(()=>window.tinymce.activeEditor.getContent());
  const fileChoice=page.waitForEvent('filechooser');await action(page,'importword');await (await fileChoice).setFiles({name:'invalid.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:Buffer.from('invalid document')});
  await expect(page.getByRole('alert')).toBeVisible();expect(await page.evaluate(()=>window.tinymce.activeEditor.getContent())).toBe(before);await audit(page);
});
test('Simple table caption change and undo',async({page})=>{
  await ready(page);await action(page,'tableaccessibility');await page.getByLabel('Table caption',{exact:true}).fill('Updated caption');
  await page.getByRole('button',{name:'Apply accessibility',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>window.tinymce.activeEditor.getContent())).toContain('Updated caption');await page.evaluate(()=>window.tinymce.activeEditor.undoManager.undo());
  expect(await page.evaluate(()=>window.tinymce.activeEditor.getContent())).not.toContain('Updated caption');
});
test('Left row headers remain functional',async({page})=>{
  await ready(page);await action(page,'leftrowheaders');await page.getByRole('button',{name:'Apply left headers',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>window.tinymce.activeEditor.getBody().querySelector('tbody th').getAttribute('scope'))).toBe('row');
});

test('Built-in source editor save and undo',async({page})=>{
  await ready(page);const before=await page.evaluate(()=>window.tinymce.activeEditor.getContent());
  await page.evaluate(()=>window.tinymce.activeEditor.execCommand('mceCodeEditor'));await page.getByLabel('Document HTML source',{exact:true}).fill('<h2>Built-in edit</h2>');
  await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>window.tinymce.activeEditor.getContent())).toContain('Built-in edit');
  await page.evaluate(()=>window.tinymce.activeEditor.undoManager.undo());expect(await page.evaluate(()=>window.tinymce.activeEditor.getContent())).toBe(before);
});
test('Source formatting and keyboard apply',async({page})=>{
  await ready(page);await action(page,'sourcecodepro');await page.getByRole('textbox',{name:'Document HTML source'}).fill('<div><p>Formatted test</p></div>');
  await page.getByRole('button',{name:'Format HTML',exact:true}).click();await expect(page.locator('[data-message]')).toContainText('HTML formatted.');
  await page.getByRole('textbox',{name:'Document HTML source'}).focus();await page.keyboard.press('Control+Enter');await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>window.tinymce.activeEditor.getContent())).toContain('Formatted test');
});
test('Table workstation navigation exposes the chosen table',async({page})=>{
  await ready(page);await action(page,'tableworkstation',2);const buttons=page.locator('[data-navigation] button');
  await buttons.nth(1).focus();await page.keyboard.press('Enter');await expect(page.locator('[data-content]')).toContainText('Table preview');await audit(page);
});
test('Keyboard target sizes and focus indicator for table cells',async({page})=>{
  await openComplex(page);const button=page.locator('.table-a11y-cell-button').first();await page.keyboard.press('Tab');await button.focus();
  const dimensions=await button.evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {width:r.width,height:r.height,outlineWidth:parseFloat(s.outlineWidth),outlineStyle:s.outlineStyle};});
  expect(dimensions.width).toBeGreaterThanOrEqual(24);expect(dimensions.height).toBeGreaterThanOrEqual(24);expect(dimensions.outlineWidth).toBeGreaterThanOrEqual(2);expect(dimensions.outlineStyle).not.toBe('none');
});
