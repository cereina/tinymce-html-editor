import type {
  Editor,
} from 'tinymce';


export type FootnoteLanguage =
  | 'en'
  | 'fr';


export interface FootnoteAnalysis {
  importedReferences: number;
  importedDefinitions: number;
  wetSections: number;
  wetReferences: number;
  wetDefinitions: number;
  invalidWetReferences: number;
  brokenReferenceTargets: string[];
  brokenReturnLinks: string[];
  missingReturnLinks: string[];
  orphanDefinitions: string[];
  duplicateIds: string[];
  warnings: string[];
}


export interface FootnoteConversionResult {
  html: string;
  converted: boolean;
  convertedFootnotes: number;
  convertedReferences: number;
  warnings: string[];
}


export interface ImportedFootnoteReviewResult {
  html: string;
  detectedFootnotes: number;
  converted: boolean;
  convertedFootnotes: number;
  convertedReferences: number;
  warnings: string[];
}


interface ImportedFootnoteGroup {
  targetId: string;
  references: HTMLAnchorElement[];
  definition: HTMLLIElement | null;
}


interface FootnoteLabels {
  sectionTitle: string;
  referencePrefix: string;
  definitionPrefix: string;
  returnPrefix: string;
  returnMultiPrefix: string;
  returnMultiWord: string;
  returnSuffix: string;
}


const LABELS: Record<
  FootnoteLanguage,
  FootnoteLabels
> = {
  en: {
    sectionTitle:
      'Footnotes',

    referencePrefix:
      'Footnote ',

    definitionPrefix:
      'Footnote ',

    returnPrefix:
      'Return to footnote ',

    returnMultiPrefix:
      'Return to ',

    returnMultiWord:
      'first',

    returnSuffix:
      ' referrer',
  },

  fr: {
    sectionTitle:
      'Notes de bas de page',

    referencePrefix:
      'Note de bas de page ',

    definitionPrefix:
      'Note de bas de page ',

    returnPrefix:
      'Retour à la référence de la note de bas de page ',

    returnMultiPrefix:
      'Retour à la ',

    returnMultiWord:
      'première',

    returnSuffix:
      '',
  },
};


/* =========================================================
   BASIC UTILITIES
   ========================================================= */


function parseHtml(
  html: string
): Document {
  return new DOMParser()
    .parseFromString(
      html,
      'text/html'
    );
}


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


function getFragmentId(
  href: string | null
): string {
  if (
    !href ||
    !href.startsWith(
      '#'
    )
  ) {
    return '';
  }

  return href.substring(
    1
  );
}


function isImportedFootnoteReference(
  anchor: HTMLAnchorElement
): boolean {
  const targetId =
    getFragmentId(
      anchor.getAttribute(
        'href'
      )
    );

  return (
    /footnote-ref-[^/]+$/i.test(
      anchor.id
    ) &&
    /footnote-[^/]+$/i.test(
      targetId
    ) &&
    !anchor.classList.contains(
      'fn-lnk'
    )
  );
}


function isImportedFootnoteDefinition(
  element: Element
): element is HTMLLIElement {
  return (
    element.tagName ===
      'LI' &&
    /footnote-[^/]+$/i.test(
      element.id
    ) &&
    !/footnote-ref-/i.test(
      element.id
    )
  );
}


function getImportedFootnoteReferences(
  document:
    Document
): HTMLAnchorElement[] {
  return Array.from(
    document.querySelectorAll<
      HTMLAnchorElement
    >(
      'sup > a[id][href^="#"]'
    )
  ).filter(
    isImportedFootnoteReference
  );
}


function getImportedFootnoteDefinitions(
  document:
    Document
): HTMLLIElement[] {
  return Array.from(
    document.querySelectorAll<
      HTMLLIElement
    >(
      'li[id]'
    )
  ).filter(
    isImportedFootnoteDefinition
  );
}


function buildImportedGroups(
  document:
    Document
): ImportedFootnoteGroup[] {
  const references =
    getImportedFootnoteReferences(
      document
    );

  const byTarget =
    new Map<
      string,
      ImportedFootnoteGroup
    >();

  references.forEach(
    (
      reference
    ) => {
      const targetId =
        getFragmentId(
          reference.getAttribute(
            'href'
          )
        );

      if (
        !targetId
      ) {
        return;
      }

      let group =
        byTarget.get(
          targetId
        );

      if (
        !group
      ) {
        const target =
          document.getElementById(
            targetId
          );

        group = {
          targetId,

          references:
            [],

          definition:
            target &&
            isImportedFootnoteDefinition(
              target
            )
              ? target
              : null,
        };

        byTarget.set(
          targetId,
          group
        );
      }

      group.references.push(
        reference
      );
    }
  );

  return Array.from(
    byTarget.values()
  );
}


function getDuplicateIds(
  document:
    Document
): string[] {
  const counts =
    new Map<
      string,
      number
    >();

  Array.from(
    document.querySelectorAll<
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

  return Array.from(
    counts.entries()
  )
    .filter(
      (
        [, count]
      ) =>
        count >
        1
    )
    .map(
      (
        [id]
      ) =>
        id
    );
}


/* =========================================================
   ANALYSIS
   ========================================================= */


export function analyzeFootnotes(
  html: string
): FootnoteAnalysis {
  const document =
    parseHtml(
      html
    );

  const importedReferences =
    getImportedFootnoteReferences(
      document
    );

  const importedDefinitions =
    getImportedFootnoteDefinitions(
      document
    );

  const wetSections =
    Array.from(
      document.querySelectorAll<
        HTMLElement
      >(
        'aside.wb-fnote'
      )
    );

  const wetReferences =
    Array.from(
      document.querySelectorAll<
        HTMLAnchorElement
      >(
        'a.fn-lnk[href^="#"]'
      )
    );

  const wetDefinitions =
    Array.from(
      document.querySelectorAll<
        HTMLElement
      >(
        'aside.wb-fnote dd[id]'
      )
    );

  const brokenReferenceTargets:
    string[] =
    [];

  const brokenReturnLinks:
    string[] =
    [];

  const missingReturnLinks:
    string[] =
    [];

  const orphanDefinitions:
    string[] =
    [];

  let invalidWetReferences =
    0;


  wetReferences.forEach(
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
        invalidWetReferences++;
      }

      if (
        !targetId ||
        !document.getElementById(
          targetId
        )
      ) {
        brokenReferenceTargets.push(
          targetId ||
          '(missing href target)'
        );
      }
    }
  );


  wetDefinitions.forEach(
    (
      definition
    ) => {
      const matchingReference =
        wetReferences.some(
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
        !matchingReference
      ) {
        orphanDefinitions.push(
          definition.id
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
        missingReturnLinks.push(
          definition.id
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
        !document.getElementById(
          returnTargetId
        )
      ) {
        brokenReturnLinks.push(
          returnTargetId ||
          definition.id
        );
      }
    }
  );


  const warnings:
    string[] =
    [];

  if (
    wetSections.length >
    1
  ) {
    warnings.push(
      'More than one WET footnotes section was found. WET-BOEW recommends one footnotes section at the end of the page content.'
    );
  }

  if (
    invalidWetReferences >
    0
  ) {
    warnings.push(
      invalidWetReferences +
      ' WET footnote reference(s) do not have the expected SUP ID and visually-hidden label structure.'
    );
  }

  if (
    brokenReferenceTargets.length >
    0
  ) {
    warnings.push(
      brokenReferenceTargets.length +
      ' WET footnote reference(s) point to a missing definition.'
    );
  }

  if (
    brokenReturnLinks.length >
    0
  ) {
    warnings.push(
      brokenReturnLinks.length +
      ' WET footnote return link(s) point to a missing reference.'
    );
  }

  if (
    missingReturnLinks.length >
    0
  ) {
    warnings.push(
      missingReturnLinks.length +
      ' WET footnote definition(s) are missing a return link.'
    );
  }

  if (
    orphanDefinitions.length >
    0
  ) {
    warnings.push(
      orphanDefinitions.length +
      ' WET footnote definition(s) are not referenced from the page content.'
    );
  }

  const duplicateIds =
    getDuplicateIds(
      document
    );

  if (
    duplicateIds.length >
    0
  ) {
    warnings.push(
      duplicateIds.length +
      ' duplicate HTML ID(s) were found in the document.'
    );
  }

  const importedGroups =
    buildImportedGroups(
      document
    );

  const missingImportedDefinitions =
    importedGroups.filter(
      (
        group
      ) =>
        !group.definition
    );

  if (
    missingImportedDefinitions.length >
    0
  ) {
    warnings.push(
      missingImportedDefinitions.length +
      ' imported Word footnote reference group(s) do not have a matching definition.'
    );
  }

  return {
    importedReferences:
      importedReferences.length,

    importedDefinitions:
      importedDefinitions.length,

    wetSections:
      wetSections.length,

    wetReferences:
      wetReferences.length,

    wetDefinitions:
      wetDefinitions.length,

    invalidWetReferences,

    brokenReferenceTargets,

    brokenReturnLinks,

    missingReturnLinks,

    orphanDefinitions,

    duplicateIds,

    warnings,
  };
}


/* =========================================================
   WET MARKUP BUILDERS
   ========================================================= */


function createReference(
  document:
    Document,
  footnoteNumber:
    number,
  referenceNumber:
    number,
  totalReferences:
    number,
  language:
    FootnoteLanguage
): HTMLElement {
  const labels =
    LABELS[
      language
    ];

  const referenceId =
    totalReferences >
    1
      ? 'fn' +
        footnoteNumber +
        '-' +
        referenceNumber +
        '-rf'
      : 'fn' +
        footnoteNumber +
        '-rf';

  const sup =
    document.createElement(
      'sup'
    );

  sup.id =
    referenceId;

  const link =
    document.createElement(
      'a'
    );

  link.className =
    'fn-lnk';

  link.setAttribute(
    'href',
    '#fn' +
      footnoteNumber
  );

  const hidden =
    document.createElement(
      'span'
    );

  hidden.className =
    'wb-inv';

  hidden.textContent =
    labels.referencePrefix;

  link.append(
    hidden,
    document.createTextNode(
      String(
        footnoteNumber
      )
    )
  );

  sup.appendChild(
    link
  );

  return sup;
}


function removeMammothReturnLinks(
  definition:
    HTMLLIElement,
  sourceReferenceIds:
    Set<string>
): void {
  Array.from(
    definition.querySelectorAll<
      HTMLAnchorElement
    >(
      'a[href^="#"]'
    )
  ).forEach(
    (
      link
    ) => {
      const targetId =
        getFragmentId(
          link.getAttribute(
            'href'
          )
        );

      const text =
        (
          link.textContent ??
          ''
        ).trim();

      if (
        sourceReferenceIds.has(
          targetId
        ) &&
        (
          text ===
            '↑' ||
          text ===
            '↩' ||
          text ===
            '↵'
        )
      ) {
        link.remove();
      }
    }
  );
}


function removeEmptyParagraphs(
  root:
    HTMLElement
): void {
  Array.from(
    root.querySelectorAll<
      HTMLParagraphElement
    >(
      'p'
    )
  )
    .reverse()
    .forEach(
      (
        paragraph
      ) => {
        const text =
          (
            paragraph.textContent ??
            ''
          )
            .replace(
              /\u00a0/g,
              ' '
            )
            .trim();

        if (
          !text &&
          paragraph.children
            .length ===
            0
        ) {
          paragraph.remove();
        }
      }
    );
}


function appendReturnLink(
  document:
    Document,
  definition:
    HTMLElement,
  footnoteNumber:
    number,
  totalReferences:
    number,
  language:
    FootnoteLanguage
): void {
  const labels =
    LABELS[
      language
    ];

  const returnParagraph =
    document.createElement(
      'p'
    );

  returnParagraph.className =
    'fn-rtn';

  const returnLink =
    document.createElement(
      'a'
    );

  returnLink.setAttribute(
    'href',
    totalReferences >
      1
      ? '#fn' +
        footnoteNumber +
        '-1-rf'
      : '#fn' +
        footnoteNumber +
        '-rf'
  );

  const prefix =
    document.createElement(
      'span'
    );

  prefix.className =
    'wb-inv';

  if (
    totalReferences >
    1
  ) {
    prefix.appendChild(
      document.createTextNode(
        labels.returnMultiPrefix
      )
    );

    const first =
      document.createElement(
        'span'
      );

    first.textContent =
      labels.returnMultiWord;

    prefix.appendChild(
      first
    );

    if (
      language ===
      'en'
    ) {
      prefix.appendChild(
        document.createTextNode(
          ' footnote '
        )
      );
    } else {
      prefix.appendChild(
        document.createTextNode(
          ' référence de la note de bas de page '
        )
      );
    }
  } else {
    prefix.textContent =
      labels.returnPrefix;
  }

  returnLink.appendChild(
    prefix
  );

  returnLink.appendChild(
    document.createTextNode(
      String(
        footnoteNumber
      )
    )
  );

  if (
    labels.returnSuffix
  ) {
    const suffix =
      document.createElement(
        'span'
      );

    suffix.className =
      'wb-inv';

    suffix.textContent =
      labels.returnSuffix;

    returnLink.appendChild(
      suffix
    );
  }

  returnParagraph.appendChild(
    returnLink
  );

  definition.appendChild(
    returnParagraph
  );
}


function createDefinition(
  document:
    Document,
  source:
    HTMLLIElement,
  sourceReferenceIds:
    Set<string>,
  footnoteNumber:
    number,
  totalReferences:
    number,
  language:
    FootnoteLanguage
): {
  term: HTMLElement;
  definition: HTMLElement;
} {
  const labels =
    LABELS[
      language
    ];

  const sourceClone =
    source.cloneNode(
      true
    ) as HTMLLIElement;

  sourceClone.removeAttribute(
    'id'
  );

  removeMammothReturnLinks(
    sourceClone,
    sourceReferenceIds
  );

  removeEmptyParagraphs(
    sourceClone
  );

  const term =
    document.createElement(
      'dt'
    );

  term.textContent =
    labels.definitionPrefix +
    footnoteNumber;

  const definition =
    document.createElement(
      'dd'
    );

  definition.id =
    'fn' +
    footnoteNumber;

  Array.from(
    sourceClone.childNodes
  ).forEach(
    (
      node
    ) => {
      definition.appendChild(
        node
      );
    }
  );

  appendReturnLink(
    document,
    definition,
    footnoteNumber,
    totalReferences,
    language
  );

  return {
    term,
    definition,
  };
}


/* =========================================================
   CONVERSION
   ========================================================= */


export function convertImportedFootnotesToWet(
  html: string,
  language:
    FootnoteLanguage =
    'en'
): FootnoteConversionResult {
  const document =
    parseHtml(
      html
    );

  const groups =
    buildImportedGroups(
      document
    );

  const warnings:
    string[] =
    [];

  if (
    groups.length ===
    0
  ) {
    return {
      html,

      converted:
        false,

      convertedFootnotes:
        0,

      convertedReferences:
        0,

      warnings,
    };
  }


  if (
    document.querySelector(
      'aside.wb-fnote'
    )
  ) {
    warnings.push(
      'An existing WET-BOEW footnotes section is already present. Automatic conversion was not applied so that the two footnote systems are not merged unexpectedly.'
    );

    return {
      html,

      converted:
        false,

      convertedFootnotes:
        0,

      convertedReferences:
        0,

      warnings,
    };
  }


  const missingDefinitions =
    groups.filter(
      (
        group
      ) =>
        !group.definition
    );

  if (
    missingDefinitions.length >
    0
  ) {
    warnings.push(
      'Automatic conversion was not applied because ' +
      missingDefinitions.length +
      ' imported footnote reference group(s) do not have a matching definition.'
    );

    return {
      html,

      converted:
        false,

      convertedFootnotes:
        0,

      convertedReferences:
        0,

      warnings,
    };
  }


  const sourceIds =
    new Set<string>();

  groups.forEach(
    (
      group
    ) => {
      sourceIds.add(
        group.targetId
      );

      group.references.forEach(
        (
          reference
        ) => {
          if (
            reference.id
          ) {
            sourceIds.add(
              reference.id
            );
          }
        }
      );
    }
  );


  const existingIds =
    new Set<string>();

  Array.from(
    document.querySelectorAll<
      HTMLElement
    >(
      '[id]'
    )
  ).forEach(
    (
      element
    ) => {
      if (
        !sourceIds.has(
          element.id
        )
      ) {
        existingIds.add(
          element.id
        );
      }
    }
  );


  const requiredIds =
    new Set<string>([
      'fn',
    ]);

  groups.forEach(
    (
      group,
      index
    ) => {
      const number =
        index +
        1;

      requiredIds.add(
        'fn' +
        number
      );

      if (
        group.references.length >
        1
      ) {
        group.references.forEach(
          (
            _reference,
            referenceIndex
          ) => {
            requiredIds.add(
              'fn' +
              number +
              '-' +
              (
                referenceIndex +
                1
              ) +
              '-rf'
            );
          }
        );
      } else {
        requiredIds.add(
          'fn' +
          number +
          '-rf'
        );
      }
    }
  );


  const collisions =
    Array.from(
      requiredIds
    ).filter(
      (
        id
      ) =>
        existingIds.has(
          id
        )
    );

  if (
    collisions.length >
    0
  ) {
    warnings.push(
      'Automatic conversion was not applied because the required WET footnote ID(s) already exist: ' +
      collisions.join(
        ', '
      ) +
      '.'
    );

    return {
      html,

      converted:
        false,

      convertedFootnotes:
        0,

      convertedReferences:
        0,

      warnings,
    };
  }


  const labels =
    LABELS[
      language
    ];

  const aside =
    document.createElement(
      'aside'
    );

  aside.className =
    'wb-fnote';

  aside.setAttribute(
    'role',
    'note'
  );

  const heading =
    document.createElement(
      'h2'
    );

  heading.id =
    'fn';

  heading.textContent =
    labels.sectionTitle;

  const list =
    document.createElement(
      'dl'
    );

  aside.append(
    heading,
    list
  );


  let convertedReferences =
    0;

  const sourceContainers =
    new Set<
      HTMLOListElement
    >();


  groups.forEach(
    (
      group,
      index
    ) => {
      const footnoteNumber =
        index +
        1;

      const definition =
        group.definition!;

      const sourceReferenceIds =
        new Set<string>(
          group.references
            .map(
              (
                reference
              ) =>
                reference.id
            )
            .filter(
              Boolean
            )
        );

      const wetDefinition =
        createDefinition(
          document,
          definition,
          sourceReferenceIds,
          footnoteNumber,
          group.references.length,
          language
        );

      list.append(
        wetDefinition.term,
        wetDefinition.definition
      );


      group.references.forEach(
        (
          reference,
          referenceIndex
        ) => {
          const oldSup =
            reference.closest(
              'sup'
            );

          if (
            !oldSup
          ) {
            return;
          }

          const wetReference =
            createReference(
              document,
              footnoteNumber,
              referenceIndex +
                1,
              group.references.length,
              language
            );

          oldSup.replaceWith(
            wetReference
          );

          convertedReferences++;
        }
      );


      const matchingDefinitions =
        Array.from(
          document.querySelectorAll<
            HTMLLIElement
          >(
            'li[id]'
          )
        ).filter(
          (
            item
          ) =>
            item.id ===
            group.targetId
        );


      matchingDefinitions.forEach(
        (
          item
        ) => {
          const parentList =
            item.parentElement;

          if (
            parentList &&
            parentList.tagName ===
              'OL'
          ) {
            sourceContainers.add(
              parentList as
                HTMLOListElement
            );
          }

          item.remove();
        }
      );
    }
  );


  sourceContainers.forEach(
    (
      container
    ) => {
      if (
        container.children
          .length ===
        0
      ) {
        container.remove();
      }
    }
  );


  document.body.appendChild(
    aside
  );


  return {
    html:
      document.body.innerHTML,

    converted:
      true,

    convertedFootnotes:
      groups.length,

    convertedReferences,

    warnings,
  };
}


/* =========================================================
   IMPORT REVIEW
   ========================================================= */


function createImportReviewHtml(
  footnotes:
    number,
  references:
    number
): string {
  return (
    '<div>' +
      '<p><strong>' +
        footnotes +
        ' Word footnote(s) detected.</strong></p>' +
      '<p>The imported Word/Mammoth footnote markup can be converted to the WET-BOEW <code>wb-fnote</code> pattern before it is placed in the editor.</p>' +
      '<table>' +
        '<tr><td>Footnote definitions</td><td style="padding-left:20px"><strong>' +
          footnotes +
        '</strong></td></tr>' +
        '<tr><td>Footnote references</td><td style="padding-left:20px"><strong>' +
          references +
        '</strong></td></tr>' +
      '</table>' +
      '<p style="margin-top:14px">Choose the language used for the accessible footnote labels.</p>' +
    '</div>'
  );
}


export function reviewImportedFootnotes(
  editor: Editor,
  html: string
): Promise<
  ImportedFootnoteReviewResult
> {
  const analysis =
    analyzeFootnotes(
      html
    );

  if (
    analysis.importedReferences ===
    0
  ) {
    return Promise.resolve({
      html,

      detectedFootnotes:
        0,

      converted:
        false,

      convertedFootnotes:
        0,

      convertedReferences:
        0,

      warnings:
        [],
    });
  }


  const groups =
    buildImportedGroups(
      parseHtml(
        html
      )
    );

  return new Promise(
    (
      resolve
    ) => {
      let settled =
        false;

      const finish =
        (
          result:
            ImportedFootnoteReviewResult
        ): void => {
          if (
            settled
          ) {
            return;
          }

          settled =
            true;

          resolve(
            result
          );
        };


      editor.windowManager.open({
        title:
          'Word Footnotes Detected',

        size:
          'medium',

        body: {
          type:
            'panel',

          items: [
            {
              type:
                'htmlpanel',

              html:
                createImportReviewHtml(
                  groups.length,
                  analysis.importedReferences
                ),
            },

            {
              type:
                'selectbox',

              name:
                'language',

              label:
                'Footnote language',

              items: [
                {
                  text:
                    'English',

                  value:
                    'en',
                },

                {
                  text:
                    'Français',

                  value:
                    'fr',
                },
              ],
            },
          ],
        },

        initialData: {
          language:
            'en',
        },

        buttons: [
          {
            type:
              'cancel',

            text:
              'Keep imported version',
          },

          {
            type:
              'submit',

            text:
              'Convert to WET-BOEW',

            buttonType:
              'primary',
          },
        ],

        onSubmit:
          (
            api
          ) => {
            const data =
              api.getData();

            const language:
              FootnoteLanguage =
              data.language ===
              'fr'
                ? 'fr'
                : 'en';

            const conversion =
              convertImportedFootnotesToWet(
                html,
                language
              );

            finish({
              html:
                conversion.html,

              detectedFootnotes:
                groups.length,

              converted:
                conversion.converted,

              convertedFootnotes:
                conversion
                  .convertedFootnotes,

              convertedReferences:
                conversion
                  .convertedReferences,

              warnings:
                conversion.warnings,
            });

            api.close();
          },

        onCancel:
          () => {
            finish({
              html,

              detectedFootnotes:
                groups.length,

              converted:
                false,

              convertedFootnotes:
                0,

              convertedReferences:
                0,

              warnings:
                [],
            });
          },

        onClose:
          () => {
            finish({
              html,

              detectedFootnotes:
                groups.length,

              converted:
                false,

              convertedFootnotes:
                0,

              convertedReferences:
                0,

              warnings:
                [],
            });
          },
      });
    }
  );
}


/* =========================================================
   MANAGER REPORT
   ========================================================= */


function createManagerReport(
  analysis:
    FootnoteAnalysis
): string {
  const warningsHtml =
    analysis.warnings.length >
    0
      ? (
        '<div style="margin-top:16px;padding:12px;background:#fff8e5;border-radius:6px">' +
          '<strong>Review recommended</strong>' +
          '<ul>' +
            analysis.warnings
              .map(
                (
                  warning
                ) =>
                  '<li>' +
                    escapeHtml(
                      warning
                    ) +
                  '</li>'
              )
              .join(
                ''
              ) +
          '</ul>' +
        '</div>'
      )
      : (
        '<div style="margin-top:16px;padding:12px;background:#eef8f0;border-radius:6px">' +
          'No footnote relationship problems were detected by the current checks.' +
        '</div>'
      );

  return (
    '<div>' +
      '<h3 style="margin-top:0">Imported Word footnotes</h3>' +
      '<table>' +
        '<tr><td>References</td><td style="padding-left:20px"><strong>' +
          analysis.importedReferences +
        '</strong></td></tr>' +
        '<tr><td>Definitions</td><td style="padding-left:20px"><strong>' +
          analysis.importedDefinitions +
        '</strong></td></tr>' +
      '</table>' +

      '<h3>WET-BOEW footnotes</h3>' +
      '<table>' +
        '<tr><td>Footnote sections</td><td style="padding-left:20px"><strong>' +
          analysis.wetSections +
        '</strong></td></tr>' +
        '<tr><td>References</td><td style="padding-left:20px"><strong>' +
          analysis.wetReferences +
        '</strong></td></tr>' +
        '<tr><td>Definitions</td><td style="padding-left:20px"><strong>' +
          analysis.wetDefinitions +
        '</strong></td></tr>' +
        '<tr><td>Invalid reference markup</td><td style="padding-left:20px"><strong>' +
          analysis.invalidWetReferences +
        '</strong></td></tr>' +
        '<tr><td>Broken reference targets</td><td style="padding-left:20px"><strong>' +
          analysis.brokenReferenceTargets.length +
        '</strong></td></tr>' +
        '<tr><td>Broken return links</td><td style="padding-left:20px"><strong>' +
          analysis.brokenReturnLinks.length +
        '</strong></td></tr>' +
        '<tr><td>Missing return links</td><td style="padding-left:20px"><strong>' +
          analysis.missingReturnLinks.length +
        '</strong></td></tr>' +
        '<tr><td>Unreferenced definitions</td><td style="padding-left:20px"><strong>' +
          analysis.orphanDefinitions.length +
        '</strong></td></tr>' +
        '<tr><td>Duplicate IDs</td><td style="padding-left:20px"><strong>' +
          analysis.duplicateIds.length +
        '</strong></td></tr>' +
      '</table>' +

      warningsHtml +
    '</div>'
  );
}


function openFootnoteManager(
  editor:
    Editor
): void {
  const html =
    editor.getContent({
      format:
        'html',
    });

  const analysis =
    analyzeFootnotes(
      html
    );

  editor.windowManager.open({
    title:
      'Footnote Manager',

    size:
      'medium',

    body: {
      type:
        'panel',

      items: [
        {
          type:
            'htmlpanel',

          html:
            createManagerReport(
              analysis
            ),
        },
      ],
    },

    buttons: [
      {
        type:
          'cancel',

        text:
          'Close',
      },
    ],
  });
}


async function convertCurrentImportedFootnotes(
  editor:
    Editor
): Promise<void> {
  const html =
    editor.getContent({
      format:
        'html',
    });

  const analysis =
    analyzeFootnotes(
      html
    );

  if (
    analysis.importedReferences ===
    0
  ) {
    editor.notificationManager.open({
      text:
        'No imported Word footnotes were detected.',

      type:
        'info',

      timeout:
        3500,
    });

    return;
  }


  const review =
    await reviewImportedFootnotes(
      editor,
      html
    );

  if (
    !review.converted
  ) {
    if (
      review.warnings.length >
      0
    ) {
      editor.notificationManager.open({
        text:
          review.warnings[
            0
          ],

        type:
          'warning',

        timeout:
          7000,
      });
    }

    return;
  }


  editor.undoManager.transact(
    () => {
      editor.setContent(
        review.html
      );

      editor.nodeChanged();
    }
  );


  editor.notificationManager.open({
    text:
      review.convertedFootnotes +
      ' footnote(s) converted to WET-BOEW markup.',

    type:
      'success',

    timeout:
      4500,
  });
}


/* =========================================================
   TINYMCE MENU
   ========================================================= */


export function registerFootnoteManagerMenu(
  editor: Editor
): void {
  editor.ui.registry.addMenuButton(
    'footnotes',
    {
      text:
        'Footnotes',

      tooltip:
        'Analyze and convert footnotes',

      fetch:
        (
          callback
        ) => {
          callback([
            {
              type:
                'menuitem',

              text:
                'Open Footnote Manager...',

              onAction:
                () => {
                  openFootnoteManager(
                    editor
                  );
                },
            },

            {
              type:
                'menuitem',

              text:
                'Convert Imported Word Footnotes...',

              onAction:
                () => {
                  void convertCurrentImportedFootnotes(
                    editor
                  );
                },
            },
          ]);
        },
    }
  );
}
