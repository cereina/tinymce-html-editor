import type {
  Editor,
} from 'tinymce';


type DownloadLanguage =
  | 'en'
  | 'fr';


type DownloadUnit =
  | 'KB'
  | 'MB';


interface DownloadDialogData {
  documentTitle?: string;
  filePath?: string;
  imageUrl?: string;
  fileSize?: string;
  unit?: string;
  language?: string;
}


/* =========================================================
   BASIC UTILITIES
   ========================================================= */


function normalizeText(
  value:
    unknown
): string {
  return typeof value ===
    'string'
    ? value.trim()
    : '';
}


function isValidFileSize(
  value:
    string
): boolean {
  if (
    !value
  ) {
    return false;
  }

  const parsed =
    Number(
      value
        .replace(
          ',',
          '.'
        )
    );

  return (
    Number.isFinite(
      parsed
    ) &&
    parsed >
      0
  );
}


/* =========================================================
   DOWNLOAD MARKUP
   ========================================================= */


function getUnitLabels(
  language:
    DownloadLanguage,
  unit:
    DownloadUnit
): {
  text: string;
  title: string;
} {
  if (
    language ===
    'fr'
  ) {
    return unit ===
      'MB'
      ? {
          text:
            'Mo',

          title:
            'Mégaoctet',
        }
      : {
          text:
            'Ko',

          title:
            'Kilo-octet',
        };
  }

  return unit ===
    'MB'
    ? {
        text:
          'MB',

        title:
          'MegaByte',
      }
    : {
        text:
          'KB',

        title:
          'KiloByte',
      };
}


function createDownloadHtml(
  editor:
    Editor,
  documentTitle:
    string,
  filePath:
    string,
  imageUrl:
    string,
  fileSize:
    string,
  unit:
    DownloadUnit,
  language:
    DownloadLanguage
): string {
  const document =
    editor.getDoc();

  const wrapper =
    document.createElement(
      'div'
    );

  const link =
    document.createElement(
      'a'
    );

  link.className =
    'gc-dwnld';

  link.setAttribute(
    'href',
    filePath
  );

  link.setAttribute(
    'download',
    ''
  );


  const image =
    document.createElement(
      'img'
    );

  image.setAttribute(
    'src',
    imageUrl
  );

  image.setAttribute(
    'alt',
    ''
  );


  const text =
    document.createElement(
      'span'
    );

  text.appendChild(
    document.createTextNode(
      documentTitle
    )
  );

  text.appendChild(
    document.createElement(
      'br'
    )
  );

  text.appendChild(
    document.createTextNode(
      '('
    )
  );


  const pdf =
    document.createElement(
      'abbr'
    );

  pdf.setAttribute(
    'title',
    'Portable Document Format'
  );

  pdf.textContent =
    'PDF';


  const unitLabels =
    getUnitLabels(
      language,
      unit
    );


  const unitElement =
    document.createElement(
      'abbr'
    );

  unitElement.setAttribute(
    'title',
    unitLabels.title
  );

  unitElement.textContent =
    unitLabels.text;


  text.appendChild(
    pdf
  );

  text.appendChild(
    document.createTextNode(
      ', ' +
      fileSize +
      ' '
    )
  );

  text.appendChild(
    unitElement
  );

  text.appendChild(
    document.createTextNode(
      ')'
    )
  );


  link.append(
    image,
    text
  );

  wrapper.appendChild(
    link
  );


  return wrapper.outerHTML;
}


/* =========================================================
   DIALOG
   ========================================================= */


function openDownloadLinkDialog(
  editor:
    Editor
): void {
  editor.windowManager.open({
    title:
      'Insert Download Link',

    size:
      'medium',

    body: {
      type:
        'panel',

      items: [
        {
          type:
            'input',

          name:
            'documentTitle',

          label:
            'Document title',

          placeholder:
            'Example: Annual report 2026',
        },

        {
          type:
            'input',

          name:
            'filePath',

          label:
            'File path or URL',

          placeholder:
            '/documents/report.pdf',
        },

        {
          type:
            'input',

          name:
            'imageUrl',

          label:
            'Image URL',

          placeholder:
            '/images/pdf-icon.png',
        },

        {
          type:
            'input',

          name:
            'fileSize',

          label:
            'File size',

          placeholder:
            '273',
        },

        {
          type:
            'selectbox',

          name:
            'unit',

          label:
            'File size unit',

          items: [
            {
              text:
                'KB',

              value:
                'KB',
            },

            {
              text:
                'MB',

              value:
                'MB',
            },
          ],
        },

        {
          type:
            'selectbox',

          name:
            'language',

          label:
            'Language',

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

        {
          type:
            'htmlpanel',

          html:
            '<p style="margin-top:8px;color:#555">' +
              'The tool creates a GCWeb <code>gc-dwnld</code> download link for a PDF. ' +
              'French output changes KB/MB to Ko/Mo and uses French abbreviation titles.' +
            '</p>',
        },
      ],
    },

    initialData: {
      documentTitle:
        '',

      filePath:
        '',

      imageUrl:
        '',

      fileSize:
        '',

      unit:
        'KB',

      language:
        'en',
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
          'Insert download link',

        buttonType:
          'primary',
      },
    ],

    onSubmit:
      (
        api
      ) => {
        const data =
          api.getData() as
            DownloadDialogData;

        const documentTitle =
          normalizeText(
            data.documentTitle
          );

        const filePath =
          normalizeText(
            data.filePath
          );

        const imageUrl =
          normalizeText(
            data.imageUrl
          );

        const fileSize =
          normalizeText(
            data.fileSize
          );

        const unit:
          DownloadUnit =
          data.unit ===
            'MB'
            ? 'MB'
            : 'KB';

        const language:
          DownloadLanguage =
          data.language ===
            'fr'
            ? 'fr'
            : 'en';


        if (
          !documentTitle
        ) {
          editor.notificationManager.open({
            text:
              'Enter the document title.',

            type:
              'warning',

            timeout:
              3500,
          });

          return;
        }


        if (
          !filePath
        ) {
          editor.notificationManager.open({
            text:
              'Enter the file path or URL.',

            type:
              'warning',

            timeout:
              3500,
          });

          return;
        }


        if (
          !imageUrl
        ) {
          editor.notificationManager.open({
            text:
              'Enter the image URL.',

            type:
              'warning',

            timeout:
              3500,
          });

          return;
        }


        if (
          !isValidFileSize(
            fileSize
          )
        ) {
          editor.notificationManager.open({
            text:
              'Enter a valid file size greater than 0.',

            type:
              'warning',

            timeout:
              3500,
          });

          return;
        }


        const html =
          createDownloadHtml(
            editor,
            documentTitle,
            filePath,
            imageUrl,
            fileSize,
            unit,
            language
          );


        editor.undoManager.transact(
          () => {
            editor.insertContent(
              html
            );

            editor.nodeChanged();
          }
        );


        api.close();


        editor.notificationManager.open({
          text:
            'Download link inserted.',

          type:
            'success',

          timeout:
            3000,
        });
      },
  });
}


/* =========================================================
   TINYMCE BUTTON
   ========================================================= */


export function registerDownloadLinkButton(
  editor:
    Editor
): void {
  editor.ui.registry.addButton(
    'downloadlink',
    {
      text:
        'Download',

      tooltip:
        'Insert a GCWeb PDF download link',

      onAction:
        () => {
          openDownloadLinkDialog(
            editor
          );
        },
    }
  );
}
