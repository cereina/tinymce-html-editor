import type {
  Editor,
} from 'tinymce';


/* =========================================================
   CONSTANTS
   ========================================================= */


const GENERATED_SECTION_ATTRIBUTE =
  'data-heading-section';

const GENERATED_SECTION_SELECTOR =
  `section[${GENERATED_SECTION_ATTRIBUTE}="true"]`;

const HEADING_SELECTOR =
  'h1, h2, h3, h4, h5, h6';


/**
 * Headings inside these containers
 * must NEVER be used to create
 * automatic heading sections.
 *
 * This includes:
 *
 * NAV
 *   Navigation headings such as the
 *   generated Table of Contents title.
 *
 * ASIDE
 *   Supplementary/sidebar content.
 *
 * TABLE
 *   Table content must never participate
 *   in the document section hierarchy.
 */
const EXCLUDED_HEADING_CONTAINERS =
  'nav, aside, table';


/* =========================================================
   TYPES
   ========================================================= */


interface HeadingJump {
  fromLevel: number;

  toLevel: number;

  fromText: string;

  toText: string;
}


interface SectionAnalysis {
  totalHeadings: number;

  headingCounts:
    Record<
      number,
      number
    >;

  existingGeneratedSections:
    number;

  manualSections:
    number;

  headingsInsideTables:
    number;

  headingsInsideNav:
    number;

  headingsInsideAside:
    number;

  headingJumps:
    HeadingJump[];
}


interface SectionBuildResult {
  sectionsCreated:
    number;

  previousSectionsRemoved:
    number;
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


/**
 * Important:
 *
 * TinyMCE content may live inside
 * an iframe.
 *
 * Therefore we avoid:
 *
 * node instanceof HTMLElement
 *
 * and use nodeType instead.
 */
function isHeading(
  node: Node
): node is HTMLHeadingElement {
  if (
    node.nodeType !==
    1
  ) {
    return false;
  }


  return /^H[1-6]$/i.test(
    (
      node as
        Element
    ).tagName
  );
}


function getHeadingLevel(
  heading:
    HTMLHeadingElement
): number {
  return Number(
    heading.tagName.substring(
      1
    )
  );
}


/* =========================================================
   EXCLUDED CONTAINERS
   ========================================================= */


/**
 * Returns true when the element itself
 * is inside NAV, ASIDE or TABLE.
 *
 * closest() includes the element itself,
 * so this also returns true when element
 * actually IS the NAV / ASIDE / TABLE.
 */
function isInsideExcludedContainer(
  element: Element
): boolean {
  return Boolean(
    element.closest(
      EXCLUDED_HEADING_CONTAINERS
    )
  );
}


/**
 * Determine whether a heading can be
 * processed by the section builder.
 */
function isHeadingEligible(
  heading:
    HTMLHeadingElement
): boolean {
  return (
    !isInsideExcludedContainer(
      heading
    )
  );
}


/**
 * Extra defensive protection.
 *
 * The section builder must never process
 * NAV, ASIDE, TABLE, or something located
 * inside one of those containers.
 */
function isContainerEligible(
  container:
    HTMLElement
): boolean {
  return (
    !isInsideExcludedContainer(
      container
    )
  );
}


/* =========================================================
   EXCLUSION ANALYSIS
   ========================================================= */


function getHeadingExcludedContainer(
  heading:
    HTMLHeadingElement
):
  | 'table'
  | 'nav'
  | 'aside'
  | null {
  /*
   * Check TABLE first.
   */
  if (
    heading.closest(
      'table'
    )
  ) {
    return 'table';
  }


  /*
   * Then NAV.
   *
   * This includes our generated TOC:
   *
   * <nav data-generated-toc="true">
   *   <h2>On this page</h2>
   * </nav>
   */
  if (
    heading.closest(
      'nav'
    )
  ) {
    return 'nav';
  }


  /*
   * Then ASIDE.
   */
  if (
    heading.closest(
      'aside'
    )
  ) {
    return 'aside';
  }


  return null;
}


/* =========================================================
   GENERATED SECTION REMOVAL
   ========================================================= */


/**
 * Remove a generated SECTION wrapper
 * while keeping everything inside it.
 *
 * Before:
 *
 * <section data-heading-section="true">
 *   <h2>Heading</h2>
 *   <p>Text</p>
 * </section>
 *
 * After:
 *
 * <h2>Heading</h2>
 * <p>Text</p>
 */
function unwrapSection(
  section:
    HTMLElement
): void {
  const parent =
    section.parentNode;


  if (
    !parent
  ) {
    return;
  }


  while (
    section.firstChild
  ) {
    parent.insertBefore(
      section.firstChild,
      section
    );
  }


  section.remove();
}


/**
 * Remove every section generated by
 * this tool.
 *
 * IMPORTANT:
 *
 * We deliberately remove generated
 * sections even when they are currently
 * inside NAV / ASIDE / TABLE.
 *
 * This cleans up markup produced by
 * older versions of the tool.
 */
function removeGeneratedSections(
  root:
    HTMLElement
): number {
  const sections =
    Array.from(
      root.querySelectorAll<
        HTMLElement
      >(
        GENERATED_SECTION_SELECTOR
      )
    );


  /*
   * Deepest first.
   *
   * Reverse DOM order works correctly
   * for nested generated sections.
   */
  sections
    .reverse()
    .forEach(
      (
        section
      ) => {
        unwrapSection(
          section
        );
      }
    );


  return sections.length;
}


/* =========================================================
   ELEMENT DEPTH
   ========================================================= */


function getElementDepth(
  element:
    Element
): number {
  let depth =
    0;


  let parent =
    element.parentElement;


  while (
    parent
  ) {
    depth++;

    parent =
      parent.parentElement;
  }


  return depth;
}


/* =========================================================
   HEADING PARENTS
   ========================================================= */


/**
 * Find the containers whose DIRECT
 * children contain eligible headings.
 *
 * NAV, ASIDE and TABLE containers are
 * explicitly blocked.
 */
function getHeadingParents(
  root:
    HTMLElement
): HTMLElement[] {
  const parents =
    new Set<
      HTMLElement
    >();


  const headings =
    Array.from(
      root.querySelectorAll<
        HTMLHeadingElement
      >(
        HEADING_SELECTOR
      )
    );


  headings.forEach(
    (
      heading
    ) => {
      /*
       * Critical check #1:
       *
       * Never use a heading that is
       * inside NAV / ASIDE / TABLE.
       */
      if (
        !isHeadingEligible(
          heading
        )
      ) {
        return;
      }


      const parent =
        heading.parentElement;


      if (
        !parent
      ) {
        return;
      }


      /*
       * Critical check #2:
       *
       * Even if an unexpected DOM
       * structure occurs, never add an
       * excluded parent to the list of
       * containers that can be rebuilt.
       */
      if (
        !isContainerEligible(
          parent
        )
      ) {
        return;
      }


      parents.add(
        parent
      );
    }
  );


  /*
   * Process nested containers first.
   *
   * This preserves manually authored
   * semantic containers.
   */
  return Array.from(
    parents
  ).sort(
    (
      a,
      b
    ) =>
      getElementDepth(
        b
      ) -
      getElementDepth(
        a
      )
  );
}


/* =========================================================
   SECTION BUILDER
   ========================================================= */


interface SectionContext {
  level:
    number;

  section:
    HTMLElement;
}


/**
 * Build generated sections for eligible
 * direct-child headings in one container.
 */
function buildSectionsInContainer(
  container:
    HTMLElement
): number {
  /*
   * Critical check #3:
   *
   * The section builder itself refuses
   * to operate inside:
   *
   * NAV
   * ASIDE
   * TABLE
   *
   * Even if this function were called
   * accidentally with such a container.
   */
  if (
    !isContainerEligible(
      container
    )
  ) {
    return 0;
  }


  const originalNodes =
    Array.from(
      container.childNodes
    );


  const containsEligibleHeading =
    originalNodes.some(
      (
        node
      ) =>
        isHeading(
          node
        ) &&
        isHeadingEligible(
          node
        )
    );


  if (
    !containsEligibleHeading
  ) {
    return 0;
  }


  const document =
    container.ownerDocument;


  const fragment =
    document.createDocumentFragment();


  const stack:
    SectionContext[] =
    [];


  let sectionsCreated =
    0;


  originalNodes.forEach(
    (
      node
    ) => {
      /*
       * Normal content.
       *
       * This includes:
       *
       * <nav>
       * <aside>
       * <table>
       *
       * These elements can be moved as
       * WHOLE content nodes when they
       * belong to a normal heading's
       * section.
       *
       * However their internal headings
       * are never processed.
       */
      if (
        !isHeading(
          node
        ) ||
        !isHeadingEligible(
          node
        )
      ) {
        const current =
          stack[
            stack.length -
              1
          ];


        if (
          current
        ) {
          current
            .section
            .appendChild(
              node
            );
        } else {
          fragment.appendChild(
            node
          );
        }


        return;
      }


      const level =
        getHeadingLevel(
          node
        );


      /*
       * Same level:
       *
       * H2 → H2
       *
       * closes the previous H2.
       *
       * Higher level:
       *
       * H3 → H2
       *
       * closes the H3 and H2 hierarchy
       * as required.
       */
      while (
        stack.length >
          0 &&
        level <=
          stack[
            stack.length -
              1
          ].level
      ) {
        stack.pop();
      }


      const section =
        document.createElement(
          'section'
        );


      section.setAttribute(
        GENERATED_SECTION_ATTRIBUTE,
        'true'
      );


      const parentContext =
        stack[
          stack.length -
            1
        ];


      if (
        parentContext
      ) {
        parentContext
          .section
          .appendChild(
            section
          );
      } else {
        fragment.appendChild(
          section
        );
      }


      /*
       * Move the ORIGINAL heading.
       *
       * We don't recreate it.
       *
       * Therefore these remain intact:
       *
       * id
       * class
       * data attributes
       * Word bookmarks
       * accessibility attributes
       */
      section.appendChild(
        node
      );


      stack.push({
        level,

        section,
      });


      sectionsCreated++;
    }
  );


  container.replaceChildren(
    fragment
  );


  return sectionsCreated;
}


/* =========================================================
   REBUILD ALL SECTIONS
   ========================================================= */


function rebuildHeadingSections(
  root:
    HTMLElement
): SectionBuildResult {
  /*
   * First remove ALL previously generated
   * section wrappers.
   *
   * This also repairs an old malformed
   * TOC such as:
   *
   * <nav>
   *   <section data-heading-section>
   *     <h2>On this page</h2>
   *   </section>
   * </nav>
   *
   * back to:
   *
   * <nav>
   *   <h2>On this page</h2>
   * </nav>
   */
  const previousSectionsRemoved =
    removeGeneratedSections(
      root
    );


  /*
   * Now discover only eligible
   * heading containers.
   */
  const parents =
    getHeadingParents(
      root
    );


  let sectionsCreated =
    0;


  parents.forEach(
    (
      parent
    ) => {
      sectionsCreated +=
        buildSectionsInContainer(
          parent
        );
    }
  );


  return {
    sectionsCreated,

    previousSectionsRemoved,
  };
}


/* =========================================================
   ANALYSIS ROOT
   ========================================================= */


function createAnalysisRoot(
  root:
    HTMLElement
): HTMLElement {
  const clone =
    root.cloneNode(
      true
    ) as HTMLElement;


  /*
   * Analyze content as if all generated
   * section wrappers had been removed.
   */
  removeGeneratedSections(
    clone
  );


  return clone;
}


/* =========================================================
   HEADING JUMP ANALYSIS
   ========================================================= */


function findHeadingJumps(
  root:
    HTMLElement
): HeadingJump[] {
  const jumps:
    HeadingJump[] =
    [];


  const parents =
    getHeadingParents(
      root
    );


  parents.forEach(
    (
      parent
    ) => {
      /*
       * Defensive protection.
       */
      if (
        !isContainerEligible(
          parent
        )
      ) {
        return;
      }


      const headings =
        Array.from(
          parent.children
        ).filter(
          (
            child
          ): child is
            HTMLHeadingElement => {
            if (
              !/^H[1-6]$/i.test(
                child.tagName
              )
            ) {
              return false;
            }


            return isHeadingEligible(
              child as
                HTMLHeadingElement
            );
          }
        );


      let previous:
        HTMLHeadingElement | null =
        null;


      headings.forEach(
        (
          heading
        ) => {
          if (
            previous
          ) {
            const previousLevel =
              getHeadingLevel(
                previous
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
              jumps.push({
                fromLevel:
                  previousLevel,

                toLevel:
                  currentLevel,

                fromText:
                  normalizeText(
                    previous
                      .textContent ??
                      ''
                  ) ||
                  '(empty heading)',

                toText:
                  normalizeText(
                    heading
                      .textContent ??
                      ''
                  ) ||
                  '(empty heading)',
              });
            }
          }


          previous =
            heading;
        }
      );
    }
  );


  return jumps;
}


/* =========================================================
   SECTION ANALYSIS
   ========================================================= */


function analyzeHeadingSections(
  root:
    HTMLElement
): SectionAnalysis {
  const analysisRoot =
    createAnalysisRoot(
      root
    );


  const allHeadings =
    Array.from(
      analysisRoot
        .querySelectorAll<
          HTMLHeadingElement
        >(
          HEADING_SELECTOR
        )
    );


  const eligibleHeadings =
    allHeadings.filter(
      (
        heading
      ) =>
        isHeadingEligible(
          heading
        )
    );


  let headingsInsideTables =
    0;


  let headingsInsideNav =
    0;


  let headingsInsideAside =
    0;


  allHeadings.forEach(
    (
      heading
    ) => {
      const excluded =
        getHeadingExcludedContainer(
          heading
        );


      switch (
        excluded
      ) {
        case 'table':
          headingsInsideTables++;
          break;


        case 'nav':
          headingsInsideNav++;
          break;


        case 'aside':
          headingsInsideAside++;
          break;
      }
    }
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


  eligibleHeadings.forEach(
    (
      heading
    ) => {
      const level =
        getHeadingLevel(
          heading
        );


      headingCounts[
        level
      ]++;
    }
  );


  const existingGeneratedSections =
    root.querySelectorAll(
      GENERATED_SECTION_SELECTOR
    ).length;


  const manualSections =
    Array.from(
      root.querySelectorAll(
        'section'
      )
    ).filter(
      (
        section
      ) =>
        section.getAttribute(
          GENERATED_SECTION_ATTRIBUTE
        ) !==
        'true'
    ).length;


  return {
    totalHeadings:
      eligibleHeadings.length,

    headingCounts,

    existingGeneratedSections,

    manualSections,

    headingsInsideTables,

    headingsInsideNav,

    headingsInsideAside,

    headingJumps:
      findHeadingJumps(
        analysisRoot
      ),
  };
}


/* =========================================================
   BUILD REPORT
   ========================================================= */


function createBuildReport(
  analysis:
    SectionAnalysis
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
                padding-left: 24px;
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


  const excluded:
    string[] = [];


  if (
    analysis
      .headingsInsideNav >
    0
  ) {
    excluded.push(
      `${analysis.headingsInsideNav} heading(s) inside NAV`
    );
  }


  if (
    analysis
      .headingsInsideAside >
    0
  ) {
    excluded.push(
      `${analysis.headingsInsideAside} heading(s) inside ASIDE`
    );
  }


  if (
    analysis
      .headingsInsideTables >
    0
  ) {
    excluded.push(
      `${analysis.headingsInsideTables} heading(s) inside TABLE`
    );
  }


  const excludedHtml =
    excluded.length >
    0
      ? `
        <div
          style="
            margin-top: 16px;
            padding: 14px;
            background: #eef5ff;
            border-radius: 6px;
          "
        >
          <strong>
            Excluded from section generation
          </strong>

          <ul
            style="
              margin-bottom: 0;
            "
          >
            ${excluded
              .map(
                (
                  item
                ) => `
                  <li>
                    ${escapeHtml(
                      item
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
      : '';


  const jumpsHtml =
    analysis
      .headingJumps
      .length >
    0
      ? `
        <div
          style="
            margin-top: 16px;
            padding: 14px;
            background: #fff8e5;
            border-radius: 6px;
          "
        >
          <strong>
            Heading structure warnings
          </strong>

          <ul
            style="
              margin-bottom: 0;
            "
          >
            ${analysis
              .headingJumps
              .map(
                (
                  jump
                ) => `
                  <li>
                    H${jump.fromLevel}
                    →
                    H${jump.toLevel}:

                    “${escapeHtml(
                      jump.fromText
                    )}”

                    →

                    “${escapeHtml(
                      jump.toText
                    )}”
                  </li>
                `
              )
              .join(
                ''
              )}
          </ul>

          <p
            style="
              margin-bottom: 0;
            "
          >
            Heading levels will not
            be changed automatically.
          </p>
        </div>
      `
      : `
        <div
          style="
            margin-top: 16px;
            padding: 14px;
            background: #eef8f0;
            border-radius: 6px;
          "
        >
          No heading-level jumps detected
          among eligible headings.
        </div>
      `;


  return `
    <div>

      <h3
        style="
          margin-top: 0;
        "
      >
        Heading Sections
      </h3>

      <p>
        Eligible document headings will
        receive generated semantic section
        wrappers.
      </p>

      <table>

        <tr>
          <td>
            Eligible headings
          </td>

          <td
            style="
              padding-left: 24px;
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
            Existing generated sections
          </td>

          <td
            style="
              padding-left: 24px;
              text-align: right;
              font-weight: 700;
            "
          >
            ${
              analysis
                .existingGeneratedSections
            }
          </td>
        </tr>

        <tr>
          <td>
            Manual sections preserved
          </td>

          <td
            style="
              padding-left: 24px;
              text-align: right;
              font-weight: 700;
            "
          >
            ${analysis.manualSections}
          </td>
        </tr>

      </table>

      ${excludedHtml}

      ${jumpsHtml}

      <div
        style="
          margin-top: 16px;
          padding: 14px;
          background: #f5f6f8;
          border-radius: 6px;
        "
      >
        <strong>
          Protected containers
        </strong>

        <p
          style="
            margin-bottom: 0;
          "
        >
          Headings inside
          <code>&lt;nav&gt;</code>,
          <code>&lt;aside&gt;</code>,
          and
          <code>&lt;table&gt;</code>
          are never wrapped in generated
          sections.
        </p>
      </div>

    </div>
  `;
}


/* =========================================================
   REMOVE REPORT
   ========================================================= */


function createRemoveReport(
  count:
    number
): string {
  return `
    <div>

      <h3
        style="
          margin-top: 0;
        "
      >
        Remove Generated Sections
      </h3>

      <p>
        <strong>
          ${count}
        </strong>

        generated section wrapper(s)
        will be removed.
      </p>

      <p>
        Their contents will remain in
        the document.
      </p>

      <div
        style="
          margin-top: 16px;
          padding: 14px;
          background: #eef5ff;
          border-radius: 6px;
        "
      >
        Navigation, aside, table,
        heading, ID, bookmark, link,
        list and paragraph content
        will be preserved.
      </div>

    </div>
  `;
}


/* =========================================================
   BUILD / REBUILD DIALOG
   ========================================================= */


function openBuildSectionsDialog(
  editor:
    Editor
): void {
  const body =
    editor.getBody();


  const analysis =
    analyzeHeadingSections(
      body
    );


  editor.windowManager.open({
    title:
      'Heading Sections',

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
            createBuildReport(
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
          'Cancel',
      },

      {
        type:
          'submit',

        text:
          analysis
            .existingGeneratedSections >
          0
            ? 'Rebuild Sections'
            : 'Build Sections',

        buttonType:
          'primary',

        enabled:
          analysis.totalHeadings >
          0,
      },
    ],

    onSubmit:
      (
        api
      ) => {
        let result:
          SectionBuildResult = {
            sectionsCreated:
              0,

            previousSectionsRemoved:
              0,
          };


        editor.undoManager.transact(
          () => {
            result =
              rebuildHeadingSections(
                editor.getBody()
              );


            editor.nodeChanged();
          }
        );


        api.close();


        editor.notificationManager.open({
          text:
            `${result.sectionsCreated} heading section(s) created.` +
            (
              result.previousSectionsRemoved >
              0
                ? ` ${result.previousSectionsRemoved} previous generated section(s) removed before rebuilding.`
                : ''
            ),

          type:
            'success',

          timeout:
            4500,
        });
      },
  });
}


/* =========================================================
   REMOVE DIALOG
   ========================================================= */


function openRemoveSectionsDialog(
  editor:
    Editor
): void {
  const body =
    editor.getBody();


  const count =
    body.querySelectorAll(
      GENERATED_SECTION_SELECTOR
    ).length;


  if (
    count ===
    0
  ) {
    editor.notificationManager.open({
      text:
        'No generated heading sections were found.',

      type:
        'info',

      timeout:
        3500,
    });


    return;
  }


  editor.windowManager.open({
    title:
      'Remove Generated Sections',

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
            createRemoveReport(
              count
            ),
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
          'Remove Sections',

        buttonType:
          'primary',
      },
    ],

    onSubmit:
      (
        api
      ) => {
        let removed =
          0;


        editor.undoManager.transact(
          () => {
            removed =
              removeGeneratedSections(
                editor.getBody()
              );


            editor.nodeChanged();
          }
        );


        api.close();


        editor.notificationManager.open({
          text:
            `${removed} generated section(s) removed.`,

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


export function registerHeadingSectionsMenu(
  editor:
    Editor
): void {
  editor.ui.registry.addMenuButton(
    'sections',
    {
      text:
        'Sections',

      tooltip:
        'Build, rebuild, or remove heading sections',

      fetch:
        (
          callback
        ) => {
          callback([
            {
              type:
                'menuitem',

              text:
                'Build / Rebuild Sections',

              onAction:
                () => {
                  openBuildSectionsDialog(
                    editor
                  );
                },
            },

            {
              type:
                'menuitem',

              text:
                'Remove Generated Sections',

              onAction:
                () => {
                  openRemoveSectionsDialog(
                    editor
                  );
                },
            },
          ]);
        },
    }
  );
}