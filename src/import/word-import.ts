import * as mammoth from 'mammoth';


export interface WordImportStats {
  headings: number;

  paragraphs: number;

  unorderedLists: number;

  orderedLists: number;

  listItems: number;

  tables: number;

  links: number;

  images: number;
}


export interface WordImportResult {
  html: string;

  messages: string[];

  stats: WordImportStats;
}


/**
 * Analyze the HTML produced by Mammoth.
 */
function analyzeHtml(
  html: string
): WordImportStats {
  const parser =
    new DOMParser();


  const document =
    parser.parseFromString(
      html,
      'text/html'
    );


  return {
    headings:
      document.querySelectorAll(
        'h1, h2, h3, h4, h5, h6'
      ).length,

    paragraphs:
      document.querySelectorAll(
        'p'
      ).length,

    unorderedLists:
      document.querySelectorAll(
        'ul'
      ).length,

    orderedLists:
      document.querySelectorAll(
        'ol'
      ).length,

    listItems:
      document.querySelectorAll(
        'li'
      ).length,

    tables:
      document.querySelectorAll(
        'table'
      ).length,

    links:
      document.querySelectorAll(
        'a'
      ).length,

    images:
      document.querySelectorAll(
        'img'
      ).length,
  };
}


/**
 * Convert a .docx Word document
 * into HTML.
 */
export async function convertWordFileToHtml(
  file: File
): Promise<WordImportResult> {
  if (
    !file.name
      .toLowerCase()
      .endsWith(
        '.docx'
      )
  ) {
    throw new Error(
      'Please select a .docx Word document.'
    );
  }


  const arrayBuffer =
    await file.arrayBuffer();


  const result =
    await mammoth.convertToHtml({
      arrayBuffer,
    });


  const html =
    result.value;


  return {
    html,

    messages:
      result.messages.map(
        (message) =>
          `${message.type}: ${message.message}`
      ),

    stats:
      analyzeHtml(
        html
      ),
  };
}