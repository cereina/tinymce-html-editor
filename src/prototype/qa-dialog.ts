import type { Editor } from 'tinymce';
import type { QaReport } from '../editor/document-qa';
import { reviewContent, applyContentSuggestion, styleGuide, type ContentLanguage } from '../editor/content-style';
import { modalTabTargets } from './modal-actions';
import type {} from '@gcds-core/components/dist/types/components';
import { defineCustomElementGcdsButton, defineCustomElementGcdsText, defineCustomElementGcdsAlert } from '@gcds-core/components/dist/components/index.js';
import '@gcds-core/components/dist/gcds/gcds.css';
import './download-dialog.css';
import '../editor/document-qa.css';

[defineCustomElementGcdsButton, defineCustomElementGcdsText, defineCustomElementGcdsAlert].forEach(define => define());
let activeClose: (() => void) | undefined;

export function openGcQaDialog(editor: Editor, analyze: () => QaReport): void {
  activeClose?.();
  const opener = document.activeElement as HTMLElement | null;
  const dialog = document.createElement('dialog');
  dialog.className = 'gc-download gc-qa';
  dialog.setAttribute('aria-labelledby', 'document-qa-title');
  dialog.setAttribute('aria-describedby', 'document-qa-description');
  dialog.innerHTML = `<header class="gc-download-header"><div>
    <h2 id="document-qa-title" tabindex="-1">Document QA</h2>
    <gcds-text id="document-qa-description" size="small" margin-bottom="0">Review structure, links, accessibility indicators, footnotes, and HTML quality before publishing.</gcds-text>
    </div></header><div class="gc-download-body document-qa-content" role="region" aria-label="Document accessibility report" tabindex="0"></div>
    <footer class="gc-download-footer"></footer>`;
  const content = dialog.querySelector<HTMLElement>('.document-qa-content')!;
  const status = document.createElement('span');
  status.className = 'gc-qa-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-label', 'QA check updates');
  dialog.append(status);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true; editor.off('remove', close); dialog.close(); dialog.remove();
    if (activeClose === close) activeClose = undefined;
    if (opener?.isConnected) opener.focus();
    if (document.activeElement === document.body) editor.focus();
  };
  const button = (label: string, primary = false) => {
    const host = document.createElement('gcds-button');
    host.type = 'button'; host.buttonRole = primary ? 'primary' : 'secondary'; host.textContent = label;
    return host;
  };
  const dismiss = button('Close'); dismiss.size = 'small'; dismiss.setAttribute('aria-label', 'Close Document QA');
  dismiss.addEventListener('click', close); dialog.querySelector('header')!.append(dismiss);
  const rerun = button('Re-run checks');
  const done = button('Close', true); done.addEventListener('click', close);
  dialog.querySelector('footer')!.append(rerun, done);
  const heading = (level: 3 | 4, text: string) => {
    const element = document.createElement('h' + level); element.textContent = text; return element;
  };
  const definitions = (rows: [string, number][]) => {
    const list = document.createElement('dl'); list.className = 'gc-qa-metrics';
    rows.forEach(([label, value]) => {
      const row = document.createElement('div'); const term = document.createElement('dt'); const description = document.createElement('dd');
      term.textContent = label; description.textContent = String(value); row.append(term, description); list.append(row);
    });
    return list;
  };
  let runs = 0;
  let language: ContentLanguage = 'en';
  const ignored = new WeakMap<Text, Set<string>>();
  const styleSection = document.createElement('section');
  styleSection.className = 'gc-qa-category';
  const renderStyle = () => {
    styleSection.replaceChildren(heading(3, 'Content style review'));
    const note = document.createElement('p');
    note.textContent = 'Advisory Canada.ca writing suggestions, separate from accessibility results. Check context before applying. Checks cover text within individual text nodes; code, links and HTML attributes are excluded. Nested language attributes take precedence.';
    const label = document.createElement('label'); label.htmlFor = 'qa-content-language'; label.textContent = 'Content language';
    const select = document.createElement('select'); select.id = 'qa-content-language';
    for (const [value, text] of [['en', 'English'], ['fr', 'Français']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
    }
    select.value = language;
    select.addEventListener('change', () => { language = select.value as ContentLanguage; renderStyle(); styleSection.querySelector('select')!.focus(); });
    styleSection.append(note, label, select);
    const key = (issue: ReturnType<typeof reviewContent>[number]) => JSON.stringify([issue.start, issue.original, issue.replacement, issue.language, issue.node.data]);
    const issues = reviewContent(editor.getBody(), language).filter(issue => !ignored.get(issue.node)?.has(key(issue)));
    const count = document.createElement('p'); count.textContent = `${issues.length} content style suggestions. Use the editor Undo command to reverse an applied suggestion.`; styleSection.append(count);
    issues.forEach((issue, index) => {
      const article = document.createElement('article'); article.className = 'gc-qa-issue';
      const detail = document.createElement('p'); detail.textContent = issue.detail;
      const preview = document.createElement('p');
      preview.textContent = `Original: ${issue.original}${issue.replacement === undefined ? '' : ` → Suggested: ${issue.replacement.replaceAll('\u00a0', '⍽')} (⍽ means non-breaking space)`}`;
      const source = document.createElement('a'); source.href = styleGuide(issue.language); source.target = '_blank'; source.rel = 'noopener noreferrer'; source.textContent = `${issue.language === 'fr' ? 'French' : 'English'} Canada.ca style guide (opens in a new tab)`;
      const actions = document.createElement('div'); actions.className = 'gc-qa-style-actions';
      const go = button('Go to content issue'); go.setAttribute('aria-label', `Go to content issue ${index + 1}: ${issue.title}`);
      go.addEventListener('click', () => {
        if (!issue.node.isConnected || issue.node.data.slice(issue.start, issue.start + issue.original.length) !== issue.original) { renderStyle(); return; }
        close(); editor.focus(); const range = editor.getDoc().createRange(); range.setStart(issue.node, issue.start); range.setEnd(issue.node, issue.start + issue.original.length); editor.selection.setRng(range); issue.node.parentElement?.scrollIntoView({ block: 'center' });
      });
      actions.append(go);
      if (issue.replacement !== undefined) {
        const apply = button('Apply suggestion'); apply.setAttribute('aria-label', `Apply suggestion ${index + 1}: ${issue.title}`);
        apply.addEventListener('click', () => {
          let applied = false;
          editor.undoManager.transact(() => { applied = applyContentSuggestion(issue); });
          if (applied) { editor.nodeChanged(); editor.setDirty(true); }
          renderStyle(); selectFocus(); status.textContent = applied ? 'Suggestion applied. Use editor Undo to reverse this change.' : 'Content changed. Suggestions refreshed; no change was applied.';
        }); actions.append(apply);
      }
      const ignore = button('Ignore'); ignore.setAttribute('aria-label', `Ignore suggestion ${index + 1}: ${issue.title}`);
      ignore.addEventListener('click', () => { const keys = ignored.get(issue.node) ?? new Set<string>(); keys.add(key(issue)); ignored.set(issue.node, keys); renderStyle(); selectFocus(); status.textContent = 'Suggestion ignored for this review.'; });
      actions.append(ignore); article.append(heading(4, issue.title), detail, preview, source, actions); styleSection.append(article);
    });
  };
  const selectFocus = () => styleSection.querySelector('select')!.focus();
  const render = () => {
    const report = analyze();
    content.replaceChildren();
    const summary = document.createElement('gcds-alert');
    summary.alertRole = report.errors ? 'danger' : report.warnings || report.reviews ? 'warning' : 'success';
    const reviewCount = report.warnings + report.reviews;
    summary.heading = report.errors ? `${report.errors} ${report.errors === 1 ? 'error needs' : 'errors need'} attention`
      : reviewCount ? `${reviewCount} ${reviewCount === 1 ? 'item needs' : 'items need'} review` : 'Automated checks passed';
    summary.hideCloseBtn = true;
    summary.textContent = 'This report is advisory. Automated checks cannot prove that a page is fully accessible or publication-ready.';
    content.append(summary, heading(3, 'Findings summary'), definitions([
      ['Errors', report.errors], ['Warnings', report.warnings], ['Review items', report.reviews],
    ]), heading(3, 'Document overview'), definitions([
      ['Headings', report.metrics.headings], ['Generated sections', report.metrics.generatedSections],
      ['Links', report.metrics.links], ['Images', report.metrics.images], ['Tables', report.metrics.tables], ['WET footnotes', report.metrics.wetFootnotes],
    ]));
    const categories = ['Structure', 'Links', 'Accessibility', 'Footnotes', 'HTML'] as const;
    categories.forEach(category => {
      const section = document.createElement('section'); section.className = 'gc-qa-category';
      const issues = report.issues.filter(issue => issue.category === category);
      section.append(heading(3, `${category} (${issues.length} ${issues.length === 1 ? 'issue' : 'issues'})`));
      if (!issues.length) {
        const text = document.createElement('gcds-text'); text.marginBottom = '0';
        text.textContent = `No issues detected by the current automated ${category.toLowerCase()} checks.`; section.append(text);
      }
      issues.forEach(issue => {
        const article = document.createElement('article'); article.className = 'gc-qa-issue';
        article.append(heading(4, issue.title));
        const severity = document.createElement('p'); severity.className = 'gc-qa-severity';
        severity.textContent = issue.severity === 'error' ? 'Error' : issue.severity === 'warning' ? 'Warning' : 'Review item';
        const detail = document.createElement('gcds-text'); detail.textContent = issue.detail;
        article.append(severity, detail);
        if (issue.target) {
          const go = button('Go to issue'); go.setAttribute('aria-label', `Go to issue ${issue.id.slice(3)}: ${issue.title}`);
          go.dataset.qaIssue = issue.id;
          go.addEventListener('click', () => {
            if (!issue.target?.isConnected) return;
            close(); editor.focus(); editor.selection.select(issue.target);
            issue.target.scrollIntoView({ block: 'center', inline: 'nearest' }); editor.nodeChanged();
          });
          article.append(go);
        }
        section.append(article);
      });
      content.append(section);
    });
    renderStyle(); content.append(styleSection);
    content.scrollTop = 0;
    if (runs++) status.textContent = `Checks refreshed (${runs}). ${report.errors} errors, ${report.warnings} warnings, ${report.reviews} review items.`;
  };
  rerun.addEventListener('click', render);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
    if (event.key !== 'Tab') return;
    const targets = modalTabTargets(dialog);
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    const index = targets.indexOf(active as HTMLElement);
    const next = index < 0 ? (event.shiftKey ? targets.length - 1 : 0) : (index + (event.shiftKey ? -1 : 1) + targets.length) % targets.length;
    event.preventDefault(); targets[next]!.focus();
  }, true);
  render(); document.body.append(dialog); activeClose = close; editor.on('remove', close);
  dialog.showModal(); dialog.querySelector<HTMLElement>('h2')!.focus();
}
