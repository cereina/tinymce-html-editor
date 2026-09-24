import type {
  Editor,
} from 'tinymce';


/* =========================================================
   CONSTANTS
   ========================================================= */


const GENERATED_TOC_ATTRIBUTE =
  'data-generated-toc';

const GENERATED_TOC_SELECTOR =
  `[${GENERATED_TOC_ATTRIBUTE}="true"]`;

const HEADING_SELECTOR =
  'h1, h2, h3, h4, h5, h6';


/* =========================================================
   TYPES
   ========================================================= */


interface TocHeading {
  heading: HTMLHeadingElement;
  level: number;
  text: string;
}


interface TocEntry {
  id: string;
  level: number;
  text: string;
}


interface HeadingJump {
  fromLevel: number;
  toLevel: number;
  fromText: string;
  toText: string;
}


interface TocAnalysis {
  totalHeadings: number;

  headingCounts: Record<
    number,
    number
  >;

  existingGeneratedTocs: number;

  headingsInsideTables: number;

  headingsInsideGeneratedToc: number;

  emptyHeadings: number;

  headingJumps: HeadingJump[];
}


interface TocOptions {
  title: string;

  titleHeadingLevel: number;

  levels: number[];

  nested: boolean;

  insertLocation:
    | 'existing'
    | 'cursor'
    | 'beginning';
}


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


function getHeadingLevel(
  heading: HTMLHeadingElement
): number {
  return Number(
    heading.tagName.substring(
      1
    )
  );
}


/* =========================================================
   GENERATED TOC
   ========================================================= */


function getGeneratedTocs(
  root: HTMLElement
): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<
      HTMLElement
    >(
      GENERATED_TOC_SELECTOR
    )
  );
}


function getFirstGeneratedToc(
  root: HTMLElement
): HTMLElement | null {
  return (
    getGeneratedTocs(
      root
    )[0] ??
    null
  );
}


function isInsideGeneratedToc(
  element: Element
): boolean {
  return Boolean(
    element.closest(
      GENERATED_TOC_SELECTOR
    )
  );
}


/* =========================================================
   HEADINGS
   ========================================================= */


function getEligibleHeadings(
  root: HTMLElement
): TocHeading[] {
  const headings =
    Array.from(
      root.querySelectorAll<
        HTMLHeadingElement
      >(
        HEADING_SELECTOR
      )
    );


  return headings
    .filter(
      (
        heading
      ) => {
        /*
         * Do not include the TOC's own
         * heading.
         */
        if (
          isInsideGeneratedToc(
            heading
          )
        ) {
          return false;
        }


        /*
         * Do not build navigation
         * entries from headings that
         * appear inside tables.
         */
        if (
          heading.closest(
            'table'
          )
        ) {
          return false;
        }


        return true;
      }
    )
    .map(
      (
        heading
      ) => ({
        heading,

        level:
          getHeadingLevel(
            heading
          ),

        text:
          normalizeText(
            heading.textContent ??
              ''
          ),
      })
    );
}


/* =========================================================
   LEVEL PARSING
   ========================================================= */


function parseLevels(
  value: string
): {
  levels: number[];
  error: string | null;
} {
  const normalized =
    value.trim();


  if (
    !normalized
  ) {
    return {
      levels: [],

      error:
        'Enter at least one heading level. Example: 2,3,4',
    };
  }


  const parts =
    normalized
      .split(
        ','
      )
      .map(
        (
          part
        ) =>
          part.trim()
      )
      .filter(
        Boolean
      );


  const levels: number[] =
    [];


  for (
    const part of parts
  ) {
    if (
      !/^[1-6]$/.test(
        part
      )
    ) {
      return {
        levels: [],

        error:
          'Heading levels must contain numbers from 1 to 6 separated by commas. Example: 2,3,4',
      };
    }


    const level =
      Number(
        part
      );


    if (
      !levels.includes(
        level
      )
    ) {
      levels.push(
        level
      );
    }
  }


  levels.sort(
    (
      a,
      b
    ) =>
      a - b
  );


  return {
    levels,
    error: null,
  };
}


function formatLevels(
  levels: number[]
): string {
  return levels.join(
    ','
  );
}


/* =========================================================
   ANALYSIS
   ========================================================= */


function findHeadingJumps(
  headings: TocHeading[]
): HeadingJump[] {
  const jumps:
    HeadingJump[] = [];


  let previous:
    TocHeading | null =
    null;


  headings.forEach(
    (
      current
    ) => {
      if (
        previous &&
        current.level >
          previous.level + 1
      ) {
        jumps.push({
          fromLevel:
            previous.level,

          toLevel:
            current.level,

          fromText:
            previous.text ||
            '(empty heading)',

          toText:
            current.text ||
            '(empty heading)',
        });
      }


      previous =
        current;
    }
  );


  return jumps;
}


function analyzeDocument(
  root: HTMLElement
): TocAnalysis {
  const allHeadings =
    Array.from(
      root.querySelectorAll<
        HTMLHeadingElement
      >(
        HEADING_SELECTOR
      )
    );


  const headingsInsideTables =
    allHeadings.filter(
      (
        heading
      ) =>
        Boolean(
          heading.closest(
            'table'
          )
        )
    ).length;


  const headingsInsideGeneratedToc =
    allHeadings.filter(
      (
        heading
      ) =>
        isInsideGeneratedToc(
          heading
        )
    ).length;


  const eligible =
    getEligibleHeadings(
      root
    );


  const headingCounts:
    Record<
      number,
      number
    > = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
    };


  eligible.forEach(
    (
      item
    ) => {
      headingCounts[
        item.level
      ]++;
    }
  );


  return {
    totalHeadings:
      eligible.length,

    headingCounts,

    existingGeneratedTocs:
      getGeneratedTocs(
        root
      ).length,

    headingsInsideTables,

    headingsInsideGeneratedToc,

    emptyHeadings:
      eligible.filter(
        (
          item
        ) =>
          !item.text
      ).length,

    headingJumps:
      findHeadingJumps(
        eligible
      ),
  };
}


/* =========================================================
   EXISTING SETTINGS
   ========================================================= */


function getExistingTocTitle(
  toc: HTMLElement | null
): string {
  if (
    !toc
  ) {
    return (
      'On this page'
    );
  }


  const heading =
    toc.querySelector<
      HTMLHeadingElement
    >(
      HEADING_SELECTOR
    );


  return (
    normalizeText(
      heading?.textContent ??
        ''
    ) ||
    'On this page'
  );
}


function getExistingTocHeadingLevel(
  toc: HTMLElement | null
): number {
  if (
    !toc
  ) {
    return 2;
  }


  const stored =
    Number(
      toc.getAttribute(
        'data-toc-heading-level'
      )
    );


  if (
    stored >= 1 &&
    stored <= 6
  ) {
    return stored;
  }


  const heading =
    toc.querySelector<
      HTMLHeadingElement
    >(
      HEADING_SELECTOR
    );


  if (
    heading
  ) {
    return getHeadingLevel(
      heading
    );
  }


  return 2;
}


function getExistingTocLevels(
  toc: HTMLElement | null
): string {
  if (
    !toc
  ) {
    return '2,3';
  }


  return (
    toc.getAttribute(
      'data-toc-levels'
    )?.trim() ||
    '2,3'
  );
}


function getExistingNestedSetting(
  toc: HTMLElement | null
): boolean {
  if (
    !toc
  ) {
    return true;
  }


  return (
    toc.getAttribute(
      'data-toc-nested'
    ) !==
    'false'
  );
}


function getExistingTitleId(
  toc: HTMLElement | null
): string {
  if (
    !toc
  ) {
    return '';
  }


  const ariaLabelledBy =
    toc.getAttribute(
      'aria-labelledby'
    )?.trim();


  if (
    ariaLabelledBy
  ) {
    return ariaLabelledBy;
  }


  const heading =
    toc.querySelector<
      HTMLHeadingElement
    >(
      HEADING_SELECTOR
    );


  return (
    heading?.id ??
    ''
  );
}


/* =========================================================
   DOCUMENT IDS
   ========================================================= */


function getDocumentIdCounts(
  root: HTMLElement
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
      /*
       * Existing generated TOC IDs are
       * ignored because that TOC may be
       * replaced.
       */
      if (
        isInsideGeneratedToc(
          element
        )
      ) {
        return;
      }


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
        ) + 1
      );
    }
  );


  return counts;
}


function findDuplicateHeadingIds(
  root: HTMLElement,
  headings: TocHeading[]
): string[] {
  const counts =
    getDocumentIdCounts(
      root
    );


  const duplicates =
    new Set<string>();


  headings.forEach(
    (
      item
    ) => {
      const id =
        item.heading.id.trim();


      if (
        !id
      ) {
        return;
      }


      if (
        (
          counts.get(
            id
          ) ??
          0
        ) >
        1
      ) {
        duplicates.add(
          id
        );
      }
    }
  );


  return Array.from(
    duplicates
  );
}


/* =========================================================
   ID GENERATION
   ========================================================= */


function createSlug(
  value: string
): string {
  return value
    .normalize(
      'NFKD'
    )
    .replace(
      /\p{M}/gu,
      ''
    )
    .toLowerCase()
    .replace(
      /['’‘"`´]/g,
      ''
    )
    .replace(
      /[^\p{L}\p{N}]+/gu,
      '-'
    )
    .replace(
      /^-+|-+$/g,
      ''
    );
}


function createUniqueId(
  preferred: string,
  reserved: Set<string>
): string {
  const base =
    preferred.trim() ||
    'heading';


  let candidate =
    base;


  let counter =
    2;


  while (
    reserved.has(
      candidate
    )
  ) {
    candidate =
      `${base}-${counter}`;

    counter++;
  }


  reserved.add(
    candidate
  );


  return candidate;
}


function ensureHeadingIds(
  root: HTMLElement,
  headings: TocHeading[]
): TocEntry[] {
  const idCounts =
    getDocumentIdCounts(
      root
    );


  const reserved =
    new Set<string>(
      idCounts.keys()
    );


  let fallbackNumber =
    1;


  return headings
    .filter(
      (
        item
      ) =>
        Boolean(
          item.text
        )
    )
    .map(
      (
        item
      ) => {
        let id =
          item.heading.id.trim();


        /*
         * Existing heading IDs are
         * deliberately preserved.
         */
        if (
          !id
        ) {
          const slug =
            createSlug(
              item.text
            );


          id =
            createUniqueId(
              slug ||
              `heading-${fallbackNumber}`,
              reserved
            );


          item.heading.id =
            id;


          fallbackNumber++;
        }


        return {
          id,
          level:
            item.level,
          text:
            item.text,
        };
      }
    );
}


/* =========================================================
   LIST CREATION
   ========================================================= */


function createListItem(
  document: Document,
  entry: TocEntry
): HTMLLIElement {
  const li =
    document.createElement(
      'li'
    );


  const link =
    document.createElement(
      'a'
    );


  link.setAttribute(
    'href',
    `#${entry.id}`
  );


  link.textContent =
    entry.text;


  li.appendChild(
    link
  );


  return li;
}


function buildFlatList(
  document: Document,
  entries: TocEntry[]
): HTMLUListElement {
  const ul =
    document.createElement(
      'ul'
    );


  entries.forEach(
    (
      entry
    ) => {
      ul.appendChild(
        createListItem(
          document,
          entry
        )
      );
    }
  );


  return ul;
}


function getOrCreateChildList(
  document: Document,
  item: HTMLLIElement
): HTMLUListElement {
  const existing =
    Array.from(
      item.children
    ).find(
      (
        child
      ) =>
        child.tagName ===
        'UL'
    );


  if (
    existing
  ) {
    return (
      existing as
        HTMLUListElement
    );
  }


  const ul =
    document.createElement(
      'ul'
    );


  item.appendChild(
    ul
  );


  return ul;
}


function buildNestedList(
  document: Document,
  entries: TocEntry[]
): HTMLUListElement {
  const root =
    document.createElement(
      'ul'
    );


  const stack:
    Array<{
      level: number;
      item: HTMLLIElement;
    }> = [];


  entries.forEach(
    (
      entry
    ) => {
      while (
        stack.length >
          0 &&
        entry.level <=
          stack[
            stack.length - 1
          ].level
      ) {
        stack.pop();
      }


      const item =
        createListItem(
          document,
          entry
        );


      const parent =
        stack[
          stack.length - 1
        ];


      if (
        parent
      ) {
        getOrCreateChildList(
          document,
          parent.item
        ).appendChild(
          item
        );
      } else {
        root.appendChild(
          item
        );
      }


      stack.push({
        level:
          entry.level,

        item,
      });
    }
  );


  return root;
}


/* =========================================================
   BUILD TOC ELEMENT
   ========================================================= */


function buildTocElement(
  editor: Editor,
  entries: TocEntry[],
  options: TocOptions,
  preferredTitleId: string
): HTMLElement {
  const document =
    editor.getDoc();


  const nav =
    document.createElement(
      'nav'
    );


  nav.setAttribute(
    GENERATED_TOC_ATTRIBUTE,
    'true'
  );


  nav.setAttribute(
    'data-toc-levels',
    formatLevels(
      options.levels
    )
  );


  nav.setAttribute(
    'data-toc-heading-level',
    String(
      options.titleHeadingLevel
    )
  );


  nav.setAttribute(
    'data-toc-nested',
    options.nested
      ? 'true'
      : 'false'
  );


  const reserved =
    new Set<string>(
      getDocumentIdCounts(
        editor.getBody()
      ).keys()
    );


  const titleId =
    createUniqueId(
      preferredTitleId ||
      'toc-title',
      reserved
    );


  nav.setAttribute(
    'aria-labelledby',
    titleId
  );


  const heading =
    document.createElement(
      `h${options.titleHeadingLevel}`
    ) as HTMLHeadingElement;


  heading.id =
    titleId;


  heading.textContent =
    options.title;


  nav.appendChild(
    heading
  );


  const list =
    options.nested
      ? buildNestedList(
          document,
          entries
        )
      : buildFlatList(
          document,
          entries
        );


  nav.appendChild(
    list
  );


  return nav;
}


/* =========================================================
   ANALYSIS REPORT
   ========================================================= */


function createAnalysisReport(
  analysis: TocAnalysis
): string {
  const headingRows =
    [
      1,
      2,
      3,
      4,
      5,
      6,
    ]
      .filter(
        (
          level
        ) =>
          analysis
            .headingCounts[
              level
            ] >
          0
      )
      .map(
        (
          level
        ) => `
          <tr>
            <td>
              H${level}
            </td>

            <td
              style="
                padding-left: 20px;
                text-align: right;
                font-weight: 700;
              "
            >
              ${
                analysis
                  .headingCounts[
                    level
                  ]
              }
            </td>
          </tr>
        `
      )
      .join(
        ''
      );


  const warnings:
    string[] = [];


  if (
    analysis.emptyHeadings >
    0
  ) {
    warnings.push(
      `${analysis.emptyHeadings} empty heading(s) will be skipped.`
    );
  }


  if (
    analysis
      .headingsInsideTables >
    0
  ) {
    warnings.push(
      `${analysis.headingsInsideTables} heading(s) inside tables will be skipped.`
    );
  }


  analysis.headingJumps.forEach(
    (
      jump
    ) => {
      warnings.push(
        `Heading jump H${jump.fromLevel} → H${jump.toLevel}: "${jump.fromText}" → "${jump.toText}".`
      );
    }
  );


  const warningHtml =
    warnings.length >
    0
      ? `
        <div
          style="
            margin-top: 16px;
            padding: 12px;
            background: #fff8e5;
            border-radius: 6px;
          "
        >
          <strong>
            Review recommended
          </strong>

          <ul
            style="
              margin-bottom: 0;
            "
          >
            ${warnings
              .map(
                (
                  warning
                ) => `
                  <li>
                    ${escapeHtml(
                      warning
                    )}
                  </li>
                `
              )
              .join(
                ''
              )}
          </ul>
        </div>
      `
      : `
        <div
          style="
            margin-top: 16px;
            padding: 12px;
            background: #eef8f0;
            border-radius: 6px;
          "
        >
          No structural TOC warnings detected.
        </div>
      `;


  return `
    <div>

      <h3
        style="
          margin-top: 0;
        "
      >
        Table of Contents
      </h3>

      <p>
        The TOC will use the current
        document headings.
      </p>

      <table>

        <tr>
          <td>
            Eligible headings
          </td>

          <td
            style="
              padding-left: 20px;
              text-align: right;
              font-weight: 700;
            "
          >
            ${analysis.totalHeadings}
          </td>
        </tr>

        ${headingRows}

        <tr>
          <td>
            Existing generated TOCs
          </td>

          <td
            style="
              padding-left: 20px;
              text-align: right;
              font-weight: 700;
            "
          >
            ${analysis.existingGeneratedTocs}
          </td>
        </tr>

      </table>

      ${warningHtml}

      <div
        style="
          margin-top: 16px;
          padding: 12px;
          background: #eef5ff;
          border-radius: 6px;
        "
      >
        Existing heading IDs will be
        preserved. Missing heading IDs
        will be created automatically.
      </div>

    </div>
  `;
}


/* =========================================================
   CREATE / REBUILD
   ========================================================= */


function openCreateTocDialog(
  editor: Editor
): void {
  const body =
    editor.getBody();


  const analysis =
    analyzeDocument(
      body
    );


  const existingToc =
    getFirstGeneratedToc(
      body
    );


  /*
   * Save the editor cursor before
   * the modal takes focus.
   */
  const bookmark =
    editor.selection.getBookmark(
      2,
      true
    );


  const insertionItems = [
    ...(existingToc
      ? [
          {
            text:
              'At existing generated TOC location',

            value:
              'existing',
          },
        ]
      : []),

    {
      text:
        'At current cursor position',

      value:
        'cursor',
    },

    {
      text:
        'At beginning of document',

      value:
        'beginning',
    },
  ];


  editor.windowManager.open({
    title:
      'Create / Rebuild Table of Contents',

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
            createAnalysisReport(
              analysis
            ),
        },

        {
          type:
            'input',

          name:
            'tocTitle',

          label:
            'TOC heading text',
        },

        {
          type:
            'selectbox',

          name:
            'tocHeadingLevel',

          label:
            'TOC heading level',

          items: [
            {
              text: 'H1',
              value: '1',
            },
            {
              text: 'H2',
              value: '2',
            },
            {
              text: 'H3',
              value: '3',
            },
            {
              text: 'H4',
              value: '4',
            },
            {
              text: 'H5',
              value: '5',
            },
            {
              text: 'H6',
              value: '6',
            },
          ],
        },

        {
          type:
            'input',

          name:
            'levels',

          label:
            'Heading levels to include',

          placeholder:
            '2,3,4',
        },

        {
          type:
            'htmlpanel',

          html:
            `
              <p
                style="
                  margin-top: -4px;
                  font-size: 0.9em;
                "
              >
                Example:
                <code>2,3,4</code>
              </p>
            `,
        },

        {
          type:
            'checkbox',

          name:
            'nested',

          label:
            'Nest TOC entries according to heading hierarchy',
        },

        {
          type:
            'selectbox',

          name:
            'insertLocation',

          label:
            'Insert TOC',

          items:
            insertionItems,
        },
      ],
    },

    initialData: {
      tocTitle:
        getExistingTocTitle(
          existingToc
        ),

      tocHeadingLevel:
        String(
          getExistingTocHeadingLevel(
            existingToc
          )
        ),

      levels:
        getExistingTocLevels(
          existingToc
        ),

      nested:
        getExistingNestedSetting(
          existingToc
        ),

      insertLocation:
        existingToc
          ? 'existing'
          : 'cursor',
    },

    buttons: [
      {
        type:
          'cancel',

        text:
          'Cancel',
      },

      {
        type:
          'submit',

        text:
          existingToc
            ? 'Rebuild TOC'
            : 'Create TOC',

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


        const title =
          typeof data.tocTitle ===
          'string'
            ? data.tocTitle.trim()
            : '';


        if (
          !title
        ) {
          editor.notificationManager.open({
            text:
              'Enter text for the TOC heading.',

            type:
              'error',

            timeout:
              4000,
          });


          return;
        }


        const parsed =
          parseLevels(
            typeof data.levels ===
              'string'
              ? data.levels
              : ''
          );


        if (
          parsed.error
        ) {
          editor.notificationManager.open({
            text:
              parsed.error,

            type:
              'error',

            timeout:
              5000,
          });


          return;
        }


        const titleHeadingLevel =
          Number(
            data.tocHeadingLevel
          );


        if (
          titleHeadingLevel <
            1 ||
          titleHeadingLevel >
            6
        ) {
          editor.notificationManager.open({
            text:
              'Choose a valid TOC heading level.',

            type:
              'error',

            timeout:
              4000,
          });


          return;
        }


        const headings =
          getEligibleHeadings(
            body
          ).filter(
            (
              item
            ) =>
              parsed.levels.includes(
                item.level
              ) &&
              Boolean(
                item.text
              )
          );


        if (
          headings.length ===
          0
        ) {
          editor.notificationManager.open({
            text:
              `No headings were found for levels ${formatLevels(
                parsed.levels
              )}.`,

            type:
              'warning',

            timeout:
              4500,
          });


          return;
        }


        const duplicateIds =
          findDuplicateHeadingIds(
            body,
            headings
          );


        if (
          duplicateIds.length >
          0
        ) {
          editor.notificationManager.open({
            text:
              `Duplicate heading ID(s) found: ${duplicateIds.join(
                ', '
              )}. Resolve them before creating the TOC.`,

            type:
              'error',

            timeout:
              6500,
          });


          return;
        }


        const rawLocation =
          typeof data.insertLocation ===
          'string'
            ? data.insertLocation
            : existingToc
              ? 'existing'
              : 'cursor';


        const insertLocation:
          TocOptions[
            'insertLocation'
          ] =
            rawLocation ===
              'existing' ||
            rawLocation ===
              'beginning'
              ? rawLocation
              : 'cursor';


        const options:
          TocOptions = {
            title,

            titleHeadingLevel,

            levels:
              parsed.levels,

            nested:
              data.nested ===
              true,

            insertLocation,
          };


        const previousTocs =
          getGeneratedTocs(
            body
          );


        const preferredTitleId =
          getExistingTitleId(
            existingToc
          );


        let entryCount =
          0;


        editor.undoManager.transact(
          () => {
            const entries =
              ensureHeadingIds(
                body,
                headings
              );


            entryCount =
              entries.length;


            const newToc =
              buildTocElement(
                editor,
                entries,
                options,
                preferredTitleId
              );


            if (
              options.insertLocation ===
                'existing' &&
              existingToc
            ) {
              existingToc.replaceWith(
                newToc
              );


              previousTocs
                .filter(
                  (
                    toc
                  ) =>
                    toc !==
                    existingToc
                )
                .forEach(
                  (
                    toc
                  ) => {
                    toc.remove();
                  }
                );
            }

            else if (
              options.insertLocation ===
              'beginning'
            ) {
              previousTocs.forEach(
                (
                  toc
                ) => {
                  toc.remove();
                }
              );


              body.insertBefore(
                newToc,
                body.firstChild
              );
            }

            else {
              previousTocs.forEach(
                (
                  toc
                ) => {
                  toc.remove();
                }
              );


              try {
                editor.selection
                  .moveToBookmark(
                    bookmark
                  );


                editor.insertContent(
                  newToc.outerHTML
                );
              } catch {
                body.insertBefore(
                  newToc,
                  body.firstChild
                );
              }
            }


            editor.nodeChanged();
          }
        );


        api.close();


        editor.notificationManager.open({
          text:
            `${existingToc ? 'TOC rebuilt' : 'TOC created'} with ${entryCount} entr${entryCount === 1 ? 'y' : 'ies'}.`,

          type:
            'success',

          timeout:
            4500,
        });
      },
  });
}


/* =========================================================
   REMOVE TOC
   ========================================================= */


function openRemoveTocDialog(
  editor: Editor
): void {
  const tocs =
    getGeneratedTocs(
      editor.getBody()
    );


  if (
    tocs.length ===
    0
  ) {
    editor.notificationManager.open({
      text:
        'No generated table of contents was found.',

      type:
        'info',

      timeout:
        3500,
    });


    return;
  }


  editor.windowManager.open({
    title:
      'Remove Generated TOC',

    size:
      'normal',

    body: {
      type:
        'panel',

      items: [
        {
          type:
            'htmlpanel',

          html:
            `
              <p>
                <strong>
                  ${tocs.length}
                </strong>
                generated TOC element(s)
                will be removed.
              </p>

              <p>
                Heading IDs will remain
                because other internal
                links may depend on them.
              </p>
            `,
        },
      ],
    },

    buttons: [
      {
        type:
          'cancel',

        text:
          'Cancel',
      },

      {
        type:
          'submit',

        text:
          'Remove TOC',

        buttonType:
          'primary',
      },
    ],

    onSubmit:
      (
        api
      ) => {
        const count =
          tocs.length;


        editor.undoManager.transact(
          () => {
            tocs.forEach(
              (
                toc
              ) => {
                toc.remove();
              }
            );


            editor.nodeChanged();
          }
        );


        api.close();


        editor.notificationManager.open({
          text:
            `${count} generated TOC element(s) removed. Heading IDs were preserved.`,

          type:
            'success',

          timeout:
            4000,
        });
      },
  });
}


/* =========================================================
   PUBLIC TINYMCE REGISTRATION
   ========================================================= */


/**
 * IMPORTANT:
 *
 * This is the named export imported by:
 *
 * src/editor/tinymce.ts
 *
 * import {
 *   registerTableOfContentsMenu,
 * } from './table-of-contents';
 */
export function registerTableOfContentsMenu(
  editor: Editor
): void {
  editor.ui.registry.addMenuButton(
    'tocmanager',
    {
      text:
        'TOC',

      tooltip:
        'Create, rebuild, or remove a table of contents',

      fetch:
        (
          callback
        ) => {
          callback([
            {
              type:
                'menuitem',

              text:
                'Create / Rebuild TOC...',

              onAction:
                () => {
                  openCreateTocDialog(
                    editor
                  );
                },
            },

            {
              type:
                'menuitem',

              text:
                'Remove Generated TOC',

              onAction:
                () => {
                  openRemoveTocDialog(
                    editor
                  );
                },
            },
          ]);
        },
    }
  );
}