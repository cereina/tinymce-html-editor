export interface CleanupStats {
  commentsRemoved: number;

  emptyElementsRemoved: number;
  emptyListItemsRemoved: number;
  emptyListsRemoved: number;

  spansUnwrapped: number;

  boldConverted: number;
  italicConverted: number;

  headingFormattingRemoved: number;
  duplicateFormattingRemoved: number;

  wordClassesRemoved: number;
  wordStylesRemoved: number;

  bookmarksMovedToHeadings: number;
  unusedWordBookmarksRemoved: number;

  bookmarkAliasesRemoved: number;
  bookmarkReferencesRewritten: number;

  tocEntriesFound: number;
  tocTargetsFound: number;
  tocLabelsSynchronized: number;
  tocPageNumbersRemoved: number;
  brokenTocLinks: number;

  tocTitleConverted: number;
  tocParagraphsConvertedToListItems: number;
  tocNestedListsCreated: number;

  referencedIdsProtected: number;

  footnoteReferences: number;
  footnoteDefinitions: number;

  internalLinks: number;
  brokenInternalLinks: number;

  headings: number;
}


export interface CleanupResult {
  originalHtml: string;

  cleanedHtml: string;

  stats: CleanupStats;

  warnings: string[];

  hasChanges: boolean;
}


const WORD_BOOKMARK_PATTERN =
  /^_(Toc|Ref|GoBack|Hlk|Bookmark)/i;


const NOTE_ID_PATTERN =
  /(footnote|endnote|_ftn|_edn)/i;


const EMPTY_REMOVABLE_ELEMENTS = [
  'p',
  'span',
  'strong',
  'em',
  'b',
  'i',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
];


function normalizeTarget(
  href: string | null
): string | null {
  if (
    !href ||
    !href.startsWith('#')
  ) {
    return null;
  }


  const rawTarget =
    href.slice(1);


  if (!rawTarget) {
    return null;
  }


  try {
    return decodeURIComponent(
      rawTarget
    );
  } catch {
    return rawTarget;
  }
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


function getReferencedIds(
  root: ParentNode
): Set<string> {
  const ids =
    new Set<string>();


  root
    .querySelectorAll<HTMLAnchorElement>(
      'a[href^="#"]'
    )
    .forEach(
      (link) => {
        const target =
          normalizeTarget(
            link.getAttribute(
              'href'
            )
          );


        if (target) {
          ids.add(
            target
          );
        }
      }
    );


  return ids;
}


function getAllIds(
  root: ParentNode
): Set<string> {
  const ids =
    new Set<string>();


  root
    .querySelectorAll<HTMLElement>(
      '[id]'
    )
    .forEach(
      (element) => {
        if (
          element.id
        ) {
          ids.add(
            element.id
          );
        }
      }
    );


  return ids;
}


function isProtectedElement(
  element: Element,
  referencedIds: Set<string>
): boolean {
  const id =
    element.getAttribute(
      'id'
    );


  if (!id) {
    return false;
  }


  return (
    referencedIds.has(
      id
    ) ||
    NOTE_ID_PATTERN.test(
      id
    )
  );
}


function hasMeaningfulContent(
  element: Element
): boolean {
  const text =
    normalizeText(
      element.textContent ??
      ''
    );


  if (
    text.length > 0
  ) {
    return true;
  }


  return Boolean(
    element.querySelector(
      [
        'img',
        'table',
        'iframe',
        'video',
        'audio',
        'svg',
        'canvas',
        'hr',
        'input',
        'textarea',
        'select',
        'a[id]',
      ].join(',')
    )
  );
}


function unwrapElement(
  element: Element
): void {
  const parent =
    element.parentNode;


  if (!parent) {
    return;
  }


  while (
    element.firstChild
  ) {
    parent.insertBefore(
      element.firstChild,
      element
    );
  }


  element.remove();
}


function replaceTag(
  element: Element,
  tagName: string
): HTMLElement {
  const replacement =
    element.ownerDocument
      .createElement(
        tagName
      );


  Array
    .from(
      element.attributes
    )
    .forEach(
      (attribute) => {
        replacement.setAttribute(
          attribute.name,
          attribute.value
        );
      }
    );


  while (
    element.firstChild
  ) {
    replacement.appendChild(
      element.firstChild
    );
  }


  element.replaceWith(
    replacement
  );


  return replacement;
}


function rewriteInternalReferences(
  document: Document,
  oldId: string,
  newId: string
): number {
  let count =
    0;


  document
    .querySelectorAll<HTMLAnchorElement>(
      'a[href^="#"]'
    )
    .forEach(
      (link) => {
        const target =
          normalizeTarget(
            link.getAttribute(
              'href'
            )
          );


        if (
          target !==
          oldId
        ) {
          return;
        }


        link.setAttribute(
          'href',
          `#${newId}`
        );


        count++;
      }
    );


  return count;
}


function removeComments(
  document: Document,
  stats: CleanupStats
): void {
  const walker =
    document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_COMMENT
    );


  const comments:
    Comment[] = [];


  let node:
    Node | null;


  while (
    (
      node =
        walker.nextNode()
    )
  ) {
    comments.push(
      node as Comment
    );
  }


  comments.forEach(
    (comment) => {
      comment.remove();

      stats.commentsRemoved++;
    }
  );
}


function cleanWordClasses(
  document: Document,
  stats: CleanupStats
): void {
  document
    .querySelectorAll<HTMLElement>(
      '[class]'
    )
    .forEach(
      (element) => {
        const original =
          Array.from(
            element.classList
          );


        const remaining =
          original.filter(
            (className) => {
              const isWord =
                /^Mso/i.test(
                  className
                ) ||
                /^WordSection/i.test(
                  className
                );


              if (isWord) {
                stats.wordClassesRemoved++;
              }


              return !isWord;
            }
          );


        if (
          remaining.length ===
          0
        ) {
          element.removeAttribute(
            'class'
          );
        } else {
          element.className =
            remaining.join(
              ' '
            );
        }
      }
    );
}


function cleanWordStyles(
  document: Document,
  stats: CleanupStats
): void {
  document
    .querySelectorAll<HTMLElement>(
      '[style]'
    )
    .forEach(
      (element) => {
        const style =
          element.getAttribute(
            'style'
          );


        if (!style) {
          return;
        }


        const declarations =
          style
            .split(';')
            .map(
              (item) =>
                item.trim()
            )
            .filter(
              Boolean
            );


        const remaining:
          string[] = [];


        declarations.forEach(
          (declaration) => {
            const property =
              declaration
                .split(':')[0]
                ?.trim()
                .toLowerCase() ??
              '';


            if (
              property.startsWith(
                'mso-'
              )
            ) {
              stats.wordStylesRemoved++;
            } else {
              remaining.push(
                declaration
              );
            }
          }
        );


        if (
          remaining.length ===
          0
        ) {
          element.removeAttribute(
            'style'
          );
        } else {
          element.setAttribute(
            'style',
            `${remaining.join(
              '; '
            )};`
          );
        }
      }
    );
}


function normalizeFormatting(
  document: Document,
  stats: CleanupStats
): void {
  document
    .querySelectorAll(
      'b'
    )
    .forEach(
      (element) => {
        replaceTag(
          element,
          'strong'
        );

        stats.boldConverted++;
      }
    );


  document
    .querySelectorAll(
      'i'
    )
    .forEach(
      (element) => {
        replaceTag(
          element,
          'em'
        );

        stats.italicConverted++;
      }
    );


  document
    .querySelectorAll(
      [
        'h1 strong',
        'h2 strong',
        'h3 strong',
        'h4 strong',
        'h5 strong',
        'h6 strong',
      ].join(',')
    )
    .forEach(
      (element) => {
        unwrapElement(
          element
        );

        stats
          .headingFormattingRemoved++;
      }
    );


  document
    .querySelectorAll(
      'strong strong, em em'
    )
    .forEach(
      (element) => {
        unwrapElement(
          element
        );

        stats
          .duplicateFormattingRemoved++;
      }
    );
}


function getTocTargetHeading(
  document: Document,
  targetId: string
): HTMLElement | null {
  const target =
    document.getElementById(
      targetId
    );


  if (!target) {
    return null;
  }


  if (
    /^H[1-6]$/.test(
      target.tagName
    )
  ) {
    return target as HTMLElement;
  }


  return target.closest<HTMLElement>(
    'h1, h2, h3, h4, h5, h6'
  );
}


function getTocLinkFromParagraph(
  paragraph: HTMLParagraphElement
): HTMLAnchorElement | null {
  const links =
    Array.from(
      paragraph
        .querySelectorAll<HTMLAnchorElement>(
          ':scope > a[href^="#"]'
        )
    );


  if (
    links.length !== 1
  ) {
    return null;
  }


  const link =
    links[0];


  const targetId =
    normalizeTarget(
      link.getAttribute(
        'href'
      )
    );


  if (
    !targetId ||
    !/^_Toc/i.test(
      targetId
    )
  ) {
    return null;
  }


  const paragraphText =
    normalizeText(
      paragraph.textContent ??
      ''
    );


  const linkText =
    normalizeText(
      link.textContent ??
      ''
    );


  if (
    paragraphText !==
    linkText
  ) {
    return null;
  }


  return link;
}


interface TocEntry {
  paragraph:
    HTMLParagraphElement;

  link:
    HTMLAnchorElement;

  targetId:
    string;

  heading:
    HTMLElement;

  level:
    number;
}


function getOrCreateNestedList(
  document: Document,
  parentItem: HTMLLIElement,
  stats: CleanupStats
): HTMLUListElement {
  const existing =
    Array.from(
      parentItem.children
    ).find(
      (
        child
      ): child is HTMLUListElement =>
        child.tagName ===
        'UL'
    );


  if (existing) {
    return existing;
  }


  const list =
    document.createElement(
      'ul'
    );


  parentItem.appendChild(
    list
  );


  stats
    .tocNestedListsCreated++;


  return list;
}


function buildNestedTocList(
  document: Document,
  entries: TocEntry[],
  stats: CleanupStats,
  warnings: string[]
): HTMLUListElement {
  const rootList =
    document.createElement(
      'ul'
    );


  interface StackItem {
    level: number;

    list:
      HTMLUListElement;

    lastItem:
      HTMLLIElement;
  }


  const stack:
    StackItem[] = [];


  let previousLevel:
    number | null = null;


  entries.forEach(
    (entry) => {
      const listItem =
        document.createElement(
          'li'
        );


      listItem.appendChild(
        entry.link
      );


      stats
        .tocParagraphsConvertedToListItems++;


      if (
        stack.length ===
        0
      ) {
        rootList.appendChild(
          listItem
        );


        stack.push({
          level:
            entry.level,

          list:
            rootList,

          lastItem:
            listItem,
        });


        previousLevel =
          entry.level;


        return;
      }


      if (
        previousLevel !==
          null &&
        entry.level >
          previousLevel + 1
      ) {
        warnings.push(
          `TOC heading level jumps from H${previousLevel} to H${entry.level}: "${normalizeText(
            entry.heading.textContent ??
            ''
          )}"`
        );
      }


      let current =
        stack[
          stack.length - 1
        ];


      if (
        entry.level >
        current.level
      ) {
        const nested =
          getOrCreateNestedList(
            document,
            current.lastItem,
            stats
          );


        nested.appendChild(
          listItem
        );


        stack.push({
          level:
            entry.level,

          list:
            nested,

          lastItem:
            listItem,
        });


        previousLevel =
          entry.level;


        return;
      }


      while (
        stack.length > 1 &&
        entry.level <
          stack[
            stack.length - 1
          ].level
      ) {
        stack.pop();
      }


      current =
        stack[
          stack.length - 1
        ];


      if (
        entry.level ===
        current.level
      ) {
        current.list.appendChild(
          listItem
        );


        current.lastItem =
          listItem;


        previousLevel =
          entry.level;


        return;
      }


      if (
        entry.level >
        current.level
      ) {
        const nested =
          getOrCreateNestedList(
            document,
            current.lastItem,
            stats
          );


        nested.appendChild(
          listItem
        );


        stack.push({
          level:
            entry.level,

          list:
            nested,

          lastItem:
            listItem,
        });


        previousLevel =
          entry.level;


        return;
      }


      rootList.appendChild(
        listItem
      );


      warnings.push(
        `Unexpected TOC heading hierarchy at H${entry.level}: "${normalizeText(
          entry.heading.textContent ??
          ''
        )}"`
      );


      stack.length =
        0;


      stack.push({
        level:
          entry.level,

        list:
          rootList,

        lastItem:
          listItem,
      });


      previousLevel =
        entry.level;
    }
  );


  return rootList;
}


/**
 * Process only the real Word TOC block
 * immediately following "Contents".
 *
 * This is intentionally safer than
 * treating every #_Toc link in the
 * document as a TOC entry.
 */
function processWordToc(
  document: Document,
  stats: CleanupStats,
  warnings: string[]
): void {
  const possibleTitles =
    Array.from(
      document.querySelectorAll<
        HTMLParagraphElement |
        HTMLHeadingElement
      >(
        'p, h2'
      )
    );


  const contentsElement =
    possibleTitles.find(
      (element) => {
        const title =
          normalizeText(
            element.textContent ??
            ''
          ).toLowerCase();


        if (
          title !==
          'contents'
        ) {
          return false;
        }


        const next =
          element.nextElementSibling;


        return (
          next instanceof
            HTMLParagraphElement &&
          getTocLinkFromParagraph(
            next
          ) !==
          null
        );
      }
    );


  if (!contentsElement) {
    return;
  }


  /*
   * Collect consecutive Word TOC
   * paragraphs after Contents.
   */
  const rawEntries:
    {
      paragraph:
        HTMLParagraphElement;

      link:
        HTMLAnchorElement;

      targetId:
        string;
    }[] = [];


  let sibling =
    contentsElement
      .nextElementSibling;


  while (
    sibling instanceof
    HTMLParagraphElement
  ) {
    const link =
      getTocLinkFromParagraph(
        sibling
      );


    if (!link) {
      break;
    }


    const targetId =
      normalizeTarget(
        link.getAttribute(
          'href'
        )
      );


    if (!targetId) {
      break;
    }


    rawEntries.push({
      paragraph:
        sibling,

      link,

      targetId,
    });


    sibling =
      sibling.nextElementSibling;
  }


  stats.tocEntriesFound =
    rawEntries.length;


  if (
    rawEntries.length ===
    0
  ) {
    return;
  }


  const entries:
    TocEntry[] = [];


  rawEntries.forEach(
    (entry) => {
      const heading =
        getTocTargetHeading(
          document,
          entry.targetId
        );


      if (!heading) {
        stats.brokenTocLinks++;


        warnings.push(
          `Table of contents link has no heading target: #${entry.targetId}`
        );


        return;
      }


      stats.tocTargetsFound++;


      const tocText =
        normalizeText(
          entry.link.textContent ??
          ''
        );


      const headingText =
        normalizeText(
          heading.textContent ??
          ''
        );


      if (!headingText) {
        warnings.push(
          `Table of contents target #${entry.targetId} has an empty heading.`
        );


        return;
      }


      if (
        tocText !==
        headingText
      ) {
        if (
          tocText.startsWith(
            headingText
          )
        ) {
          const extra =
            tocText
              .slice(
                headingText.length
              )
              .trim();


          if (
            /^\d+$/.test(
              extra
            )
          ) {
            stats
              .tocPageNumbersRemoved++;
          }
        }


        entry.link.textContent =
          headingText;


        stats
          .tocLabelsSynchronized++;
      }


      entries.push({
        paragraph:
          entry.paragraph,

        link:
          entry.link,

        targetId:
          entry.targetId,

        heading,

        level:
          Number(
            heading.tagName.substring(
              1
            )
          ),
      });
    }
  );


  /*
   * If some TOC entries are broken,
   * don't partially rebuild the TOC.
   *
   * We still synchronize the valid
   * labels above, but preserve the
   * paragraph structure.
   */
  if (
    entries.length !==
    rawEntries.length
  ) {
    warnings.push(
      'The Table of Contents was not converted to a nested list because one or more entries have invalid targets.'
    );


    return;
  }


  let contentsHeading:
    HTMLElement;


  if (
    contentsElement.tagName ===
    'H2'
  ) {
    contentsHeading =
      contentsElement as HTMLElement;


    contentsHeading.textContent =
      'Contents';
  } else {
    contentsHeading =
      replaceTag(
        contentsElement,
        'h2'
      );


    contentsHeading.textContent =
      'Contents';


    stats.tocTitleConverted++;
  }


  const tocList =
    buildNestedTocList(
      document,
      entries,
      stats,
      warnings
    );


  contentsHeading
    .insertAdjacentElement(
      'afterend',
      tocList
    );


  entries.forEach(
    (entry) => {
      entry.paragraph.remove();
    }
  );
}


function processHeadingBookmarks(
  document: Document,
  referencedIds: Set<string>,
  stats: CleanupStats
): void {
  const headings =
    document
      .querySelectorAll<HTMLElement>(
        'h1, h2, h3, h4, h5, h6'
      );


  headings.forEach(
    (heading) => {
      const anchors =
        Array
          .from(
            heading.children
          )
          .filter(
            (
              child
            ): child is HTMLAnchorElement =>
              child.tagName ===
                'A' &&
              child.hasAttribute(
                'id'
              ) &&
              !child.hasAttribute(
                'href'
              ) &&
              !normalizeText(
                child.textContent ??
                ''
              )
          );


      anchors.forEach(
        (anchor) => {
          const bookmarkId =
            anchor.id;


          if (!bookmarkId) {
            return;
          }


          /*
           * Heading already has its
           * canonical ID.
           */
          if (
            heading.id
          ) {
            const canonicalId =
              heading.id;


            if (
              bookmarkId ===
              canonicalId
            ) {
              anchor.remove();


              stats
                .bookmarkAliasesRemoved++;


              return;
            }


            if (
              referencedIds.has(
                bookmarkId
              )
            ) {
              const rewritten =
                rewriteInternalReferences(
                  document,
                  bookmarkId,
                  canonicalId
                );


              stats
                .bookmarkReferencesRewritten +=
                rewritten;
            }


            anchor.remove();


            stats
              .bookmarkAliasesRemoved++;


            return;
          }


          /*
           * Heading has no ID but this
           * bookmark is referenced.
           */
          if (
            referencedIds.has(
              bookmarkId
            )
          ) {
            heading.id =
              bookmarkId;


            anchor.remove();


            stats
              .bookmarksMovedToHeadings++;


            return;
          }


          /*
           * Unused Word-generated bookmark.
           */
          if (
            WORD_BOOKMARK_PATTERN.test(
              bookmarkId
            )
          ) {
            anchor.remove();


            stats
              .unusedWordBookmarksRemoved++;
          }
        }
      );
    }
  );
}


function unwrapEmptySpans(
  document: Document,
  referencedIds: Set<string>,
  stats: CleanupStats
): void {
  document
    .querySelectorAll<HTMLSpanElement>(
      'span'
    )
    .forEach(
      (span) => {
        if (
          isProtectedElement(
            span,
            referencedIds
          )
        ) {
          return;
        }


        if (
          span.attributes.length ===
          0
        ) {
          unwrapElement(
            span
          );


          stats.spansUnwrapped++;
        }
      }
    );
}


function cleanLists(
  document: Document,
  referencedIds: Set<string>,
  stats: CleanupStats
): void {
  document
    .querySelectorAll<HTMLLIElement>(
      'li'
    )
    .forEach(
      (item) => {
        if (
          isProtectedElement(
            item,
            referencedIds
          )
        ) {
          return;
        }


        if (
          !hasMeaningfulContent(
            item
          )
        ) {
          item.remove();


          stats
            .emptyListItemsRemoved++;
        }
      }
    );


  document
    .querySelectorAll(
      'ul, ol'
    )
    .forEach(
      (list) => {
        if (
          isProtectedElement(
            list,
            referencedIds
          )
        ) {
          return;
        }


        if (
          list.querySelectorAll(
            ':scope > li'
          ).length ===
          0
        ) {
          list.remove();


          stats.emptyListsRemoved++;
        }
      }
    );
}


function removeEmptyElements(
  document: Document,
  referencedIds: Set<string>,
  stats: CleanupStats
): void {
  let changed =
    true;


  while (changed) {
    changed =
      false;


    document
      .querySelectorAll(
        EMPTY_REMOVABLE_ELEMENTS.join(
          ','
        )
      )
      .forEach(
        (element) => {
          if (
            isProtectedElement(
              element,
              referencedIds
            )
          ) {
            return;
          }


          if (
            hasMeaningfulContent(
              element
            )
          ) {
            return;
          }


          element.remove();


          stats
            .emptyElementsRemoved++;


          changed =
            true;
        }
      );
  }
}


function analyzeHeadings(
  document: Document,
  warnings: string[],
  stats: CleanupStats
): void {
  const headings =
    Array.from(
      document
        .querySelectorAll<HTMLElement>(
          'h1, h2, h3, h4, h5, h6'
        )
    );


  stats.headings =
    headings.length;


  const h1Count =
    headings.filter(
      (heading) =>
        heading.tagName ===
        'H1'
    ).length;


  if (
    h1Count > 1
  ) {
    warnings.push(
      `Multiple H1 headings detected (${h1Count}).`
    );
  }


  let previous:
    number | null = null;


  headings.forEach(
    (heading) => {
      const current =
        Number(
          heading.tagName.substring(
            1
          )
        );


      if (
        previous !==
          null &&
        current >
          previous + 1
      ) {
        warnings.push(
          `Heading level jumps from H${previous} to H${current}: "${normalizeText(
            heading.textContent ??
            ''
          )}"`
        );
      }


      previous =
        current;
    }
  );
}


function analyzeReferences(
  document: Document,
  stats: CleanupStats,
  warnings: string[]
): void {
  const ids =
    getAllIds(
      document
    );


  const links =
    Array.from(
      document
        .querySelectorAll<HTMLAnchorElement>(
          'a[href^="#"]'
        )
    );


  stats.internalLinks =
    links.length;


  links.forEach(
    (link) => {
      const target =
        normalizeTarget(
          link.getAttribute(
            'href'
          )
        );


      if (!target) {
        return;
      }


      if (
        !ids.has(
          target
        )
      ) {
        stats
          .brokenInternalLinks++;


        warnings.push(
          `Broken internal reference: #${target}`
        );
      }
    }
  );


  document
    .querySelectorAll<HTMLElement>(
      '[id]'
    )
    .forEach(
      (element) => {
        if (
          NOTE_ID_PATTERN.test(
            element.id
          )
        ) {
          stats
            .footnoteDefinitions++;
        }
      }
    );


  links.forEach(
    (link) => {
      const target =
        normalizeTarget(
          link.getAttribute(
            'href'
          )
        ) ??
        '';


      const sourceId =
        link.id ??
        '';


      if (
        NOTE_ID_PATTERN.test(
          target
        ) ||
        NOTE_ID_PATTERN.test(
          sourceId
        )
      ) {
        stats
          .footnoteReferences++;
      }
    }
  );
}


function createStats():
CleanupStats {
  return {
    commentsRemoved:
      0,

    emptyElementsRemoved:
      0,

    emptyListItemsRemoved:
      0,

    emptyListsRemoved:
      0,

    spansUnwrapped:
      0,

    boldConverted:
      0,

    italicConverted:
      0,

    headingFormattingRemoved:
      0,

    duplicateFormattingRemoved:
      0,

    wordClassesRemoved:
      0,

    wordStylesRemoved:
      0,

    bookmarksMovedToHeadings:
      0,

    unusedWordBookmarksRemoved:
      0,

    bookmarkAliasesRemoved:
      0,

    bookmarkReferencesRewritten:
      0,

    tocEntriesFound:
      0,

    tocTargetsFound:
      0,

    tocLabelsSynchronized:
      0,

    tocPageNumbersRemoved:
      0,

    brokenTocLinks:
      0,

    tocTitleConverted:
      0,

    tocParagraphsConvertedToListItems:
      0,

    tocNestedListsCreated:
      0,

    referencedIdsProtected:
      0,

    footnoteReferences:
      0,

    footnoteDefinitions:
      0,

    internalLinks:
      0,

    brokenInternalLinks:
      0,

    headings:
      0,
  };
}


export function cleanHtml(
  html: string
): CleanupResult {
  const parser =
    new DOMParser();


  const document =
    parser.parseFromString(
      html,
      'text/html'
    );


  const stats =
    createStats();


  const warnings:
    string[] = [];


  /*
   * Build the protection map before
   * modifying anything.
   */
  const referencedIds =
    getReferencedIds(
      document
    );


  stats
    .referencedIdsProtected =
    referencedIds.size;


  /*
   * Word TOC.
   */
  processWordToc(
    document,
    stats,
    warnings
  );


  /*
   * General cleanup.
   */
  removeComments(
    document,
    stats
  );


  cleanWordClasses(
    document,
    stats
  );


  cleanWordStyles(
    document,
    stats
  );


  /*
   * Bookmarks and heading IDs.
   */
  processHeadingBookmarks(
    document,
    referencedIds,
    stats
  );


  /*
   * Semantic formatting.
   */
  normalizeFormatting(
    document,
    stats
  );


  /*
   * Remove unnecessary wrappers.
   */
  unwrapEmptySpans(
    document,
    referencedIds,
    stats
  );


  /*
   * Lists.
   */
  cleanLists(
    document,
    referencedIds,
    stats
  );


  /*
   * Empty elements.
   */
  removeEmptyElements(
    document,
    referencedIds,
    stats
  );


  /*
   * Heading structure analysis.
   */
  analyzeHeadings(
    document,
    warnings,
    stats
  );


  /*
   * Final reference validation.
   *
   * This validates the document AFTER
   * all transformations.
   */
  analyzeReferences(
    document,
    stats,
    warnings
  );


  const uniqueWarnings =
    Array.from(
      new Set(
        warnings
      )
    );


  const cleanedHtml =
    document.body.innerHTML;


  return {
    originalHtml:
      html,

    cleanedHtml,

    stats,

    warnings:
      uniqueWarnings,

    hasChanges:
      cleanedHtml !==
      html,
  };
}