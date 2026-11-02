import { openGcCleanupDialog } from '../prototype/cleanup-dialog';
import { registerImageFigures } from './image-figures';
import { registerAccessibleToolLabels, installEditorAccessibility } from '../accessibility/modal';
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
  registerLeftRowHeadersButton,
} from './left-row-headers';

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

import {
  registerFootnoteManagerMenu,
  reviewImportedFootnotes,
} from './footnote-manager';

import {
  registerDocumentQaButton,
} from './document-qa';

import {
  registerDownloadLinkButton,
} from './download-link';


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


  const section = (title: string, rows: readonly (readonly [string, number])[]) =>
    `<section><h3>${escapeHtml(title)}</h3><dl>${rows.map(([label, count]) =>
      `<div><dt>${escapeHtml(label)}</dt><dd>${count}</dd></div>`).join('')}</dl></section>`;
  const proposed = changes.filter(([, count]) => count > 0);
  return [
    section('Internal references', [
      ['Internal links', stats.internalLinks], ['Referenced IDs protected', stats.referencedIdsProtected],
      ['Broken internal links', stats.brokenInternalLinks],
    ]),
    section('Footnotes / endnotes', [
      ['References', stats.footnoteReferences], ['Definitions / IDs', stats.footnoteDefinitions],
    ]),
    section('Table of Contents', [
      ['TOC entries found', stats.tocEntriesFound], ['Heading targets found', stats.tocTargetsFound],
      ['TOC labels synchronized', stats.tocLabelsSynchronized], ['Page numbers removed', stats.tocPageNumbersRemoved],
      ['Broken TOC links', stats.brokenTocLinks],
    ]),
    section('Headings', [['Headings found', stats.headings]]),
    proposed.length ? section('Cleanup changes', proposed)
      : '<section><h3>Cleanup changes</h3><p>No automatic cleanup changes are required.</p></section>',
  ].join('');
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


                const footnoteReview =
                  await reviewImportedFootnotes(
                    editor,
                    result.html
                  );


                editor.undoManager.transact(
                  () => {
                    editor.setContent(
                      footnoteReview.html
                    );
                  }
                );


                const importMessage =
                  footnoteReview.converted
                    ? `Imported "${file.name}" successfully. ${footnoteReview.convertedFootnotes} footnote(s) converted to WET-BOEW.`
                    : footnoteReview.detectedFootnotes >
                      0
                      ? `Imported "${file.name}" successfully. Word footnotes were kept in their imported format.`
                      : `Imported "${file.name}" successfully.`;


                editor
                  .notificationManager
                  .open({
                    text:
                      importMessage,

                    type:
                      footnoteReview.warnings.length >
                      0
                        ? 'warning'
                        : 'success',

                    timeout:
                      footnoteReview.warnings.length >
                      0
                        ? 6500
                        : 3500,
                  });


                if (
                  footnoteReview.warnings.length >
                  0
                ) {
                  console.group(
                    'Footnote conversion messages'
                  );


                  footnoteReview.warnings.forEach(
                    (
                      warning
                    ) => {
                      console.warn(
                        warning
                      );
                    }
                  );


                  console.groupEnd();
                }


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


          openGcCleanupDialog(editor, result, createCleanupReport(result));
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

  promotion: false,
  // Keep authored paths intact instead of rewriting them relative to localhost.
  convert_urls: false,
  iframe_aria_text: 'Document HTML editor',
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


  toolbar_mode:
    'floating',


  toolbar_groups: {
    documenttools: {
      text:
        'Document',

      tooltip:
        'Document tools',

      items:
        'importword cleanhtml documentqa imagefigures downloadlink',
    },

    structuretools: {
      text:
        'Structure',

      tooltip:
        'Document structure tools',

      items:
        'sections tocmanager footnotes wetstyles',
    },

    accessibilitytools: {
      text:
        'Accessibility',

      tooltip:
        'Accessibility tools',

      items:
        'tableworkstation tableaccessibility leftrowheaders',
    },

    codetools: {
      text:
        'Code',

      tooltip:
        'Code: HTML source tools',

      items:
        'sourcecodepro code',
    },
  },


  toolbar:
    'undo redo | ' +
    'documenttools structuretools accessibilitytools codetools | ' +
    'blocks | ' +
    'bold italic | ' +
    'bullist numlist | ' +
    'link table | ' +
    'searchreplace visualblocks | ' +
    'fullscreen',


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
      registerAccessibleToolLabels(editor);
      registerImageFigures(editor);
      editor.on('init', () => installEditorAccessibility(editor));
      registerWordImportButton(
        editor
      );


      registerCleanHtmlButton(
        editor
      );


      registerDocumentQaButton(
        editor
      );


      registerDownloadLinkButton(
        editor
      );


      registerHeadingSectionsMenu(
        editor
      );


      registerTableOfContentsMenu(
        editor
      );


      registerFootnoteManagerMenu(
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


      registerLeftRowHeadersButton(
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
