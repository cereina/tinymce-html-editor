import type {
  Editor,
} from 'tinymce';

import {
  WET_CLASS_CATEGORY_ORDER,
  getApplicableWetClasses,
  getWetClassDefinition,
  isVerifiedWetClass,
  isWetClassApplicable,
  type WetClassDefinition,
} from './wet-classes';


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
 * Validate a CSS class name.
 */
function isValidClassName(
  value: string
): boolean {
  return /^[A-Za-z_-][A-Za-z0-9_-]*$/.test(
    value
  );
}


/**
 * Convert:
 *
 * "mrgn-tp-md text-center"
 *
 * into:
 *
 * [
 *   "mrgn-tp-md",
 *   "text-center"
 * ]
 */
function parseClassList(
  value: string
): string[] {
  const classes =
    value
      .split(
        /\s+/
      )
      .map(
        (
          item
        ) =>
          item.trim()
      )
      .filter(
        Boolean
      );


  return Array.from(
    new Set(
      classes
    )
  );
}


/* =========================================================
   SELECTED ELEMENT
   ========================================================= */


/**
 * IMPORTANT:
 *
 * TinyMCE normally edits inside an iframe.
 *
 * Because iframe elements belong to a
 * different JavaScript window, this is
 * NOT reliable:
 *
 * node instanceof HTMLElement
 *
 * Instead we test nodeType === 1.
 */
function isElementNode(
  node: Node | null
): node is HTMLElement {
  return Boolean(
    node &&
    node.nodeType ===
      1
  );
}


/**
 * Get the HTML element where the TinyMCE
 * cursor currently exists.
 */
function getSelectedElement(
  editor: Editor
): HTMLElement | null {
  const node =
    editor.selection.getNode();


  if (
    !isElementNode(
      node
    )
  ) {
    return null;
  }


  const element =
    node as HTMLElement;


  /*
   * TinyMCE BODY itself is not part of
   * editor.getContent().
   *
   * Adding classes to BODY would therefore
   * not appear in the exported HTML.
   */
  if (
    element ===
    editor.getBody()
  ) {
    return null;
  }


  return element;
}


/**
 * Describe the selected element.
 *
 * Example:
 *
 * <h2>
 *
 * <p.mrgn-tp-md>
 *
 * <table#contacts.table.table-striped>
 */
function describeElement(
  element: HTMLElement
): string {
  const tag =
    element.tagName
      .toLowerCase();


  const id =
    element.id
      ? `#${element.id}`
      : '';


  const classes =
    Array.from(
      element.classList
    )
      .map(
        (
          className
        ) =>
          `.${className}`
      )
      .join(
        ''
      );


  return (
    `<${tag}${id}${classes}>`
  );
}


/**
 * Return a short preview of the
 * selected element's text.
 */
function getElementTextPreview(
  element: HTMLElement
): string {
  const text =
    normalizeText(
      element.textContent ??
        ''
    );


  if (
    text.length <=
    100
  ) {
    return text;
  }


  return (
    `${text.substring(
      0,
      97
    )}...`
  );
}


/* =========================================================
   CLASS CATALOGUE FOR CURRENT ELEMENT
   ========================================================= */


/**
 * Get the WET / GCWeb classes that
 * should appear for the selected element.
 *
 * We include:
 *
 * 1. Classes normally appropriate for
 *    the selected element.
 *
 * 2. Existing verified WET classes already
 *    present, even if they appear to be on
 *    the wrong element.
 *
 * This makes it possible to remove an
 * incorrect existing class.
 */
function getManagedDefinitions(
  element: HTMLElement
): WetClassDefinition[] {
  const tagName =
    element.tagName
      .toLowerCase();


  const definitions =
    new Map<
      string,
      WetClassDefinition
    >();


  /*
   * Normally applicable classes.
   */
  getApplicableWetClasses(
    tagName
  ).forEach(
    (
      definition
    ) => {
      definitions.set(
        definition.name,
        definition
      );
    }
  );


  /*
   * Also include existing known classes.
   */
  Array.from(
    element.classList
  ).forEach(
    (
      className
    ) => {
      const definition =
        getWetClassDefinition(
          className
        );


      if (
        definition
      ) {
        definitions.set(
          definition.name,
          definition
        );
      }
    }
  );


  return Array.from(
    definitions.values()
  );
}


/* =========================================================
   CHECKBOX DATA
   ========================================================= */


interface ClassCheckboxEntry {
  fieldName: string;

  definition:
    WetClassDefinition;
}


function createCheckboxFieldName(
  index: number
): string {
  return (
    `wetClass${index}`
  );
}


/* =========================================================
   REQUIRED CLASSES
   ========================================================= */


/**
 * Add required companion classes.
 *
 * Example:
 *
 * table-striped
 *
 * automatically adds:
 *
 * table
 *
 *
 * btn-primary
 *
 * automatically adds:
 *
 * btn
 */
function addRequiredClasses(
  classes: Set<string>
): void {
  let changed =
    true;


  while (
    changed
  ) {
    changed =
      false;


    Array.from(
      classes
    ).forEach(
      (
        className
      ) => {
        const definition =
          getWetClassDefinition(
            className
          );


        definition
          ?.requires
          ?.forEach(
            (
              requiredClass
            ) => {
              if (
                !classes.has(
                  requiredClass
                )
              ) {
                classes.add(
                  requiredClass
                );


                changed =
                  true;
              }
            }
          );
      }
    );
  }
}


/* =========================================================
   CONFLICT VALIDATION
   ========================================================= */


interface ClassConflict {
  group: string;

  classes: string[];
}


/**
 * Detect combinations that should
 * normally not exist together.
 *
 * Example:
 *
 * mrgn-tp-sm
 * mrgn-tp-lg
 *
 * or:
 *
 * btn-primary
 * btn-danger
 */
function findClassConflicts(
  selectedClasses:
    Set<string>
): ClassConflict[] {
  const groups =
    new Map<
      string,
      string[]
    >();


  selectedClasses.forEach(
    (
      className
    ) => {
      const definition =
        getWetClassDefinition(
          className
        );


      const group =
        definition
          ?.exclusiveGroup;


      if (
        !group
      ) {
        return;
      }


      const classes =
        groups.get(
          group
        ) ??
        [];


      classes.push(
        className
      );


      groups.set(
        group,
        classes
      );
    }
  );


  return Array.from(
    groups.entries()
  )
    .filter(
      (
        [, classes]
      ) =>
        classes.length >
        1
    )
    .map(
      (
        [
          group,
          classes,
        ]
      ) => ({
        group,
        classes,
      })
    );
}


/* =========================================================
   WET JAVASCRIPT PLUGINS
   ========================================================= */


function getSelectedPluginClasses(
  classes: Set<string>
): WetClassDefinition[] {
  return Array.from(
    classes
  )
    .map(
      (
        className
      ) =>
        getWetClassDefinition(
          className
        )
    )
    .filter(
      (
        definition
      ): definition is
        WetClassDefinition =>
        Boolean(
          definition
            ?.requiresJavaScript
        )
    );
}


/* =========================================================
   SELECTED ELEMENT REPORT
   ========================================================= */


function createElementReport(
  element: HTMLElement,
  managedDefinitions:
    WetClassDefinition[]
): string {
  const tagName =
    element.tagName
      .toLowerCase();


  const existingClasses =
    Array.from(
      element.classList
    );


  const verifiedCount =
    existingClasses.filter(
      isVerifiedWetClass
    ).length;


  const customCount =
    existingClasses.length -
    verifiedCount;


  const preview =
    getElementTextPreview(
      element
    );


  /*
   * Detect known WET classes that already
   * exist on the selected element but are
   * not normally appropriate for that tag.
   */
  const outOfContext =
    managedDefinitions.filter(
      (
        definition
      ) =>
        element.classList
          .contains(
            definition.name
          ) &&
        !isWetClassApplicable(
          definition,
          tagName
        )
    );


  const outOfContextHtml =
    outOfContext.length >
    0
      ? `
        <div
          style="
            margin-top: 14px;
            padding: 12px;
            background: #fff8e5;
            border-radius: 6px;
          "
        >
          <strong>
            Review existing classes
          </strong>

          <p
            style="
              margin-bottom: 0;
            "
          >
            The following verified
            class(es) already exist on
            this element but are not
            normally recommended for
            &lt;${escapeHtml(
              tagName
            )}&gt;:

            ${outOfContext
              .map(
                (
                  definition
                ) =>
                  `<code>${escapeHtml(
                    definition.name
                  )}</code>`
              )
              .join(
                ', '
              )}
          </p>
        </div>
      `
      : '';


  return `
    <div>

      <h3
        style="
          margin-top: 0;
        "
      >
        Selected element
      </h3>

      <div
        style="
          margin-bottom: 12px;
          padding: 10px 12px;
          background: #f5f6f8;
          border-radius: 6px;
        "
      >
        <code>
          ${escapeHtml(
            describeElement(
              element
            )
          )}
        </code>
      </div>

      ${
        preview
          ? `
            <p>
              <strong>
                Content:
              </strong>

              ${escapeHtml(
                preview
              )}
            </p>
          `
          : ''
      }

      <table>

        <tr>
          <td>
            HTML element
          </td>

          <td
            style="
              padding-left: 20px;
            "
          >
            <strong>
              &lt;${escapeHtml(
                tagName
              )}&gt;
            </strong>
          </td>
        </tr>

        <tr>
          <td>
            Existing classes
          </td>

          <td
            style="
              padding-left: 20px;
            "
          >
            <strong>
              ${existingClasses.length}
            </strong>
          </td>
        </tr>

        <tr>
          <td>
            Verified WET / GCWeb classes
          </td>

          <td
            style="
              padding-left: 20px;
            "
          >
            <strong>
              ${verifiedCount}
            </strong>
          </td>
        </tr>

        <tr>
          <td>
            Other / custom classes
          </td>

          <td
            style="
              padding-left: 20px;
            "
          >
            <strong>
              ${customCount}
            </strong>
          </td>
        </tr>

      </table>

      ${outOfContextHtml}

    </div>
  `;
}


/* =========================================================
   CLASS MANAGER DIALOG
   ========================================================= */


function openWetClassManager(
  editor: Editor,
  element: HTMLElement
): void {
  const managedDefinitions =
    getManagedDefinitions(
      element
    );


  const existingClasses =
    Array.from(
      element.classList
    );


  /*
   * Existing classes that are not part
   * of our verified catalogue.
   */
  const customClasses =
    existingClasses.filter(
      (
        className
      ) =>
        !isVerifiedWetClass(
          className
        )
    );


  const checkboxEntries:
    ClassCheckboxEntry[] =
    managedDefinitions.map(
      (
        definition,
        index
      ) => ({
        fieldName:
          createCheckboxFieldName(
            index
          ),

        definition,
      })
    );


  /*
   * TinyMCE's dialog item type becomes
   * restrictive when dynamically creating
   * many checkbox fields.
   *
   * We intentionally use any[] here.
   */
  const items:
    any[] = [
      {
        type:
          'htmlpanel',

        html:
          createElementReport(
            element,
            managedDefinitions
          ),
      },
    ];


  /* -------------------------------------------------------
     VERIFIED WET CLASSES BY CATEGORY
     ------------------------------------------------------- */


  WET_CLASS_CATEGORY_ORDER.forEach(
    (
      category
    ) => {
      const categoryEntries =
        checkboxEntries.filter(
          (
            entry
          ) =>
            entry.definition
              .category ===
            category
        );


      if (
        categoryEntries.length ===
        0
      ) {
        return;
      }


      items.push({
        type:
          'htmlpanel',

        html:
          `
            <h3
              style="
                margin-top: 20px;
                margin-bottom: 8px;
              "
            >
              ${escapeHtml(
                category
              )}
            </h3>
          `,
      });


      categoryEntries.forEach(
        (
          entry
        ) => {
          const definition =
            entry.definition;


          const normallyApplicable =
            isWetClassApplicable(
              definition,
              element.tagName
                .toLowerCase()
            );


          const pluginLabel =
            definition
              .requiresJavaScript
              ? ' [WET JavaScript]'
              : '';


          const contextLabel =
            normallyApplicable
              ? ''
              : ' [Existing class — review]';


          items.push({
            type:
              'checkbox',

            name:
              entry.fieldName,

            label:
              `${definition.name} — ${definition.label}${pluginLabel}${contextLabel}`,
          });


          /*
           * Show special caution text when
           * the class is already active.
           */
          if (
            definition.caution &&
            element.classList
              .contains(
                definition.name
              )
          ) {
            items.push({
              type:
                'htmlpanel',

              html:
                `
                  <p
                    style="
                      margin:
                        -4px 0 8px 28px;
                      font-size: 0.9em;
                    "
                  >
                    ${escapeHtml(
                      definition.caution
                    )}
                  </p>
                `,
            });
          }
        }
      );
    }
  );


  /* -------------------------------------------------------
     CUSTOM CLASSES
     ------------------------------------------------------- */


  items.push({
    type:
      'htmlpanel',

    html:
      `
        <h3
          style="
            margin-top: 20px;
            margin-bottom: 8px;
          "
        >
          Custom / other classes
        </h3>

        <p>
          Enter additional class names
          separated by spaces.
        </p>

        <p>
          These custom classes are preserved,
          but are not automatically verified
          against the WET / GCWeb catalogue.
        </p>
      `,
  });


  items.push({
    type:
      'input',

    name:
      'customClasses',

    label:
      'Other class names',

    placeholder:
      'example-class another-class',
  });


  /* -------------------------------------------------------
     INITIAL DATA
     ------------------------------------------------------- */


  const initialData:
    Record<
      string,
      string | boolean
    > = {
      customClasses:
        customClasses.join(
          ' '
        ),
    };


  checkboxEntries.forEach(
    (
      entry
    ) => {
      initialData[
        entry.fieldName
      ] =
        element.classList
          .contains(
            entry.definition
              .name
          );
    }
  );


  /* -------------------------------------------------------
     OPEN DIALOG
     ------------------------------------------------------- */


  editor.windowManager.open({
    title:
      'WET / GCWeb Class Manager',

    size:
      'medium',

    body: {
      type:
        'panel',

      items,
    },

    initialData,

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
          'Apply classes',

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


        const selectedVerified =
          new Set<string>();


        /*
         * Read selected verified classes.
         */
        checkboxEntries.forEach(
          (
            entry
          ) => {
            if (
              data[
                entry.fieldName
              ] ===
              true
            ) {
              selectedVerified.add(
                entry.definition
                  .name
              );
            }
          }
        );


        /*
         * Read custom classes.
         */
        const rawCustomClasses =
          typeof data
            .customClasses ===
            'string'
            ? data.customClasses
            : '';


        const typedClasses =
          parseClassList(
            rawCustomClasses
          );


        /*
         * Validate custom class names.
         */
        const invalidClasses =
          typedClasses.filter(
            (
              className
            ) =>
              !isValidClassName(
                className
              )
          );


        if (
          invalidClasses.length >
          0
        ) {
          editor
            .notificationManager
            .open({
              text:
                `Invalid class name(s): ${invalidClasses.join(
                  ', '
                )}`,

              type:
                'error',

              timeout:
                5000,
            });


          return;
        }


        const finalCustomClasses =
          new Set<string>();


        /*
         * If a verified class was manually
         * typed into the custom field,
         * move it into the verified set.
         */
        typedClasses.forEach(
          (
            className
          ) => {
            if (
              isVerifiedWetClass(
                className
              )
            ) {
              selectedVerified.add(
                className
              );
            } else {
              finalCustomClasses.add(
                className
              );
            }
          }
        );


        /*
         * Add dependencies.
         *
         * Example:
         *
         * table-striped
         *
         * automatically adds:
         *
         * table
         */
        addRequiredClasses(
          selectedVerified
        );


        /*
         * Detect mutually exclusive classes.
         */
        const conflicts =
          findClassConflicts(
            selectedVerified
          );


        if (
          conflicts.length >
          0
        ) {
          const conflictText =
            conflicts
              .map(
                (
                  conflict
                ) =>
                  conflict.classes
                    .join(
                      ' + '
                    )
              )
              .join(
                '; '
              );


          editor
            .notificationManager
            .open({
              text:
                `Conflicting WET classes selected: ${conflictText}`,

              type:
                'error',

              timeout:
                6000,
            });


          return;
        }


        /*
         * Combine verified and custom
         * classes.
         */
        const finalClasses =
          new Set<string>();


        selectedVerified.forEach(
          (
            className
          ) => {
            finalClasses.add(
              className
            );
          }
        );


        finalCustomClasses.forEach(
          (
            className
          ) => {
            finalClasses.add(
              className
            );
          }
        );


        const finalClassValue =
          Array.from(
            finalClasses
          ).join(
            ' '
          );


        /*
         * Apply using TinyMCE undo manager.
         */
        editor.undoManager.transact(
          () => {
            if (
              finalClassValue
            ) {
              editor.dom.setAttrib(
                element,
                'class',
                finalClassValue
              );
            } else {
              editor.dom.setAttrib(
                element,
                'class',
                null
              );
            }


            editor.nodeChanged();
          }
        );


        api.close();


        /*
         * Warn for JavaScript-enabled
         * WET plugins.
         */
        const pluginClasses =
          getSelectedPluginClasses(
            selectedVerified
          );


        if (
          pluginClasses.length >
          0
        ) {
          editor
            .notificationManager
            .open({
              text:
                `Classes applied. WET JavaScript is required for: ${pluginClasses
                  .map(
                    (
                      definition
                    ) =>
                      definition.name
                  )
                  .join(
                    ', '
                  )}.`,

              type:
                'warning',

              timeout:
                6000,
            });


          return;
        }


        editor
          .notificationManager
          .open({
            text:
              `Classes applied to <${element.tagName.toLowerCase()}>.`,

            type:
              'success',

            timeout:
              3500,
          });
      },
  });
}


/* =========================================================
   REMOVE ALL CLASSES
   ========================================================= */


function removeAllClassesFromSelectedElement(
  editor: Editor,
  element: HTMLElement
): void {
  if (
    !element.hasAttribute(
      'class'
    )
  ) {
    editor
      .notificationManager
      .open({
        text:
          `The selected <${element.tagName.toLowerCase()}> element has no classes.`,

        type:
          'info',

        timeout:
          3000,
      });


    return;
  }


  const classes =
    element.getAttribute(
      'class'
    ) ??
    '';


  editor.windowManager.confirm(
    `Remove all classes from <${element.tagName.toLowerCase()}>?\n\nCurrent classes: ${classes}`,
    (
      confirmed
    ) => {
      if (
        !confirmed
      ) {
        return;
      }


      editor.undoManager.transact(
        () => {
          editor.dom.setAttrib(
            element,
            'class',
            null
          );


          editor.nodeChanged();
        }
      );


      editor
        .notificationManager
        .open({
          text:
            `Classes removed from <${element.tagName.toLowerCase()}>.`,

          type:
            'success',

          timeout:
            3000,
        });
    }
  );
}


/* =========================================================
   OPEN MANAGER
   ========================================================= */


function openManagerForSelection(
  editor: Editor
): void {
  const element =
    getSelectedElement(
      editor
    );


  if (
    !element
  ) {
    editor
      .notificationManager
      .open({
        text:
          'Place the cursor inside a paragraph, heading, section, table, list, link, or another HTML element before opening WET Styles.',

        type:
          'info',

        timeout:
          4500,
      });


    return;
  }


  openWetClassManager(
    editor,
    element
  );
}


/* =========================================================
   TINYMCE TOOLBAR MENU
   ========================================================= */


export function registerWetStyleManagerMenu(
  editor: Editor
): void {
  editor.ui.registry.addMenuButton(
    'wetstyles',
    {
      text:
        'WET Styles',

      tooltip:
        'Manage WET / GCWeb classes',

      fetch:
        (
          callback
        ) => {
          callback([
            {
              type:
                'menuitem',

              text:
                'Manage WET / GCWeb classes...',

              onAction:
                () => {
                  openManagerForSelection(
                    editor
                  );
                },
            },

            {
              type:
                'menuitem',

              text:
                'Remove all classes from selected element',

              onAction:
                () => {
                  const element =
                    getSelectedElement(
                      editor
                    );


                  if (
                    !element
                  ) {
                    editor
                      .notificationManager
                      .open({
                        text:
                          'Place the cursor inside an HTML element first.',

                        type:
                          'info',

                        timeout:
                          3500,
                      });


                    return;
                  }


                  removeAllClassesFromSelectedElement(
                    editor,
                    element
                  );
                },
            },
          ]);
        },
    }
  );
}