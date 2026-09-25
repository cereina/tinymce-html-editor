import type {
  Editor,
} from 'tinymce';

import './document-qa.css';


type QaSeverity =
  | 'error'
  | 'warning'
  | 'review';


type QaCategory =
  | 'Structure'
  | 'Links'
  | 'Accessibility'
  | 'Footnotes'
  | 'HTML';


interface QaIssue {
  id: string;

  category:
    QaCategory;

  severity:
    QaSeverity;

  title:
    string;

  detail:
    string;

  target:
    HTMLElement | null;
}


interface QaMetrics {
  headings: number;

  generatedSections: number;

  links: number;

  images: number;

  tables: number;

  wetFootnotes: number;
}


interface QaReport {
  issues:
    QaIssue[];

  metrics:
    QaMetrics;

  errors:
    number;

  warnings:
    number;

  reviews:
    number;
}


const CATEGORIES:
QaCategory[] = [
  'Structure',
  'Links',
  'Accessibility',
  'Footnotes',
  'HTML',
];


let activeDocumentQaClose:
  (() => void) | null =
  null;


/* =========================================================
   BASIC UTILITIES
   ========================================================= */


function escapeHtml(
  value: string
): string {
  const div =
    document.createElement(
      'div'
    );

  div.textContent =
    value;

  return div.innerHTML;
}


function normalizeText(
  value: string
): string {
  return value
    .replace(
      /\u00a0/g,
      ' '
    )
    .replace(
      /\u200B/g,
      ''
    )
    .replace(
      /\uFEFF/g,
      ''
    )
    .replace(
      /\s+/g,
      ' '
    )
    .trim();
}


function truncate(
  value: string,
  maxLength = 90
): string {
  const normalized =
    normalizeText(
      value
    );

  if (
    normalized.length <=
    maxLength
  ) {
    return normalized;
  }

  return (
    normalized.substring(
      0,
      maxLength - 3
    ) +
    '...'
  );
}


function getFragmentId(
  href:
    string | null
): string {
  if (
    !href ||
    !href.startsWith(
      '#'
    )
  ) {
    return '';
  }

  const raw =
    href.substring(
      1
    );

  if (
    !raw
  ) {
    return '';
  }

  try {
    return decodeURIComponent(
      raw
    );
  } catch {
    return raw;
  }
}


function getHeadingLevel(
  heading:
    Element
): number {
  return Number(
    heading.tagName
      .substring(
        1
      )
  );
}


function getElementLabel(
  element:
    HTMLElement
): string {
  const text =
    truncate(
      element.textContent ??
      ''
    );

  if (
    text
  ) {
    return text;
  }

  if (
    element.id
  ) {
    return (
      '#' +
      element.id
    );
  }

  return (
    '<' +
    element.tagName
      .toLowerCase() +
    '>'
  );
}


function isHeading(
  element:
    Element
): element is
  HTMLHeadingElement {
  return /^H[1-6]$/.test(
    element.tagName
  );
}


function getIdCounts(
  root:
    HTMLElement
): Map<
  string,
  number
> {
  const counts =
    new Map<
      string,
      number
    >();

  Array.from(
    root.querySelectorAll<
      HTMLElement
    >(
      '[id]'
    )
  ).forEach(
    (
      element
    ) => {
      const id =
        element.id.trim();

      if (
        !id
      ) {
        return;
      }

      counts.set(
        id,
        (
          counts.get(
            id
          ) ??
          0
        ) +
          1
      );
    }
  );

  return counts;
}


/* =========================================================
   DOCUMENT ANALYSIS
   ========================================================= */


function analyzeDocument(
  editor:
    Editor
): QaReport {
  const root =
    editor.getBody();

  const issues:
    QaIssue[] =
    [];

  let issueNumber =
    0;


  const addIssue =
    (
      category:
        QaCategory,
      severity:
        QaSeverity,
      title:
        string,
      detail:
        string,
      target:
        HTMLElement | null
    ): void => {
      issueNumber++;

      issues.push({
        id:
          'qa-' +
          issueNumber,

        category,

        severity,

        title,

        detail,

        target,
      });
    };


  /* -------------------------------------------------------
     STRUCTURE
     ------------------------------------------------------- */


  const headings =
    Array.from(
      root.querySelectorAll<
        HTMLHeadingElement
      >(
        'h1, h2, h3, h4, h5, h6'
      )
    ).filter(
      (
        heading
      ) =>
        !heading.closest(
          'nav, aside, table'
        )
    );


  let previousHeading:
    HTMLHeadingElement | null =
    null;


  headings.forEach(
    (
      heading
    ) => {
      if (
        previousHeading
      ) {
        const previousLevel =
          getHeadingLevel(
            previousHeading
          );

        const currentLevel =
          getHeadingLevel(
            heading
          );

        if (
          currentLevel >
          previousLevel +
          1
        ) {
          addIssue(
            'Structure',
            'warning',
            'Heading level is skipped',
            (
              'The document moves from H' +
              previousLevel +
              ' to H' +
              currentLevel +
              ' at "' +
              getElementLabel(
                heading
              ) +
              '". Review the heading hierarchy.'
            ),
            heading
          );
        }
      }

      previousHeading =
        heading;
    }
  );


  const generatedSections =
    Array.from(
      root.querySelectorAll<
        HTMLElement
      >(
        'section[data-heading-section="true"]'
      )
    );


  generatedSections.forEach(
    (
      section
    ) => {
      const first =
        section.firstElementChild;

      if (
        !first ||
        !isHeading(
          first
        )
      ) {
        addIssue(
          'Structure',
          'error',
          'Generated section does not start with a heading',
          'A generated heading section should begin with its heading.',
          section
        );
      }
    }
  );


  Array.from(
    root.querySelectorAll<
      HTMLElement
    >(
      'aside.wb-fnote'
    )
  ).forEach(
    (
      aside
    ) => {
      if (
        aside.closest(
          'section[data-heading-section="true"]'
        )
      ) {
        addIssue(
          'Structure',
          'error',
          'WET footnotes are inside a generated heading section',
          'The wb-fnote aside should remain at the document level, outside generated heading sections.',
          aside
        );
      }
    }
  );


  /* -------------------------------------------------------
     LINKS
     ------------------------------------------------------- */


  const links =
    Array.from(
      root.querySelectorAll<
        HTMLAnchorElement
      >(
        'a[href]'
      )
    );


  links.forEach(
    (
      link
    ) => {
      const href =
        link.getAttribute(
          'href'
        );

      if (
        href?.startsWith(
          '#'
        )
      ) {
        const targetId =
          getFragmentId(
            href
          );

        if (
          !targetId
        ) {
          addIssue(
            'Links',
            'warning',
            'Internal link has no target',
            'This link uses "#" without an ID.',
            link
          );
        } else if (
          !root.ownerDocument
            .getElementById(
              targetId
            )
        ) {
          addIssue(
            'Links',
            'error',
            'Broken internal link',
            (
              'The link points to #' +
              targetId +
              ', but that ID does not exist in the document.'
            ),
            link
          );
        }
      }


      const accessibleName =
        normalizeText(
          link.textContent ??
          ''
        ) ||
        normalizeText(
          link.getAttribute(
            'aria-label'
          ) ??
          ''
        ) ||
        normalizeText(
          link.querySelector(
            'img'
          )
            ?.getAttribute(
              'alt'
            ) ??
          ''
        );

      if (
        !accessibleName
      ) {
        addIssue(
          'Accessibility',
          'error',
          'Link has no accessible text',
          'Add meaningful link text, an aria-label, or appropriate alternative text.',
          link
        );
      }
    }
  );


  /* -------------------------------------------------------
     IMAGES
     ------------------------------------------------------- */


  const images =
    Array.from(
      root.querySelectorAll<
        HTMLImageElement
      >(
        'img'
      )
    );


  images.forEach(
    (
      image
    ) => {
      if (
        !image.hasAttribute(
          'alt'
        )
      ) {
        addIssue(
          'Accessibility',
          'error',
          'Image is missing an alt attribute',
          'Every image needs an alt attribute. Decorative images can use alt="".',
          image
        );
      }
    }
  );


  /* -------------------------------------------------------
     TABLES
     ------------------------------------------------------- */


  const tables =
    Array.from(
      root.querySelectorAll<
        HTMLTableElement
      >(
        'table'
      )
    );


  tables.forEach(
    (
      table,
      index
    ) => {
      const label =
        normalizeText(
          table.caption
            ?.textContent ??
          ''
        ) ||
        (
          'Table ' +
          (
            index +
            1
          )
        );


      if (
        !normalizeText(
          table.caption
            ?.textContent ??
          ''
        )
      ) {
        addIssue(
          'Accessibility',
          'warning',
          'Table is missing a meaningful caption',
          (
            label +
            ' does not have a meaningful caption.'
          ),
          table
        );
      }


      const headers =
        Array.from(
          table.querySelectorAll<
            HTMLTableCellElement
          >(
            'th'
          )
        );

      if (
        headers.length ===
        0
      ) {
        addIssue(
          'Accessibility',
          'error',
          'Table has no header cells',
          (
            label +
            ' does not contain any TH elements.'
          ),
          table
        );
      }


      const mergedDataCell =
        table.querySelector<
          HTMLTableCellElement
        >(
          'td[rowspan]:not([rowspan="1"]), td[colspan]:not([colspan="1"])'
        );

      if (
        mergedDataCell
      ) {
        addIssue(
          'Accessibility',
          'review',
          'Table contains merged data cells',
          (
            label +
            ' contains merged TD cells. Review its header relationships in the Table Workstation.'
          ),
          mergedDataCell
        );
      }


      Array.from(
        table.querySelectorAll<
          HTMLTableCellElement
        >(
          'td[headers], th[headers]'
        )
      ).forEach(
        (
          cell
        ) => {
          const headerIds =
            (
              cell.getAttribute(
                'headers'
              ) ??
              ''
            )
              .split(
                /\s+/
              )
              .map(
                (
                  value
                ) =>
                  value.trim()
              )
              .filter(
                Boolean
              );

          const brokenIds =
            headerIds.filter(
              (
                id
              ) => {
                const target =
                  root.ownerDocument
                    .getElementById(
                      id
                    );

                return (
                  !target ||
                  target.tagName !==
                    'TH'
                );
              }
            );

          if (
            brokenIds.length >
            0
          ) {
            addIssue(
              'Accessibility',
              'error',
              'Broken table header reference',
              (
                'A headers attribute points to missing or invalid TH ID(s): ' +
                brokenIds.join(
                  ', '
                ) +
                '.'
              ),
              cell
            );
          }
        }
      );
    }
  );


  /* -------------------------------------------------------
     FOOTNOTES
     ------------------------------------------------------- */


  const wetFootnoteSections =
    Array.from(
      root.querySelectorAll<
        HTMLElement
      >(
        'aside.wb-fnote'
      )
    );


  if (
    wetFootnoteSections.length >
    1
  ) {
    wetFootnoteSections
      .slice(
        1
      )
      .forEach(
        (
          aside
        ) => {
          addIssue(
            'Footnotes',
            'warning',
            'Multiple WET footnote sections found',
            'WET-BOEW footnotes should normally use one wb-fnote section at the end of the page content.',
            aside
          );
        }
      );
  }


  const footnoteReferences =
    Array.from(
      root.querySelectorAll<
        HTMLAnchorElement
      >(
        'a.fn-lnk[href^="#"]'
      )
    );


  footnoteReferences.forEach(
    (
      reference
    ) => {
      const targetId =
        getFragmentId(
          reference.getAttribute(
            'href'
          )
        );

      const sup =
        reference.closest(
          'sup'
        );

      if (
        !sup ||
        !sup.id ||
        !reference.querySelector(
          '.wb-inv'
        )
      ) {
        addIssue(
          'Footnotes',
          'error',
          'Footnote reference markup is incomplete',
          'A WET footnote reference should be inside a SUP with an ID and include a visually hidden wb-inv label.',
          reference
        );
      }


      if (
        !targetId ||
        !root.ownerDocument
          .getElementById(
            targetId
          )
      ) {
        addIssue(
          'Footnotes',
          'error',
          'Footnote reference points to a missing definition',
          (
            targetId
              ? 'No footnote definition exists with ID #' +
                targetId +
                '.'
              : 'The footnote reference does not have a valid fragment target.'
          ),
          reference
        );
      }
    }
  );


  const footnoteDefinitions =
    Array.from(
      root.querySelectorAll<
        HTMLElement
      >(
        'aside.wb-fnote dd[id]'
      )
    );


  footnoteDefinitions.forEach(
    (
      definition
    ) => {
      const hasReference =
        footnoteReferences.some(
          (
            reference
          ) =>
            getFragmentId(
              reference.getAttribute(
                'href'
              )
            ) ===
            definition.id
        );

      if (
        !hasReference
      ) {
        addIssue(
          'Footnotes',
          'warning',
          'Footnote definition is not referenced',
          (
            '#' +
            definition.id +
            ' has no matching fn-lnk reference in the document.'
          ),
          definition
        );
      }


      const returnLink =
        definition.querySelector<
          HTMLAnchorElement
        >(
          '.fn-rtn a[href^="#"]'
        );

      if (
        !returnLink
      ) {
        addIssue(
          'Footnotes',
          'error',
          'Footnote return link is missing',
          (
            '#' +
            definition.id +
            ' does not contain a WET fn-rtn return link.'
          ),
          definition
        );

        return;
      }


      const returnTargetId =
        getFragmentId(
          returnLink.getAttribute(
            'href'
          )
        );

      if (
        !returnTargetId ||
        !root.ownerDocument
          .getElementById(
            returnTargetId
          )
      ) {
        addIssue(
          'Footnotes',
          'error',
          'Footnote return link is broken',
          (
            returnTargetId
              ? 'The return link points to #' +
                returnTargetId +
                ', but that reference ID does not exist.'
              : 'The return link does not contain a valid fragment target.'
          ),
          returnLink
        );
      }
    }
  );


  const importedFootnoteReference =
    root.querySelector<
      HTMLAnchorElement
    >(
      'sup > a[id*="footnote-ref"][href*="#footnote-"]'
    );

  if (
    importedFootnoteReference
  ) {
    addIssue(
      'Footnotes',
      'review',
      'Imported Word footnotes are still present',
      'Word/Mammoth footnote markup was detected. Use the Footnote Manager if these should be converted to WET-BOEW.',
      importedFootnoteReference
    );
  }


  /* -------------------------------------------------------
     HTML QUALITY
     ------------------------------------------------------- */


  const idCounts =
    getIdCounts(
      root
    );


  idCounts.forEach(
    (
      count,
      id
    ) => {
      if (
        count <=
        1
      ) {
        return;
      }

      addIssue(
        'HTML',
        'error',
        'Duplicate HTML ID',
        (
          'The ID "' +
          id +
          '" appears ' +
          count +
          ' times. IDs must be unique.'
        ),
        root.ownerDocument
          .getElementById(
            id
          ) as
            HTMLElement |
            null
      );
    }
  );


  const wordSpecificElements =
    Array.from(
      root.querySelectorAll<
        HTMLElement
      >(
        '[class], [style]'
      )
    ).filter(
      (
        element
      ) => {
        const className =
          element.getAttribute(
            'class'
          ) ??
          '';

        const style =
          element.getAttribute(
            'style'
          ) ??
          '';

        return (
          /\bMso|\bWordSection/i.test(
            className
          ) ||
          /(?:^|;)\s*mso-/i.test(
            style
          )
        );
      }
    );


  if (
    wordSpecificElements.length >
    0
  ) {
    addIssue(
      'HTML',
      'review',
      'Word-specific markup remains',
      (
        wordSpecificElements.length +
        ' element(s) still contain Word-specific classes or mso-* styles. Review the HTML Cleanup report.'
      ),
      wordSpecificElements[
        0
      ]
    );
  }


  const emptyParagraphs =
    Array.from(
      root.querySelectorAll<
        HTMLParagraphElement
      >(
        'p'
      )
    ).filter(
      (
        paragraph
      ) =>
        !normalizeText(
          paragraph.textContent ??
          ''
        ) &&
        paragraph.children
          .length ===
          0
    );


  if (
    emptyParagraphs.length >
    0
  ) {
    addIssue(
      'HTML',
      'warning',
      'Empty paragraphs found',
      (
        emptyParagraphs.length +
        ' empty paragraph(s) were detected.'
      ),
      emptyParagraphs[
        0
      ]
    );
  }


  const formattedHeading =
    root.querySelector<
      HTMLElement
    >(
      'h1 strong, h2 strong, h3 strong, h4 strong, h5 strong, h6 strong'
    );

  if (
    formattedHeading
  ) {
    addIssue(
      'HTML',
      'review',
      'Strong formatting found inside a heading',
      'Heading elements are already emphasized semantically. Review unnecessary STRONG markup.',
      formattedHeading
    );
  }


  const errors =
    issues.filter(
      (
        issue
      ) =>
        issue.severity ===
        'error'
    ).length;

  const warnings =
    issues.filter(
      (
        issue
      ) =>
        issue.severity ===
        'warning'
    ).length;

  const reviews =
    issues.filter(
      (
        issue
      ) =>
        issue.severity ===
        'review'
    ).length;


  return {
    issues,

    metrics: {
      headings:
        headings.length,

      generatedSections:
        generatedSections.length,

      links:
        links.length,

      images:
        images.length,

      tables:
        tables.length,

      wetFootnotes:
        footnoteDefinitions.length,
    },

    errors,

    warnings,

    reviews,
  };
}


/* =========================================================
   REPORT RENDERING
   ========================================================= */


function getSeveritySymbol(
  severity:
    QaSeverity
): string {
  switch (
    severity
  ) {
    case 'error':
      return '✕';

    case 'warning':
      return '⚠';

    case 'review':
      return '!';
  }
}


function getOverallLabel(
  report:
    QaReport
): string {
  if (
    report.errors >
    0
  ) {
    return (
      report.errors +
      ' error(s) need attention'
    );
  }

  if (
    report.warnings >
      0 ||
    report.reviews >
      0
  ) {
    return (
      (
        report.warnings +
        report.reviews
      ) +
      ' item(s) need review'
    );
  }

  return (
    'Automated checks passed'
  );
}


function createMetricCard(
  label:
    string,
  value:
    number
): string {
  return (
    '<div class="document-qa-metric">' +
      '<span>' +
        escapeHtml(
          label
        ) +
      '</span>' +
      '<strong>' +
        value +
      '</strong>' +
    '</div>'
  );
}


function createIssueHtml(
  issue:
    QaIssue
): string {
  const disabled =
    !issue.target;

  return (
    '<button' +
      ' type="button"' +
      ' class="document-qa-issue document-qa-issue--' +
        issue.severity +
      '"' +
      ' data-qa-issue="' +
        issue.id +
      '"' +
      (
        disabled
          ? ' disabled'
          : ''
      ) +
    '>' +
      '<span class="document-qa-issue-symbol">' +
        getSeveritySymbol(
          issue.severity
        ) +
      '</span>' +
      '<span class="document-qa-issue-copy">' +
        '<strong>' +
          escapeHtml(
            issue.title
          ) +
        '</strong>' +
        '<span>' +
          escapeHtml(
            issue.detail
          ) +
        '</span>' +
        (
          disabled
            ? ''
            : '<small>Go to issue</small>'
        ) +
      '</span>' +
    '</button>'
  );
}


function createCategoryHtml(
  report:
    QaReport,
  category:
    QaCategory
): string {
  const issues =
    report.issues.filter(
      (
        issue
      ) =>
        issue.category ===
        category
    );

  const content =
    issues.length >
    0
      ? issues
          .map(
            createIssueHtml
          )
          .join(
            ''
          )
      : (
        '<div class="document-qa-pass">' +
          '✓ No issues detected by the current automated ' +
          escapeHtml(
            category.toLowerCase()
          ) +
          ' checks.' +
        '</div>'
      );

  return (
    '<section class="document-qa-section">' +
      '<div class="document-qa-section-heading">' +
        '<h2>' +
          escapeHtml(
            category
          ) +
        '</h2>' +
        '<span>' +
          issues.length +
          (
            issues.length ===
            1
              ? ' issue'
              : ' issues'
          ) +
        '</span>' +
      '</div>' +
      '<div class="document-qa-issues">' +
        content +
      '</div>' +
    '</section>'
  );
}


function createReportHtml(
  report:
    QaReport
): string {
  const statusClass =
    report.errors >
    0
      ? 'error'
      : (
          report.warnings >
            0 ||
          report.reviews >
            0
            ? 'review'
            : 'pass'
        );

  return (
    '<div class="document-qa-summary">' +
      '<div>' +
        '<div class="document-qa-eyebrow">Pre-publish document check</div>' +
        '<h2>' +
          escapeHtml(
            getOverallLabel(
              report
            )
          ) +
        '</h2>' +
        '<p>This report is advisory. Automated checks cannot prove that a page is fully accessible or publication-ready.</p>' +
      '</div>' +
      '<span class="document-qa-badge document-qa-badge--' +
        statusClass +
      '">' +
        (
          report.errors >
          0
            ? 'Needs attention'
            : (
                report.warnings >
                  0 ||
                report.reviews >
                  0
                  ? 'Review'
                  : 'Checks passed'
              )
        ) +
      '</span>' +
    '</div>' +

    '<div class="document-qa-counts">' +
      '<div><strong>' +
        report.errors +
      '</strong><span>Errors</span></div>' +
      '<div><strong>' +
        report.warnings +
      '</strong><span>Warnings</span></div>' +
      '<div><strong>' +
        report.reviews +
      '</strong><span>Review items</span></div>' +
    '</div>' +

    '<div class="document-qa-metrics">' +
      createMetricCard(
        'Headings',
        report.metrics.headings
      ) +
      createMetricCard(
        'Generated sections',
        report.metrics
          .generatedSections
      ) +
      createMetricCard(
        'Links',
        report.metrics.links
      ) +
      createMetricCard(
        'Images',
        report.metrics.images
      ) +
      createMetricCard(
        'Tables',
        report.metrics.tables
      ) +
      createMetricCard(
        'WET footnotes',
        report.metrics.wetFootnotes
      ) +
    '</div>' +

    CATEGORIES
      .map(
        (
          category
        ) =>
          createCategoryHtml(
            report,
            category
          )
      )
      .join(
        ''
      )
  );
}


/* =========================================================
   MODAL
   ========================================================= */


function goToIssue(
  editor:
    Editor,
  issue:
    QaIssue,
  close:
    () => void
): void {
  const target =
    issue.target;

  if (
    !target ||
    !target.isConnected
  ) {
    return;
  }

  close();

  editor.focus();

  editor.selection.select(
    target
  );

  editor.dom.scrollIntoView(
    target
  );

  editor.nodeChanged();
}


function openDocumentQa(
  editor:
    Editor
): void {
  if (
    activeDocumentQaClose
  ) {
    activeDocumentQaClose();
  }


  const report =
    analyzeDocument(
      editor
    );


  const backdrop =
    document.createElement(
      'div'
    );

  backdrop.className =
    'document-qa-backdrop';


  const modal =
    document.createElement(
      'div'
    );

  modal.className =
    'document-qa-modal';

  modal.setAttribute(
    'role',
    'dialog'
  );

  modal.setAttribute(
    'aria-modal',
    'true'
  );

  modal.setAttribute(
    'aria-labelledby',
    'document-qa-title'
  );


  const header =
    document.createElement(
      'div'
    );

  header.className =
    'document-qa-header';

  header.innerHTML =
    '<div>' +
      '<h1 id="document-qa-title">Document QA</h1>' +
      '<p>Review structure, links, accessibility indicators, footnotes, and HTML quality before publishing.</p>' +
    '</div>';


  const closeButton =
    document.createElement(
      'button'
    );

  closeButton.type =
    'button';

  closeButton.className =
    'document-qa-close';

  closeButton.setAttribute(
    'aria-label',
    'Close Document QA'
  );

  closeButton.textContent =
    '×';

  header.appendChild(
    closeButton
  );


  const content =
    document.createElement(
      'div'
    );

  content.className =
    'document-qa-content';

  content.innerHTML =
    createReportHtml(
      report
    );


  const footer =
    document.createElement(
      'div'
    );

  footer.className =
    'document-qa-footer';


  const rerunButton =
    document.createElement(
      'button'
    );

  rerunButton.type =
    'button';

  rerunButton.textContent =
    'Re-run checks';


  const doneButton =
    document.createElement(
      'button'
    );

  doneButton.type =
    'button';

  doneButton.className =
    'document-qa-primary';

  doneButton.textContent =
    'Close';


  footer.append(
    rerunButton,
    doneButton
  );


  modal.append(
    header,
    content,
    footer
  );

  backdrop.appendChild(
    modal
  );


  const previousOverflow =
    document.body.style
      .overflow;


  const onKeyDown =
    (
      event:
        KeyboardEvent
    ): void => {
      if (
        event.key ===
        'Escape'
      ) {
        close();
      }
    };


  const close =
    (): void => {
      document.removeEventListener(
        'keydown',
        onKeyDown,
        true
      );

      document.body.style
        .overflow =
        previousOverflow;

      backdrop.remove();

      if (
        activeDocumentQaClose ===
        close
      ) {
        activeDocumentQaClose =
          null;
      }

      editor.focus();
    };


  activeDocumentQaClose =
    close;


  closeButton.addEventListener(
    'click',
    close
  );

  doneButton.addEventListener(
    'click',
    close
  );


  rerunButton.addEventListener(
    'click',
    () => {
      close();

      openDocumentQa(
        editor
      );
    }
  );


  content.addEventListener(
    'click',
    (
      event
    ) => {
      const target =
        event.target;

      if (
        !(
          target instanceof
          Element
        )
      ) {
        return;
      }

      const button =
        target.closest<
          HTMLButtonElement
        >(
          '[data-qa-issue]'
        );

      if (
        !button
      ) {
        return;
      }

      const issueId =
        button.dataset
          .qaIssue;

      const issue =
        report.issues.find(
          (
            candidate
          ) =>
            candidate.id ===
            issueId
        );

      if (
        !issue
      ) {
        return;
      }

      goToIssue(
        editor,
        issue,
        close
      );
    }
  );


  backdrop.addEventListener(
    'click',
    (
      event
    ) => {
      if (
        event.target ===
        backdrop
      ) {
        close();
      }
    }
  );


  document.addEventListener(
    'keydown',
    onKeyDown,
    true
  );


  document.body.style
    .overflow =
    'hidden';

  document.body.appendChild(
    backdrop
  );

  closeButton.focus();
}


/* =========================================================
   TINYMCE BUTTON
   ========================================================= */


export function registerDocumentQaButton(
  editor:
    Editor
): void {
  editor.ui.registry.addButton(
    'documentqa',
    {
      text:
        'Document QA',

      tooltip:
        'Run a pre-publish document check',

      onAction:
        () => {
          openDocumentQa(
            editor
          );
        },
    }
  );
}
