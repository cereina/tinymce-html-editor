import type {
  Editor,
} from 'tinymce';

import {
  basicSetup,
} from 'codemirror';

import {
  EditorState,
} from '@codemirror/state';

import {
  EditorView,
} from '@codemirror/view';

import {
  html,
} from '@codemirror/lang-html';

import {
  oneDark,
} from '@codemirror/theme-one-dark';

import * as prettier from 'prettier/standalone';

import * as prettierPluginHtml
  from 'prettier/plugins/html';

import './source-code-editor.css';


/* =========================================================
   CONSTANTS
   ========================================================= */


const FORMAT_ON_OPEN_STORAGE_KEY =
  'source-code-pro-format-on-open';

const TAB_WIDTH_STORAGE_KEY =
  'source-code-pro-tab-width';


/* =========================================================
   STATE
   ========================================================= */


let activeSourceEditorClose:
  (() => void) | null =
  null;


/* =========================================================
   TYPES
   ========================================================= */


interface FormatOptions {
  tabWidth:
    number;

  rangeStart?:
    number;

  rangeEnd?:
    number;
}


/* =========================================================
   SETTINGS
   ========================================================= */


function getFormatOnOpenSetting():
boolean {
  try {
    return (
      localStorage.getItem(
        FORMAT_ON_OPEN_STORAGE_KEY
      ) ===
      'true'
    );
  } catch {
    return false;
  }
}


function setFormatOnOpenSetting(
  enabled: boolean
): void {
  try {
    localStorage.setItem(
      FORMAT_ON_OPEN_STORAGE_KEY,
      String(
        enabled
      )
    );
  } catch {
    /*
     * Local storage is optional.
     *
     * The feature still works during
     * the current Source Code Pro
     * session if storage is unavailable.
     */
  }
}


function getTabWidthSetting():
number {
  try {
    const stored =
      Number(
        localStorage.getItem(
          TAB_WIDTH_STORAGE_KEY
        )
      );


    if (
      stored === 4
    ) {
      return 4;
    }
  } catch {
    /*
     * Ignore storage errors.
     */
  }


  return 2;
}


function setTabWidthSetting(
  tabWidth: number
): void {
  try {
    localStorage.setItem(
      TAB_WIDTH_STORAGE_KEY,
      String(
        tabWidth
      )
    );
  } catch {
    /*
     * Ignore storage errors.
     */
  }
}


/* =========================================================
   HTML FORMATTING
   ========================================================= */


/**
 * Format HTML using Prettier.
 *
 * This is intentionally separate from
 * the Clean HTML feature.
 *
 * Formatting is concerned with:
 *
 * - indentation
 * - line wrapping
 * - attribute layout
 * - readable source
 *
 * It is NOT intended to:
 *
 * - remove elements
 * - remove IDs
 * - remove classes
 * - repair accessibility
 * - change heading levels
 * - rebuild sections
 * - rebuild TOCs
 */
async function formatHtml(
  source: string,
  options:
    FormatOptions
): Promise<string> {
  return prettier.format(
    source,
    {
      parser:
        'html',

      plugins: [
        prettierPluginHtml,
      ],

      tabWidth:
        options.tabWidth,

      useTabs:
        false,

      printWidth:
        100,

      /*
       * Keep normal HTML whitespace
       * behaviour rather than treating
       * every element as whitespace
       * insensitive.
       */
      htmlWhitespaceSensitivity:
        'css',

      /*
       * Do not automatically wrap all
       * attributes merely because an
       * element has several of them.
       */
      singleAttributePerLine:
        false,

      rangeStart:
        options.rangeStart,

      rangeEnd:
        options.rangeEnd,
    }
  );
}


/* =========================================================
   ERROR TEXT
   ========================================================= */


function getErrorMessage(
  error: unknown
): string {
  if (
    error instanceof
    Error
  ) {
    return error.message;
  }


  return (
    'Unable to format the HTML.'
  );
}


/* =========================================================
   STATUS
   ========================================================= */


function getCursorStatus(
  view: EditorView
): string {
  const selection =
    view.state.selection.main;


  const position =
    selection.head;


  const line =
    view.state.doc.lineAt(
      position
    );


  const column =
    position -
    line.from +
    1;


  if (
    selection.empty
  ) {
    return (
      `Line ${line.number}, Column ${column}`
    );
  }


  const selectedCharacters =
    Math.abs(
      selection.to -
      selection.from
    );


  return (
    `Line ${line.number}, Column ${column} · ${selectedCharacters} selected`
  );
}


/* =========================================================
   REPLACE CODEMIRROR DOCUMENT
   ========================================================= */


function replaceEditorContent(
  view: EditorView,
  newSource: string,
  preferredAnchor?: number,
  preferredHead?: number
): void {
  const oldSelection =
    view.state.selection.main;


  const anchor =
    preferredAnchor ??
    oldSelection.anchor;


  const head =
    preferredHead ??
    oldSelection.head;


  const safeAnchor =
    Math.min(
      Math.max(
        0,
        anchor
      ),
      newSource.length
    );


  const safeHead =
    Math.min(
      Math.max(
        0,
        head
      ),
      newSource.length
    );


  view.dispatch({
    changes: {
      from:
        0,

      to:
        view.state.doc.length,

      insert:
        newSource,
    },

    selection: {
      anchor:
        safeAnchor,

      head:
        safeHead,
    },

    scrollIntoView:
      true,
  });
}


/* =========================================================
   SOURCE CODE PRO
   ========================================================= */


export function openSourceCodeEditor(
  editor: Editor
): void {
  /*
   * Prevent multiple Source Code Pro
   * windows from being open at once.
   */
  if (
    activeSourceEditorClose
  ) {
    activeSourceEditorClose();
  }


  const originalHtml =
    editor.getContent({
      format:
        'html',
    });


  const previousBodyOverflow =
    document.body
      .style
      .overflow;


  document.body
    .style
    .overflow =
    'hidden';


  /* =======================================================
     BACKDROP
     ======================================================= */


  const backdrop =
    document.createElement(
      'div'
    );


  backdrop.className =
    'scp-backdrop';


  backdrop.innerHTML = `
    <div
      class="scp-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scp-title"
    >

      <header class="scp-header">

        <div>

          <h1 id="scp-title">
            Source Code Pro
          </h1>

          <p>
            Edit and format the HTML source.
          </p>

        </div>

        <button
          type="button"
          class="scp-close"
          data-action="close"
          aria-label="Close Source Code Pro"
        >
          ×
        </button>

      </header>


      <div class="scp-toolbar">

        <div class="scp-toolbar-group">

          <button
            type="button"
            class="scp-tool-button"
            data-action="format-document"
          >
            Format HTML
          </button>

          <button
            type="button"
            class="scp-tool-button"
            data-action="format-selection"
          >
            Format Selection
          </button>

        </div>


        <div class="scp-toolbar-group">

          <label class="scp-select-label">

            <span>
              Indent
            </span>

            <select
              data-setting="tab-width"
            >
              <option value="2">
                2 spaces
              </option>

              <option value="4">
                4 spaces
              </option>
            </select>

          </label>

        </div>


        <div class="scp-toolbar-group scp-toolbar-group--grow">

          <label class="scp-checkbox">

            <input
              type="checkbox"
              data-setting="format-on-open"
            >

            <span>
              Format automatically when Source Code Pro opens
            </span>

          </label>

        </div>

      </div>


      <div
        class="scp-message"
        data-message
        aria-live="polite"
      ></div>


      <div
        class="scp-editor"
        data-editor
      ></div>


      <footer class="scp-footer">

        <div
          class="scp-status"
          data-status
        >
          Line 1, Column 1
        </div>


        <div class="scp-footer-actions">

          <span class="scp-shortcut">
            Ctrl/Cmd + Enter to apply
          </span>

          <button
            type="button"
            class="scp-button"
            data-action="cancel"
          >
            Cancel
          </button>

          <button
            type="button"
            class="scp-button scp-button--primary"
            data-action="apply"
          >
            Apply
          </button>

        </div>

      </footer>

    </div>
  `;


  const modal =
    backdrop.querySelector<
      HTMLElement
    >(
      '.scp-modal'
    );


  const editorHost =
    backdrop.querySelector<
      HTMLElement
    >(
      '[data-editor]'
    );


  const statusElement =
    backdrop.querySelector<
      HTMLElement
    >(
      '[data-status]'
    );


  const messageElement =
    backdrop.querySelector<
      HTMLElement
    >(
      '[data-message]'
    );


  const tabWidthSelect =
    backdrop.querySelector<
      HTMLSelectElement
    >(
      '[data-setting="tab-width"]'
    );


  const formatOnOpenCheckbox =
    backdrop.querySelector<
      HTMLInputElement
    >(
      '[data-setting="format-on-open"]'
    );


  if (
    !modal ||
    !editorHost ||
    !statusElement ||
    !messageElement ||
    !tabWidthSelect ||
    !formatOnOpenCheckbox
  ) {
    document.body
      .style
      .overflow =
      previousBodyOverflow;


    return;
  }


  /* =======================================================
     INITIAL SETTINGS
     ======================================================= */


  let tabWidth =
    getTabWidthSetting();


  tabWidthSelect.value =
    String(
      tabWidth
    );


  formatOnOpenCheckbox.checked =
    getFormatOnOpenSetting();


  /* =======================================================
     MESSAGE
     ======================================================= */


  let messageTimer:
    number | null =
    null;


  const clearMessage =
    (): void => {
      messageElement.textContent =
        '';

      messageElement.removeAttribute(
        'data-type'
      );


      if (
        messageTimer !==
        null
      ) {
        window.clearTimeout(
          messageTimer
        );


        messageTimer =
          null;
      }
    };


  const showMessage =
    (
      message: string,
      type:
        | 'success'
        | 'error'
        | 'info' =
        'info',
      timeout = 4000
    ): void => {
      clearMessage();


      messageElement.textContent =
        message;


      messageElement.setAttribute(
        'data-type',
        type
      );


      if (
        timeout >
        0
      ) {
        messageTimer =
          window.setTimeout(
            () => {
              clearMessage();
            },
            timeout
          );
      }
    };


  /* =======================================================
     CODEMIRROR
     ======================================================= */


  const state =
    EditorState.create({
      doc:
        originalHtml,

      extensions: [
        basicSetup,

        html(),

        oneDark,

        EditorView.lineWrapping,

        EditorView.updateListener.of(
          (
            update
          ) => {
            if (
              update.selectionSet ||
              update.docChanged
            ) {
              statusElement.textContent =
                getCursorStatus(
                  update.view
                );
            }
          }
        ),
      ],
    });


  const view =
    new EditorView({
      state,

      parent:
        editorHost,
    });


  statusElement.textContent =
    getCursorStatus(
      view
    );


  /* =======================================================
     FORMAT DOCUMENT
     ======================================================= */


  let formatting =
    false;


  const setFormattingState =
    (
      active: boolean
    ): void => {
      formatting =
        active;


      backdrop
        .querySelectorAll<
          HTMLButtonElement
        >(
          '[data-action="format-document"], [data-action="format-selection"]'
        )
        .forEach(
          (
            button
          ) => {
            button.disabled =
              active;
          }
        );


      tabWidthSelect.disabled =
        active;
    };


  const formatDocument =
    async (
      silent = false
    ): Promise<void> => {
      if (
        formatting
      ) {
        return;
      }


      setFormattingState(
        true
      );


      if (
        !silent
      ) {
        showMessage(
          'Formatting HTML…',
          'info',
          0
        );
      }


      try {
        const source =
          view.state.doc.toString();


        const selection =
          view.state.selection.main;


        const formatted =
          await formatHtml(
            source,
            {
              tabWidth,
            }
          );


        if (
          formatted ===
          source
        ) {
          if (
            !silent
          ) {
            showMessage(
              'HTML is already formatted.',
              'info'
            );
          }


          return;
        }


        replaceEditorContent(
          view,
          formatted,
          selection.anchor,
          selection.head
        );


        if (
          !silent
        ) {
          showMessage(
            'HTML formatted.',
            'success'
          );
        }
      } catch (
        error
      ) {
        showMessage(
          `Formatting failed: ${getErrorMessage(
            error
          )}`,
          'error',
          7000
        );
      } finally {
        setFormattingState(
          false
        );
      }
    };


  /* =======================================================
     FORMAT SELECTION
     ======================================================= */


  const formatSelection =
    async (): Promise<void> => {
      if (
        formatting
      ) {
        return;
      }


      const selection =
        view.state.selection.main;


      if (
        selection.empty
      ) {
        showMessage(
          'Select some HTML first, then choose Format Selection.',
          'info',
          4500
        );


        view.focus();

        return;
      }


      setFormattingState(
        true
      );


      showMessage(
        'Formatting selected HTML…',
        'info',
        0
      );


      try {
        const source =
          view.state.doc.toString();


        /*
         * Prettier range formatting
         * receives the complete HTML
         * document but concentrates
         * formatting around the selected
         * source range.
         *
         * This is safer than attempting
         * to parse arbitrary selected
         * fragments independently.
         */
        const formatted =
          await formatHtml(
            source,
            {
              tabWidth,

              rangeStart:
                selection.from,

              rangeEnd:
                selection.to,
            }
          );


        if (
          formatted ===
          source
        ) {
          showMessage(
            'The selected area is already formatted.',
            'info'
          );


          return;
        }


        replaceEditorContent(
          view,
          formatted,
          selection.anchor,
          selection.head
        );


        showMessage(
          'Selected HTML formatted.',
          'success'
        );
      } catch (
        error
      ) {
        showMessage(
          `Selection formatting failed: ${getErrorMessage(
            error
          )}`,
          'error',
          7000
        );
      } finally {
        setFormattingState(
          false
        );
      }
    };


  /* =======================================================
     APPLY
     ======================================================= */


  let closed =
    false;


  const close =
    (): void => {
      if (
        closed
      ) {
        return;
      }


      closed =
        true;


      if (
        messageTimer !==
        null
      ) {
        window.clearTimeout(
          messageTimer
        );
      }


      document.removeEventListener(
        'keydown',
        onDocumentKeyDown
      );


      view.destroy();


      backdrop.remove();


      document.body
        .style
        .overflow =
        previousBodyOverflow;


      activeSourceEditorClose =
        null;
    };


  const apply =
    (): void => {
      const newHtml =
        view.state.doc.toString();


      editor.undoManager.transact(
        () => {
          editor.setContent(
            newHtml
          );


          editor.nodeChanged();
        }
      );


      close();


      editor.focus();


      editor.notificationManager.open({
        text:
          'Source code applied.',

        type:
          'success',

        timeout:
          3000,
      });
    };


  /* =======================================================
     EVENT HANDLING
     ======================================================= */


  backdrop.addEventListener(
    'click',
    (
      event
    ) => {
      const target =
        event.target;


      if (
        !(target instanceof
          Element)
      ) {
        return;
      }


      const button =
        target.closest<
          HTMLButtonElement
        >(
          'button[data-action]'
        );


      if (
        !button ||
        !backdrop.contains(
          button
        )
      ) {
        return;
      }


      const action =
        button.dataset
          .action;


      switch (
        action
      ) {
        case 'close':
        case 'cancel':
          close();
          break;


        case 'apply':
          apply();
          break;


        case 'format-document':
          void formatDocument();
          break;


        case 'format-selection':
          void formatSelection();
          break;
      }
    }
  );


  tabWidthSelect.addEventListener(
    'change',
    () => {
      const selected =
        Number(
          tabWidthSelect.value
        );


      tabWidth =
        selected === 4
          ? 4
          : 2;


      setTabWidthSetting(
        tabWidth
      );


      showMessage(
        `Indentation set to ${tabWidth} spaces.`,
        'info',
        2500
      );
    }
  );


  formatOnOpenCheckbox
    .addEventListener(
      'change',
      () => {
        const enabled =
          formatOnOpenCheckbox
            .checked;


        setFormatOnOpenSetting(
          enabled
        );


        showMessage(
          enabled
            ? 'Automatic formatting will run when Source Code Pro opens.'
            : 'Automatic formatting on open is disabled.',
          'info',
          3000
        );
      }
    );


  backdrop.addEventListener(
    'mousedown',
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


  function onDocumentKeyDown(
    event:
      KeyboardEvent
  ): void {
    if (
      event.key ===
      'Escape'
    ) {
      event.preventDefault();


      close();

      return;
    }


    if (
      (
        event.ctrlKey ||
        event.metaKey
      ) &&
      event.key ===
        'Enter'
    ) {
      event.preventDefault();


      apply();
    }
  }


  document.addEventListener(
    'keydown',
    onDocumentKeyDown
  );


  /* =======================================================
     OPEN
     ======================================================= */


  document.body.appendChild(
    backdrop
  );


  activeSourceEditorClose =
    close;


  view.focus();


  /* =======================================================
     OPTIONAL FORMAT ON OPEN
     ======================================================= */


  if (
    formatOnOpenCheckbox
      .checked
  ) {
    /*
     * Wait until the CodeMirror view
     * has been mounted before changing
     * its document.
     */
    window.setTimeout(
      () => {
        if (
          !closed
        ) {
          void formatDocument(
            true
          );
        }
      },
      0
    );
  }
}