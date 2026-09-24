import tinymce, {
  type Editor,
  type RawEditorOptions,
} from 'tinymce';

import {
  convertWordFileToHtml,
} from '../import/word-import';

import {
  cleanHtml,
  type CleanupResult,
} from '../cleaning/html-cleaner';

import {
  openSourceCodeEditor,
} from './source-code-editor';

import {
  registerTableAccessibilityButton,
} from './table-accessibility';

import {
  registerTableWorkstationMenu,
} from './table-workstation';

import {
  registerHeadingSectionsMenu,
} from './heading-sections';

import {
  registerTableOfContentsMenu,
} from './table-of-contents';

import {
  registerWetStyleManagerMenu,
} from '../wet/wet-style-manager';


// TinyMCE core
import 'tinymce/icons/default/icons.min.js';
import 'tinymce/themes/silver/theme.min.js';
import 'tinymce/models/dom/model.min.js';


// TinyMCE skins
import 'tinymce/skins/ui/oxide/skin.js';
import 'tinymce/skins/ui/oxide/content.js';


// TinyMCE editor content CSS
import 'tinymce/skins/content/default/content.js';


// TinyMCE plugins
import 'tinymce/plugins/advlist';
import 'tinymce/plugins/autolink';
import 'tinymce/plugins/code';
import 'tinymce/plugins/fullscreen';
import 'tinymce/plugins/link';
import 'tinymce/plugins/lists';
import 'tinymce/plugins/searchreplace';
import 'tinymce/plugins/table';
import 'tinymce/plugins/visualblocks';
import 'tinymce/plugins/wordcount';


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


/* =========================================================
   CLEANUP REPORT
   ========================================================= */


function createCleanupReport(
  result: CleanupResult
): string {
  const {
    stats,
  } =
    result;


  const changes = [
    [
      'HTML comments removed',
      stats.commentsRemoved,
    ],

    [
      'Empty elements removed',
      stats.emptyElementsRemoved,
    ],

    [
      'Empty list items removed',
      stats.emptyListItemsRemoved,
    ],

    [
      'Empty lists removed',
      stats.emptyListsRemoved,
    ],

    [
      'Unnecessary spans removed',
      stats.spansUnwrapped,
    ],

    [
      '<b> converted to <strong>',
      stats.boldConverted,
    ],

    [
      '<i> converted to <em>',
      stats.italicConverted,
    ],

    [
      'Strong formatting removed from headings',
      stats.headingFormattingRemoved,
    ],

    [
      'Duplicate formatting removed',
      stats.duplicateFormattingRemoved,
    ],

    [
      'Word classes removed',
      stats.wordClassesRemoved,
    ],

    [
      'Word-specific styles removed',
      stats.wordStylesRemoved,
    ],

    [
      'Bookmarks moved to headings',
      stats.bookmarksMovedToHeadings,
    ],

    [
      'Unused Word bookmarks removed',
      stats.unusedWordBookmarksRemoved,
    ],

    [
      'Duplicate heading bookmarks removed',
      stats.bookmarkAliasesRemoved,
    ],

    [
      'Bookmark links redirected to heading IDs',
      stats.bookmarkReferencesRewritten,
    ],

    [
      'TOC labels synchronized with headings',
      stats.tocLabelsSynchronized,
    ],

    [
      'Word TOC page numbers removed',
      stats.tocPageNumbersRemoved,
    ],

    [
      'TOC title converted to H2',
      stats.tocTitleConverted,
    ],

    [
      'TOC paragraphs converted to list items',
      stats
        .tocParagraphsConvertedToListItems,
    ],

    [
      'Nested TOC lists created',
      stats.tocNestedListsCreated,
    ],
  ] as const;


  const changesHtml =
    changes
      .filter(
        (
          [, count]
        ) =>
          count >
          0
      )
      .map(
        (
          [label, count]
        ) => `
          <tr>
            <td
              style="
                padding:
                  6px 24px 6px 0;
              "
            >
              ${escapeHtml(
                label
              )}
            </td>

            <td
              style="
                padding: 6px;
                font-weight: 700;
                text-align: right;
              "
            >
              ${count}
            </td>
          </tr>
        `
      )
      .join(
        ''
      );


  const warningsHtml =
    result.warnings.length >
    0
      ? `
        <div
          style="
            margin-top: 20px;
            padding: 14px;
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
            ${result.warnings
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
            margin-top: 20px;
            padding: 14px;
            background: #eef8f0;
            border-radius: 6px;
          "
        >
          No structural warnings detected.
        </div>
      `;


  return `
    <div>

      <h3
        style="
          margin-top: 0;
        "
      >
        Internal references
      </h3>

      <table>

        <tr>
          <td>
            Internal links
          </td>

          <td
            style="
              padding-left: 20px;
            "
          >
            <strong>
              ${stats.internalLinks}
            </strong>
          </td>
        </tr>

        <tr>
          <td>
            Referenced IDs protected
          </td>

          <td
            style="
              padding-left: 20px;
            "
          >
            <strong>
              ${stats.referencedIdsProtected}
            </strong>
          </td>
        </tr>

        <tr>
          <td>
            Broken internal links
          </td>

          <td
            style="
              padding-left: 20px;
            "
          >
            <strong>
              ${stats.brokenInternalLinks}
            </strong>
          </td>
        </tr>

      </table>


      <h3>
        Footnotes / endnotes
      </h3>

      <table>

        <tr>
          <td>
            References
          </td>

          <td
            style="
              padding-left: 20px;
            "
          >
            <strong>
              ${stats.footnoteReferences}
            </strong>
          </td>
        </tr>

        <tr>
          <td>
            Definitions / IDs
          </td>

          <td
            style="
              padding-left: 20px;
            "
          >
            <strong>
              ${stats.footnoteDefinitions}
            </strong>
          </td>
        </tr>

      </table>


      <h3>
        Table of Contents
      </h3>

      <table>

        <tr>
          <td>
            TOC entries found
          </td>

          <td
            style="
              padding-left: 20px;
            "
          >
            <strong>
              ${stats.tocEntriesFound}
            </strong>
          </td>
        </tr>

        <tr>
          <td>
            Heading targets found
          </td>

          <td
            style="
              padding-left: 20px;
            "
          >
            <strong>
              ${stats.tocTargetsFound}
            </strong>
          </td>
        </tr>

        <tr>
          <td>
            TOC labels synchronized
          </td>

          <td
            style="
              padding-left: 20px;
            "
          >
            <strong>
              ${stats.tocLabelsSynchronized}
            </strong>
          </td>
        </tr>

        <tr>
          <td>
            Page numbers removed
          </td>

          <td
            style="
              padding-left: 20px;
            "
          >
            <strong>
              ${stats.tocPageNumbersRemoved}
            </strong>
          </td>
        </tr>

        <tr>
          <td>
            Broken TOC links
          </td>

          <td
            style="
              padding-left: 20px;
            "
          >
            <strong>
              ${stats.brokenTocLinks}
            </strong>
          </td>
        </tr>

      </table>


      <h3>
        Headings
      </h3>

      <table>

        <tr>
          <td>
            Headings found
          </td>

          <td
            style="
              padding-left: 20px;
            "
          >
            <strong>
              ${stats.headings}
            </strong>
          </td>
        </tr>

      </table>


      <h3>
        Cleanup changes
      </h3>

      ${
        changesHtml
          ? `
            <table>
              ${changesHtml}
            </table>
          `
          : `
            <p>
              No automatic cleanup
              changes are required.
            </p>
          `
      }

      ${warningsHtml}

    </div>
  `;
}


/* =========================================================
   WORD IMPORT
   ========================================================= */


function registerWordImportButton(
  editor: Editor
): void {
  editor.ui.registry.addButton(
    'importword',
    {
      text:
        'Import Word',

      tooltip:
        'Import a Word document',

      onAction:
        () => {
          const fileInput =
            document.createElement(
              'input'
            );


          fileInput.type =
            'file';


          fileInput.accept =
            '.docx,' +
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document';


          fileInput.addEventListener(
            'change',
            async () => {
              const file =
                fileInput.files?.[
                  0
                ];


              if (
                !file
              ) {
                return;
              }


              editor.setProgressState(
                true
              );


              try {
                const result =
                  await convertWordFileToHtml(
                    file
                  );


                editor.undoManager.transact(
                  () => {
                    editor.setContent(
                      result.html
                    );
                  }
                );


                editor
                  .notificationManager
                  .open({
                    text:
                      `Imported "${file.name}" successfully.`,

                    type:
                      'success',

                    timeout:
                      3000,
                  });


                if (
                  result.messages.length >
                  0
                ) {
                  console.group(
                    'Word import messages'
                  );


                  result.messages.forEach(
                    (
                      message
                    ) => {
                      console.log(
                        message
                      );
                    }
                  );


                  console.groupEnd();
                }


                console.log(
                  'Word import statistics:',
                  result.stats
                );
              } catch (
                error
              ) {
                console.error(
                  'Word import failed:',
                  error
                );


                editor
                  .notificationManager
                  .open({
                    text:
                      error instanceof
                      Error
                        ? error.message
                        : 'Unable to import the Word document.',

                    type:
                      'error',

                    timeout:
                      5000,
                  });
              } finally {
                editor.setProgressState(
                  false
                );


                fileInput.value =
                  '';
              }
            }
          );


          fileInput.click();
        },
    }
  );
}


/* =========================================================
   HTML CLEANUP
   ========================================================= */


function registerCleanHtmlButton(
  editor: Editor
): void {
  editor.ui.registry.addButton(
    'cleanhtml',
    {
      text:
        'Clean HTML',

      tooltip:
        'Analyze and clean the HTML',

      onAction:
        () => {
          const originalHtml =
            editor.getContent({
              format:
                'html',
            });


          const result =
            cleanHtml(
              originalHtml
            );


          editor.windowManager.open({
            title:
              'HTML Cleanup Report',

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
                    createCleanupReport(
                      result
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
                  'Apply cleanup',

                buttonType:
                  'primary',

                enabled:
                  result.hasChanges,
              },
            ],

            onSubmit:
              (
                api
              ) => {
                editor.undoManager.transact(
                  () => {
                    editor.setContent(
                      result.cleanedHtml
                    );
                  }
                );


                api.close();


                editor
                  .notificationManager
                  .open({
                    text:
                      'HTML cleanup completed.',

                    type:
                      'success',

                    timeout:
                      3000,
                  });
              },
          });
        },
    }
  );
}


/* =========================================================
   SOURCE CODE PRO
   ========================================================= */


function registerSourceCodeProButton(
  editor: Editor
): void {
  editor.ui.registry.addButton(
    'sourcecodepro',
    {
      text:
        'Source Code Pro',

      tooltip:
        'Open professional HTML source editor',

      onAction:
        () => {
          openSourceCodeEditor(
            editor
          );
        },
    }
  );
}


/* =========================================================
   TINYMCE CONFIGURATION
   ========================================================= */


const editorConfig:
RawEditorOptions = {
  selector:
    '#editor',

  license_key:
    'gpl',

  height:
    650,


  plugins: [
    'advlist',
    'autolink',
    'code',
    'fullscreen',
    'link',
    'lists',
    'searchreplace',
    'table',
    'visualblocks',
    'wordcount',
  ],


  toolbar:
    'undo redo | ' +
    'importword cleanhtml sections tocmanager wetstyles tableworkstation tableaccessibility sourcecodepro | ' +
    'blocks | ' +
    'bold italic | ' +
    'bullist numlist | ' +
    'link table | ' +
    'searchreplace visualblocks | ' +
    'code fullscreen',


  menubar:
    'file edit view insert format tools table',


  skin_url:
    'default',

  content_css:
    'default',


  setup:
    (
      editor
    ) => {
      registerWordImportButton(
        editor
      );


      registerCleanHtmlButton(
        editor
      );


      registerHeadingSectionsMenu(
        editor
      );


      registerTableOfContentsMenu(
        editor
      );


      registerWetStyleManagerMenu(
        editor
      );


      /*
       * New document-level table
       * workstation.
       */
      registerTableWorkstationMenu(
        editor
      );


      /*
       * Keep the existing detailed
       * single-table accessibility
       * reviewer.
       */
      registerTableAccessibilityButton(
        editor
      );


      registerSourceCodeProButton(
        editor
      );
    },
};


/* =========================================================
   INITIALIZE
   ========================================================= */


export async function initTinyMCE():
Promise<void> {
  await tinymce.init(
    editorConfig
  );
}