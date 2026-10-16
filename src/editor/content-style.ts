/** Advisory Canada.ca checks on authored text only. Never rewrite HTML attributes. */
export type ContentLanguage = 'en' | 'fr';
export interface ContentSuggestion {
  node: Text; start: number; original: string; replacement?: string;
  title: string; detail: string; language: ContentLanguage;
}
export const styleGuide = (language: ContentLanguage) => language === 'fr'
  ? 'https://conception.canada.ca/guide-redaction/' : 'https://design.canada.ca/style-guide/';

export function reviewContent(body: HTMLElement, fallback: ContentLanguage): ContentSuggestion[] {
  const findings: ContentSuggestion[] = [];
  const walker = body.ownerDocument.createTreeWalker(body, 4);
  let current: Node | null;
  while ((current = walker.nextNode())) {
    const node = current as Text;
    const parent = node.parentElement;
    if (!parent || parent.closest('code,pre,kbd,samp,script,style,a,[contenteditable="false"],[hidden]')) continue;
    const declared = parent.closest('[lang]')?.getAttribute('lang')?.toLowerCase();
    if (declared && !/^(en|fr)(-|$)/.test(declared)) continue;
    const language: ContentLanguage = declared?.startsWith('fr') ? 'fr' : declared?.startsWith('en') ? 'en' : fallback;
    const value = node.data;
    const occupied: [number, number][] = [];
    const add = (pattern: RegExp, title: string, detail: string, replace?: (match: RegExpExecArray) => string) => {
      for (const match of value.matchAll(pattern)) {
        const start = match.index!;
        // Do not move a currency symbol or format only the tail of a grouped amount.
        if (/Currency|Percentage|Non-breaking/.test(title) &&
          (/\d[ \u00a0]+$/.test(value.slice(0, start)) || /^[ \u00a0]+\d/.test(value.slice(start + match[0].length)))) continue;
        // Avoid URLs, email addresses and identifiers embedded in otherwise ordinary text.
        const token = value.slice(0, start).split(/\s/).pop() + value.slice(start).split(/\s/)[0];
        if (/https?:|www\.|@|[_=]/i.test(token) || occupied.some(([a, b]) => start < b && start + match[0].length > a)) continue;
        const replacement = replace?.(match);
        if (replacement === match[0]) continue;
        occupied.push([start, start + match[0].length]);
        findings.push({ node, start, original: match[0], replacement, title, detail, language });
      }
    };
    const number = '(?<![\\w.,])([0-9]+(?:[.,][0-9]+)?)';
    add(new RegExp(number + '[ \\u00a0]*(?:percent|per cent|pour cent|p\\. 100|%)(?![\\w])', 'gi'),
      'Percentage format', 'Use the percent symbol. French uses a non-breaking space before %. English has no space.',
      m => m[1] + (language === 'fr' ? '\u00a0%' : '%'));
    if (language === 'fr') {
      add(/\$(\d+(?:[.,]\d+)?)(?![\d.,])/g, 'Currency symbol position',
        'In French, place the dollar symbol after the amount, separated by a non-breaking space. Confirm the currency and decimal notation.', m => m[1] + '\u00a0$');
      add(new RegExp(number + ' +\\$', 'g'), 'Currency spacing', 'Keep the amount and dollar symbol together with a non-breaking space.', m => m[1] + '\u00a0$');
    } else {
      add(new RegExp(number + '[ \\u00a0]+\\$', 'g'), 'Currency symbol position',
        'In English, place the dollar symbol before the amount. Confirm the currency and decimal notation.', m => '$' + m[1]);
    }
    const months = language === 'en'
      ? 'January|February|March|April|May|June|July|August|September|October|November|December'
      : 'janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre';
    if (language === 'en') add(new RegExp('\\b(' + months + ') ([1-9]|[12][0-9]|3[01])(st|nd|rd|th)?\\b', 'gi'),
      'Date format', 'Use a cardinal day, and keep the month and day together with a non-breaking space.', m => m[1] + '\u00a0' + m[2]);
    else add(new RegExp('\\b([1-9]|[12][0-9]|3[01]) (' + months + ')(,)?', 'gi'),
      'Date format', 'Keep the day and month together. French dates have no comma. Review the special form for the first day of the month.',
      m => m[1] === '1' ? m[0] : m[1] + '\u00a0' + m[2]);
    if (language === 'fr') add(new RegExp('\\b1 (' + months + ')\\b', 'gi'), 'First day of the month',
      'Review the French first-day form: use 1 with a superscript er, followed by a non-breaking space and the month. This requires an editorial markup change.');
    add(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, 'Ambiguous numeric date',
      'Confirm the day and month. Prefer a written month in prose. In limited space, use YYYY-MM-DD and explain the format.');
    add(new RegExp(number + ' +(years?|ans?|months?|mois|days?|jours?|million[s]?|billion[s]?|milliard[s]?|kg|km|cm|mm|m|g|L)\\b', 'gi'),
      'Non-breaking space', 'Keep this number and its word or unit together. Confirm that the wording and unit are appropriate.', m => m[1] + '\u00a0' + m[2]);
    if (!parent.closest('table,ol,ul,h1,h2,h3,h4,h5,h6')) {
      add(/\b[0-9]\b(?= +(applications?|requests?|documents?|people|personnes?|demandes?)\b)/gi,
        'Small number in prose', 'Consider spelling out zero to nine in narrative text. Keep digits for data, comparisons, ages and other exceptions. Review the context; no automatic replacement is offered.');
    }
  }
  return findings;
}

export function applyContentSuggestion(issue: ContentSuggestion): boolean {
  if (issue.replacement === undefined || !issue.node.isConnected || issue.node.data.slice(issue.start, issue.start + issue.original.length) !== issue.original) return false;
  issue.node.replaceData(issue.start, issue.original.length, issue.replacement);
  return true;
}
