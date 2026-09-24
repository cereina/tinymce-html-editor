import type { Editor } from 'tinymce';


type TableComplexity =
  | 'simple'
  | 'grouped'
  | 'complex';


interface LogicalCell {
  cell: HTMLTableCellElement;

  rowStart: number;
  rowEnd: number;

  colStart: number;
  colEnd: number;
}


interface TableGrid {
  rows: number;
  columns: number;

  cells: LogicalCell[];

  matrix:
    Array<
      Array<LogicalCell | null>
    >;
}


interface StructureAnalysis {
  complexity: TableComplexity;

  reasons: string[];

  grid: TableGrid;

  headerRows: number;

  suggestedHeaderRows: number;

  rowHeaderColumns: number;

  mergedHeaderCells: number;

  mergedDataCells: number;

  existingHeadersAttributes: number;

  tbodyCount: number;

  irregularHeaders: number;
}


interface TableAnalysis {
  rows: number;

  columns: number;

  caption: string;

  hasCaption: boolean;

  hasThead: boolean;

  hasTbody: boolean;

  headerCells: number;

  headerCellsWithoutScope: number;

  firstColumnHasRowHeaders: boolean;

  mergedCells: number;

  paragraphWrappers: number;

  safeParagraphWrappers: number;

  complexParagraphCells: number;

  complexity: TableComplexity;

  complexityReasons: string[];

  suggestedHeaderRows: number;

  missingDescriptionTargets: string[];

  warnings: string[];
}


interface TableAccessibilityOptions {
  caption: string;

  headerRowCount: number;

  firstColumnHeaders: boolean;

  normalizeSections: boolean;

  removeParagraphWrappers: boolean;
}


interface AccessibleTableResult {
  table: HTMLTableElement;

  paragraphWrappersRemoved: number;
}


interface HeaderOption {
  id: string;

  text: string;

  logicalCell: LogicalCell;
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


function getDirectChild<
  T extends Element
>(
  table: HTMLTableElement,
  tagName: string
): T | null {
  const expected =
    tagName.toUpperCase();

  const result =
    Array.from(
      table.children
    ).find(
      (child) =>
        child.tagName ===
        expected
    );

  return (
    result as T | undefined
  ) ?? null;
}


function getSelectedTable(
  editor: Editor
): HTMLTableElement | null {
  const node =
    editor.selection.getNode();

  const table =
    editor.dom.getParent(
      node,
      'table'
    );

  return (
    table as
      HTMLTableElement | null
  );
}


/* =========================================================
   LOGICAL GRID
   ========================================================= */


/**
 * Build a logical table grid that understands
 * rowspan and colspan.
 *
 * Example:
 *
 * <td rowspan="2">Name</td>
 * <td colspan="2">Personal information</td>
 *
 * is expanded internally into the positions
 * those cells occupy.
 */
function buildTableGrid(
  table: HTMLTableElement
): TableGrid {
  const rows =
    Array.from(
      table.rows
    );

  const matrix:
    Array<
      Array<LogicalCell | null>
    > = [];

  const cells:
    LogicalCell[] = [];

  let maxColumns =
    0;


  rows.forEach(
    (
      row,
      rowIndex
    ) => {
      if (
        !matrix[
          rowIndex
        ]
      ) {
        matrix[
          rowIndex
        ] = [];
      }


      let columnIndex =
        0;


      Array.from(
        row.cells
      ).forEach(
        (cell) => {
          /*
           * Skip logical positions already occupied
           * by a rowspan from a previous row.
           */
          while (
            matrix[
              rowIndex
            ][
              columnIndex
            ]
          ) {
            columnIndex++;
          }


          const rowSpan =
            Math.max(
              cell.rowSpan ||
                1,
              1
            );


          const colSpan =
            Math.max(
              cell.colSpan ||
                1,
              1
            );


          const logicalCell:
            LogicalCell = {
              cell,

              rowStart:
                rowIndex,

              rowEnd:
                rowIndex +
                rowSpan -
                1,

              colStart:
                columnIndex,

              colEnd:
                columnIndex +
                colSpan -
                1,
            };


          cells.push(
            logicalCell
          );


          for (
            let r =
              rowIndex;
            r <
            rowIndex +
              rowSpan;
            r++
          ) {
            if (
              !matrix[
                r
              ]
            ) {
              matrix[
                r
              ] = [];
            }


            for (
              let c =
                columnIndex;
              c <
              columnIndex +
                colSpan;
              c++
            ) {
              matrix[
                r
              ][
                c
              ] =
                logicalCell;
            }
          }


          columnIndex +=
            colSpan;


          maxColumns =
            Math.max(
              maxColumns,
              columnIndex
            );
        }
      );
    }
  );


  return {
    rows:
      matrix.length,

    columns:
      maxColumns,

    cells,

    matrix,
  };
}


function rangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return (
    startA <=
      endB &&
    startB <=
      endA
  );
}


/* =========================================================
   HEADER ROW DETECTION
   ========================================================= */


/**
 * Detect already-existing header rows.
 *
 * If THEAD exists, it is authoritative.
 */
function detectExistingHeaderRows(
  table: HTMLTableElement
): number {
  if (
    table.tHead &&
    table.tHead.rows.length >
      0
  ) {
    return (
      table.tHead.rows.length
    );
  }


  const rows =
    Array.from(
      table.rows
    );


  let count =
    0;


  for (
    const row of rows
  ) {
    if (
      row.cells.length ===
      0
    ) {
      break;
    }


    const cells =
      Array.from(
        row.cells
      );


    const allHeaders =
      cells.every(
        (cell) =>
          cell.tagName ===
          'TH'
      );


    if (
      allHeaders
    ) {
      count++;

      continue;
    }


    break;
  }


  return count;
}


/**
 * Detect a likely multi-level header region
 * even when Word imported all cells as TD.
 *
 * This is deliberately only a suggestion.
 *
 * Example:
 *
 * Row 1:
 * Name rowspan=2
 * Personal colspan=2
 * Work rowspan=2
 *
 * Row 2:
 * Phone
 * Address
 *
 * The structure strongly suggests that
 * the first TWO rows are headers.
 */
function detectSuggestedHeaderRows(
  table: HTMLTableElement,
  grid: TableGrid
): number {
  const existing =
    detectExistingHeaderRows(
      table
    );


  if (
    existing >
    0
  ) {
    return existing;
  }


  if (
    grid.rows ===
    0
  ) {
    return 0;
  }


  const firstRowCells =
    grid.cells.filter(
      (logical) =>
        logical.rowStart ===
        0
    );


  if (
    firstRowCells.length ===
    0
  ) {
    return 0;
  }


  const firstRowHasMergedCells =
    firstRowCells.some(
      (logical) =>
        logical.cell.rowSpan >
          1 ||
        logical.cell.colSpan >
          1
    );


  /*
   * No strong structural signal.
   *
   * The coder can still manually choose
   * one header row in the dialog.
   */
  if (
    !firstRowHasMergedCells
  ) {
    return 0;
  }


  let candidateEnd =
    0;


  let rowIndex =
    0;


  while (
    rowIndex <=
      candidateEnd &&
    rowIndex <
      grid.rows
  ) {
    const cellsStartingHere =
      grid.cells.filter(
        (logical) =>
          logical.rowStart ===
          rowIndex
      );


    if (
      cellsStartingHere.length ===
      0
    ) {
      rowIndex++;

      continue;
    }


    /*
     * A rowspan tells us the header
     * structure extends vertically.
     */
    cellsStartingHere.forEach(
      (logical) => {
        candidateEnd =
          Math.max(
            candidateEnd,
            logical.rowEnd
          );
      }
    );


    /*
     * A colspan normally indicates a group
     * heading that is subdivided by the row
     * immediately below it.
     *
     * Example:
     *
     * Personal information
     *   ├ Phone
     *   └ Address
     */
    const containsColumnGroup =
      cellsStartingHere.some(
        (logical) =>
          logical.cell.colSpan >
          1
      );


    if (
      containsColumnGroup &&
      rowIndex + 1 <
        grid.rows
    ) {
      candidateEnd =
        Math.max(
          candidateEnd,
          rowIndex + 1
        );
    }


    rowIndex++;
  }


  /*
   * Never classify the entire table as
   * headers. At least one data row should
   * remain.
   */
  const maximumAllowed =
    Math.max(
      grid.rows - 1,
      0
    );


  return Math.min(
    candidateEnd +
      1,
    maximumAllowed
  );
}


/**
 * Estimate consecutive row-header columns
 * that already contain TH elements.
 */
function detectRowHeaderColumns(
  table: HTMLTableElement
): number {
  const rows =
    Array.from(
      table.rows
    ).filter(
      (row) =>
        row.parentElement
          ?.tagName !==
          'THEAD' &&
        row.parentElement
          ?.tagName !==
          'TFOOT'
    );


  let maximum =
    0;


  rows.forEach(
    (row) => {
      let count =
        0;


      for (
        const cell of
        Array.from(
          row.cells
        )
      ) {
        if (
          cell.tagName ===
          'TH'
        ) {
          count++;

          continue;
        }


        break;
      }


      maximum =
        Math.max(
          maximum,
          count
        );
    }
  );


  return maximum;
}


function detectIrregularHeaders(
  grid: TableGrid,
  headerRows: number,
  rowHeaderColumns: number
): number {
  return grid.cells.filter(
    (logical) => {
      if (
        logical.cell.tagName !==
        'TH'
      ) {
        return false;
      }


      const inTopHeaderRegion =
        logical.rowStart <
        headerRows;


      const inRowHeaderRegion =
        logical.colStart <
        rowHeaderColumns;


      return (
        !inTopHeaderRegion &&
        !inRowHeaderRegion
      );
    }
  ).length;
}


/* =========================================================
   STRUCTURE CLASSIFICATION
   ========================================================= */


function analyzeTableStructure(
  table: HTMLTableElement
): StructureAnalysis {
  const grid =
    buildTableGrid(
      table
    );


  const headerRows =
    detectExistingHeaderRows(
      table
    );


  const suggestedHeaderRows =
    detectSuggestedHeaderRows(
      table,
      grid
    );


  const rowHeaderColumns =
    detectRowHeaderColumns(
      table
    );


  const mergedHeaderCells =
    grid.cells.filter(
      (logical) =>
        logical.cell.tagName ===
          'TH' &&
        (
          logical.cell.rowSpan >
            1 ||
          logical.cell.colSpan >
            1
        )
    ).length;


  const mergedDataCells =
    grid.cells.filter(
      (logical) =>
        logical.cell.tagName ===
          'TD' &&
        (
          logical.cell.rowSpan >
            1 ||
          logical.cell.colSpan >
            1
        )
    ).length;


  const existingHeadersAttributes =
    table.querySelectorAll(
      'td[headers], th[headers]'
    ).length;


  const tbodyCount =
    table.tBodies.length;


  const irregularHeaders =
    detectIrregularHeaders(
      grid,
      headerRows,
      rowHeaderColumns
    );


  const reasons:
    string[] = [];


  if (
    headerRows >
    1
  ) {
    reasons.push(
      `${headerRows} confirmed header rows`
    );
  }


  if (
    headerRows ===
      0 &&
    suggestedHeaderRows >
      1
  ) {
    reasons.push(
      `${suggestedHeaderRows} potential header rows detected from merged-cell structure`
    );
  }


  if (
    rowHeaderColumns >
    1
  ) {
    reasons.push(
      `${rowHeaderColumns} row-header columns detected`
    );
  }


  if (
    mergedHeaderCells >
    0
  ) {
    reasons.push(
      `${mergedHeaderCells} merged header cell(s)`
    );
  }


  if (
    mergedDataCells >
    0
  ) {
    reasons.push(
      `${mergedDataCells} merged cell(s) are currently marked as data cells`
    );
  }


  if (
    tbodyCount >
    1
  ) {
    reasons.push(
      `${tbodyCount} TBODY groups detected`
    );
  }


  if (
    existingHeadersAttributes >
    0
  ) {
    reasons.push(
      `${existingHeadersAttributes} existing headers attribute(s)`
    );
  }


  if (
    irregularHeaders >
    0
  ) {
    reasons.push(
      `${irregularHeaders} irregular header cell(s)`
    );
  }


  let complexity:
    TableComplexity =
      'simple';


  /*
   * A structure imported as TD may already
   * strongly indicate a complex header layout.
   */
  if (
    suggestedHeaderRows >
      1 ||
    mergedDataCells >
      0 ||
    rowHeaderColumns >
      1 ||
    tbodyCount >
      1 ||
    existingHeadersAttributes >
      0 ||
    irregularHeaders >
      0 ||
    headerRows >=
      3 ||
    (
      headerRows >
        1 &&
      mergedHeaderCells >
        0
    )
  ) {
    complexity =
      'complex';
  }

  else if (
    mergedHeaderCells >
      0 ||
    headerRows >
      1
  ) {
    complexity =
      'grouped';
  }


  return {
    complexity,

    reasons,

    grid,

    headerRows,

    suggestedHeaderRows,

    rowHeaderColumns,

    mergedHeaderCells,

    mergedDataCells,

    existingHeadersAttributes,

    tbodyCount,

    irregularHeaders,
  };
}


/* =========================================================
   PARAGRAPH ANALYSIS
   ========================================================= */


function getDirectParagraphs(
  cell: HTMLTableCellElement
): HTMLParagraphElement[] {
  return Array.from(
    cell.children
  ).filter(
    (
      child
    ): child is
      HTMLParagraphElement =>
      child.tagName ===
      'P'
  );
}


function hasSimpleParagraphWrapper(
  cell: HTMLTableCellElement
): boolean {
  const paragraphs =
    getDirectParagraphs(
      cell
    );


  if (
    paragraphs.length !==
    1
  ) {
    return false;
  }


  const paragraph =
    paragraphs[
      0
    ];


  const extraNodes =
    Array.from(
      cell.childNodes
    ).filter(
      (node) => {
        if (
          node ===
          paragraph
        ) {
          return false;
        }


        if (
          node.nodeType ===
          Node.TEXT_NODE
        ) {
          return Boolean(
            normalizeText(
              node.textContent ??
                ''
            )
          );
        }


        return true;
      }
    );


  return (
    extraNodes.length ===
    0
  );
}


function analyzeCellParagraphs(
  table: HTMLTableElement
): {
  paragraphWrappers: number;

  safeParagraphWrappers: number;

  complexParagraphCells: number;
} {
  let paragraphWrappers =
    0;

  let safeParagraphWrappers =
    0;

  let complexParagraphCells =
    0;


  const cells =
    Array.from(
      table.querySelectorAll<
        HTMLTableCellElement
      >(
        'th, td'
      )
    );


  cells.forEach(
    (cell) => {
      const paragraphs =
        getDirectParagraphs(
          cell
        );


      paragraphWrappers +=
        paragraphs.length;


      if (
        paragraphs.length ===
        0
      ) {
        return;
      }


      if (
        hasSimpleParagraphWrapper(
          cell
        )
      ) {
        safeParagraphWrappers++;

        return;
      }


      complexParagraphCells++;
    }
  );


  return {
    paragraphWrappers,

    safeParagraphWrappers,

    complexParagraphCells,
  };
}


/* =========================================================
   DESCRIPTION VALIDATION
   ========================================================= */


function findMissingDescriptionTargets(
  table: HTMLTableElement
): string[] {
  const ids =
    (
      table.getAttribute(
        'aria-describedby'
      ) ??
      ''
    )
      .split(/\s+/)
      .filter(Boolean);


  return ids.filter(
    (id) =>
      !table.ownerDocument
        .getElementById(
          id
        )
  );
}


/* =========================================================
   BASIC TABLE ANALYSIS
   ========================================================= */


function hasFirstColumnRowHeaders(
  table: HTMLTableElement
): boolean {
  const rows =
    Array.from(
      table.rows
    ).filter(
      (row) =>
        row.parentElement
          ?.tagName !==
          'THEAD' &&
        row.parentElement
          ?.tagName !==
          'TFOOT'
    );


  if (
    rows.length ===
    0
  ) {
    return false;
  }


  let rowsWithCells =
    0;


  const valid =
    rows.every(
      (row) => {
        const firstCell =
          row.cells[
            0
          ];


        if (
          !firstCell
        ) {
          return true;
        }


        rowsWithCells++;


        if (
          firstCell.tagName !==
          'TH'
        ) {
          return false;
        }


        const scope =
          firstCell.getAttribute(
            'scope'
          );


        return (
          scope ===
            'row' ||
          scope ===
            'rowgroup'
        );
      }
    );


  return (
    rowsWithCells >
      0 &&
    valid
  );
}


function analyzeTable(
  table: HTMLTableElement
): TableAnalysis {
  const warnings:
    string[] = [];


  const structure =
    analyzeTableStructure(
      table
    );


  const caption =
    getDirectChild<
      HTMLTableCaptionElement
    >(
      table,
      'caption'
    );


  const headers =
    Array.from(
      table.querySelectorAll<
        HTMLTableCellElement
      >(
        'th'
      )
    );


  const headersWithoutScope =
    headers.filter(
      (header) => {
        const scope =
          header.getAttribute(
            'scope'
          );


        return (
          !scope ||
          ![
            'col',
            'row',
            'colgroup',
            'rowgroup',
          ].includes(
            scope.toLowerCase()
          )
        );
      }
    ).length;


  const paragraphAnalysis =
    analyzeCellParagraphs(
      table
    );


  const missingDescriptionTargets =
    findMissingDescriptionTargets(
      table
    );


  if (
    !caption ||
    !normalizeText(
      caption.textContent ??
        ''
    )
  ) {
    warnings.push(
      'No table caption is currently defined.'
    );
  }


  if (
    headers.length ===
    0
  ) {
    warnings.push(
      'No TH header cells were found.'
    );
  }


  if (
    structure.suggestedHeaderRows >
      0 &&
    structure.headerRows ===
      0
  ) {
    warnings.push(
      `The table structure suggests that the first ${structure.suggestedHeaderRows} row(s) may be column headers. Confirm this before applying changes.`
    );
  }


  if (
    headersWithoutScope >
    0
  ) {
    warnings.push(
      `${headersWithoutScope} header cell(s) currently have no scope.`
    );
  }


  if (
    !table.tHead
  ) {
    warnings.push(
      'No THEAD section was found.'
    );
  }


  if (
    table.tBodies.length ===
    0
  ) {
    warnings.push(
      'No TBODY section was found.'
    );
  }


  if (
    paragraphAnalysis
      .safeParagraphWrappers >
    0
  ) {
    warnings.push(
      `${paragraphAnalysis.safeParagraphWrappers} simple paragraph wrapper(s) can be removed if approved.`
    );
  }


  if (
    paragraphAnalysis
      .complexParagraphCells >
    0
  ) {
    warnings.push(
      `${paragraphAnalysis.complexParagraphCells} cell(s) contain multiple or complex paragraphs and will not be flattened automatically.`
    );
  }


  if (
    missingDescriptionTargets.length >
    0
  ) {
    warnings.push(
      `aria-describedby points to missing ID(s): ${missingDescriptionTargets.join(
        ', '
      )}.`
    );
  }


  if (
    structure.complexity ===
    'complex'
  ) {
    warnings.push(
      'A complex or multi-level table structure was detected. Header relationships should be reviewed before they are applied.'
    );
  }


  return {
    rows:
      structure.grid.rows,

    columns:
      structure.grid.columns,

    caption:
      normalizeText(
        caption?.textContent ??
          ''
      ),

    hasCaption:
      Boolean(
        caption &&
        normalizeText(
          caption.textContent ??
            ''
        )
      ),

    hasThead:
      Boolean(
        table.tHead
      ),

    hasTbody:
      table.tBodies.length >
      0,

    headerCells:
      headers.length,

    headerCellsWithoutScope:
      headersWithoutScope,

    firstColumnHasRowHeaders:
      hasFirstColumnRowHeaders(
        table
      ),

    mergedCells:
      structure
        .mergedHeaderCells +
      structure
        .mergedDataCells,

    paragraphWrappers:
      paragraphAnalysis
        .paragraphWrappers,

    safeParagraphWrappers:
      paragraphAnalysis
        .safeParagraphWrappers,

    complexParagraphCells:
      paragraphAnalysis
        .complexParagraphCells,

    complexity:
      structure.complexity,

    complexityReasons:
      structure.reasons,

    suggestedHeaderRows:
      structure
        .suggestedHeaderRows,

    missingDescriptionTargets,

    warnings,
  };
}


/* =========================================================
   CELL TRANSFORMATIONS
   ========================================================= */


function replaceCellTag(
  cell: HTMLTableCellElement,
  newTagName:
    'th' | 'td'
): HTMLTableCellElement {
  if (
    cell.tagName
      .toLowerCase() ===
    newTagName
  ) {
    return cell;
  }


  const replacement =
    cell.ownerDocument
      .createElement(
        newTagName
      );


  Array.from(
    cell.attributes
  ).forEach(
    (attribute) => {
      replacement.setAttribute(
        attribute.name,
        attribute.value
      );
    }
  );


  while (
    cell.firstChild
  ) {
    replacement.appendChild(
      cell.firstChild
    );
  }


  cell.replaceWith(
    replacement
  );


  return replacement;
}


function unwrapParagraph(
  paragraph:
    HTMLParagraphElement
): void {
  const parent =
    paragraph.parentNode;


  if (
    !parent
  ) {
    return;
  }


  while (
    paragraph.firstChild
  ) {
    parent.insertBefore(
      paragraph.firstChild,
      paragraph
    );
  }


  paragraph.remove();
}


function removeSimpleCellParagraphWrappers(
  table: HTMLTableElement
): number {
  let removed =
    0;


  Array.from(
    table.querySelectorAll<
      HTMLTableCellElement
    >(
      'th, td'
    )
  ).forEach(
    (cell) => {
      if (
        !hasSimpleParagraphWrapper(
          cell
        )
      ) {
        return;
      }


      const paragraph =
        getDirectParagraphs(
          cell
        )[
          0
        ];


      if (
        !paragraph
      ) {
        return;
      }


      unwrapParagraph(
        paragraph
      );


      removed++;
    }
  );


  return removed;
}


/* =========================================================
   CAPTION
   ========================================================= */


function applyCaption(
  table: HTMLTableElement,
  captionText: string
): void {
  const existing =
    getDirectChild<
      HTMLTableCaptionElement
    >(
      table,
      'caption'
    );


  const text =
    captionText.trim();


  if (
    !text
  ) {
    existing?.remove();

    return;
  }


  if (
    existing
  ) {
    existing.textContent =
      text;

    return;
  }


  const caption =
    table.ownerDocument
      .createElement(
        'caption'
      );


  caption.textContent =
    text;


  table.insertBefore(
    caption,
    table.firstChild
  );
}


/* =========================================================
   TOP HEADER ROW CONVERSION
   ========================================================= */


/**
 * Convert the requested number of top rows
 * into column header rows.
 *
 * Example:
 *
 * headerRowCount = 2
 *
 * causes rows 1 and 2 to become TH rows.
 */
function applyTopHeaderRows(
  table: HTMLTableElement,
  headerRowCount: number
): void {
  if (
    headerRowCount <=
    0
  ) {
    return;
  }


  const rows =
    Array.from(
      table.rows
    ).slice(
      0,
      headerRowCount
    );


  rows.forEach(
    (row) => {
      Array.from(
        row.cells
      ).forEach(
        (cell) => {
          const header =
            replaceCellTag(
              cell,
              'th'
            );


          /*
           * A header spanning multiple
           * columns describes a column group.
           */
          header.setAttribute(
            'scope',
            header.colSpan >
              1
              ? 'colgroup'
              : 'col'
          );
        }
      );
    }
  );
}


/**
 * Move selected top header rows into THEAD.
 */
function moveHeaderRowsIntoThead(
  table: HTMLTableElement,
  headerRowCount: number
): void {
  if (
    headerRowCount <=
    0
  ) {
    return;
  }


  const rows =
    Array.from(
      table.rows
    ).slice(
      0,
      headerRowCount
    );


  const thead =
    table.tHead ??
    table.createTHead();


  rows.forEach(
    (row) => {
      if (
        row.parentElement !==
        thead
      ) {
        thead.appendChild(
          row
        );
      }
    }
  );
}


/* =========================================================
   ROW HEADERS
   ========================================================= */


function applyRowHeaders(
  table: HTMLTableElement
): void {
  Array.from(
    table.rows
  ).forEach(
    (row) => {
      if (
        row.parentElement
          ?.tagName ===
          'THEAD'
      ) {
        return;
      }


      if (
        row.parentElement
          ?.tagName ===
          'TFOOT'
      ) {
        return;
      }


      const firstCell =
        row.cells[
          0
        ];


      if (
        !firstCell
      ) {
        return;
      }


      const header =
        replaceCellTag(
          firstCell,
          'th'
        );


      header.setAttribute(
        'scope',
        header.rowSpan >
          1
          ? 'rowgroup'
          : 'row'
      );
    }
  );
}


/* =========================================================
   TABLE SECTIONS
   ========================================================= */


function normalizeTableSections(
  table: HTMLTableElement
): void {
  /*
   * Move loose TR elements into TBODY.
   */
  const looseRows =
    Array.from(
      table.children
    ).filter(
      (
        child
      ): child is
        HTMLTableRowElement =>
        child.tagName ===
        'TR'
    );


  if (
    looseRows.length >
    0
  ) {
    const tbody =
      table.tBodies[
        0
      ] ??
      table.createTBody();


    looseRows.forEach(
      (row) => {
        tbody.appendChild(
          row
        );
      }
    );
  }
}


/* =========================================================
   SCOPE INFERENCE
   ========================================================= */


function applyInferredHeaderScopes(
  table: HTMLTableElement
): void {
  const structure =
    analyzeTableStructure(
      table
    );


  structure.grid.cells.forEach(
    (logical) => {
      const cell =
        logical.cell;


      if (
        cell.tagName !==
        'TH'
      ) {
        return;
      }


      const existing =
        cell.getAttribute(
          'scope'
        );


      if (
        existing &&
        [
          'row',
          'col',
          'rowgroup',
          'colgroup',
        ].includes(
          existing.toLowerCase()
        )
      ) {
        return;
      }


      /*
       * Top-header region.
       */
      if (
        logical.rowStart <
        structure.headerRows
      ) {
        cell.setAttribute(
          'scope',
          cell.colSpan >
            1
            ? 'colgroup'
            : 'col'
        );

        return;
      }


      /*
       * Left row-header region.
       */
      if (
        logical.colStart <
        structure
          .rowHeaderColumns
      ) {
        cell.setAttribute(
          'scope',
          cell.rowSpan >
            1
            ? 'rowgroup'
            : 'row'
        );
      }
    }
  );
}


/* =========================================================
   CREATE WORKING TABLE
   ========================================================= */


function createAccessibleTable(
  table: HTMLTableElement,
  options:
    TableAccessibilityOptions
): AccessibleTableResult {
  const clone =
    table.cloneNode(
      true
    ) as HTMLTableElement;


  applyCaption(
    clone,
    options.caption
  );


  /*
   * IMPORTANT:
   *
   * This happens before structural
   * complexity analysis.
   *
   * Word-imported TD cells can now
   * become real TH elements.
   */
  applyTopHeaderRows(
    clone,
    options.headerRowCount
  );


  if (
    options.normalizeSections
  ) {
    moveHeaderRowsIntoThead(
      clone,
      options.headerRowCount
    );


    normalizeTableSections(
      clone
    );
  }


  if (
    options.firstColumnHeaders
  ) {
    applyRowHeaders(
      clone
    );
  }


  applyInferredHeaderScopes(
    clone
  );


  let paragraphWrappersRemoved =
    0;


  if (
    options.removeParagraphWrappers
  ) {
    paragraphWrappersRemoved =
      removeSimpleCellParagraphWrappers(
        clone
      );
  }


  return {
    table:
      clone,

    paragraphWrappersRemoved,
  };
}


/* =========================================================
   DOCUMENT-WIDE UNIQUE IDS
   ========================================================= */


function countIdOccurrences(
  editor: Editor,
  id: string
): number {
  return Array.from(
    editor
      .getBody()
      .querySelectorAll<
        HTMLElement
      >(
        '[id]'
      )
  ).filter(
    (element) =>
      element.id ===
      id
  ).length;
}


function createUniqueId(
  editor: Editor,
  preferred: string,
  reserved:
    Set<string>
): string {
  let id =
    preferred;


  let suffix =
    2;


  while (
    reserved.has(
      id
    ) ||
    countIdOccurrences(
      editor,
      id
    ) >
      0
  ) {
    id =
      `${preferred}-${suffix}`;

    suffix++;
  }


  reserved.add(
    id
  );


  return id;
}


function getTableNumber(
  editor: Editor,
  table: HTMLTableElement
): number {
  const tables =
    Array.from(
      editor
        .getBody()
        .querySelectorAll<
          HTMLTableElement
        >(
          'table'
        )
    );


  const index =
    tables.indexOf(
      table
    );


  return (
    index >=
      0
      ? index + 1
      : tables.length +
        1
  );
}


function ensureHeaderIds(
  editor: Editor,
  table: HTMLTableElement,
  tableNumber: number
): void {
  const grid =
    buildTableGrid(
      table
    );


  const reserved =
    new Set<string>();


  grid.cells.forEach(
    (logical) => {
      const cell =
        logical.cell;


      if (
        cell.tagName !==
        'TH'
      ) {
        return;
      }


      const existingId =
        cell.id.trim();


      if (
        existingId &&
        countIdOccurrences(
          editor,
          existingId
        ) <=
          1 &&
        !reserved.has(
          existingId
        )
      ) {
        reserved.add(
          existingId
        );

        return;
      }


      const preferred =
        `tbl-${tableNumber}-r${logical.rowStart + 1}-c${logical.colStart + 1}`;


      cell.id =
        createUniqueId(
          editor,
          preferred,
          reserved
        );
    }
  );
}


/* =========================================================
   HEADER ASSOCIATION INFERENCE
   ========================================================= */


function isColumnHeaderFor(
  header: LogicalCell,
  data: LogicalCell
): boolean {
  const scope =
    header.cell
      .getAttribute(
        'scope'
      )
      ?.toLowerCase();


  if (
    scope ===
      'row' ||
    scope ===
      'rowgroup'
  ) {
    return false;
  }


  /*
   * Column headers must be above
   * the data cell.
   */
  if (
    header.rowEnd >=
    data.rowStart
  ) {
    return false;
  }


  return rangesOverlap(
    header.colStart,
    header.colEnd,
    data.colStart,
    data.colEnd
  );
}


function isRowHeaderFor(
  header: LogicalCell,
  data: LogicalCell
): boolean {
  const scope =
    header.cell
      .getAttribute(
        'scope'
      )
      ?.toLowerCase();


  if (
    scope ===
      'col' ||
    scope ===
      'colgroup'
  ) {
    return false;
  }


  /*
   * Row headers must be to the left.
   */
  if (
    header.colEnd >=
    data.colStart
  ) {
    return false;
  }


  return rangesOverlap(
    header.rowStart,
    header.rowEnd,
    data.rowStart,
    data.rowEnd
  );
}


function inferHeadersForCell(
  grid: TableGrid,
  dataCell:
    LogicalCell
): string[] {
  const rowHeaders:
    LogicalCell[] = [];

  const columnHeaders:
    LogicalCell[] = [];


  const existing =
    (
      dataCell.cell
        .getAttribute(
          'headers'
        ) ??
      ''
    )
      .split(
        /\s+/
      )
      .filter(
        Boolean
      );


  grid.cells.forEach(
    (header) => {
      if (
        header.cell.tagName !==
        'TH'
      ) {
        return;
      }


      if (
        isRowHeaderFor(
          header,
          dataCell
        )
      ) {
        rowHeaders.push(
          header
        );
      }


      if (
        isColumnHeaderFor(
          header,
          dataCell
        )
      ) {
        columnHeaders.push(
          header
        );
      }
    }
  );


  /*
   * Row headers:
   *
   * e.g. Mazen
   */
  rowHeaders.sort(
    (
      a,
      b
    ) =>
      a.colStart -
      b.colStart
  );


  /*
   * Column hierarchy:
   *
   * Personal information
   * Phone number
   */
  columnHeaders.sort(
    (
      a,
      b
    ) => {
      if (
        a.rowStart !==
        b.rowStart
      ) {
        return (
          a.rowStart -
          b.rowStart
        );
      }


      return (
        a.colStart -
        b.colStart
      );
    }
  );


  const result:
    string[] = [];


  const add =
    (
      id:
        string | undefined
    ) => {
      if (
        id &&
        !result.includes(
          id
        )
      ) {
        result.push(
          id
        );
      }
    };


  rowHeaders.forEach(
    (header) => {
      add(
        header.cell.id
      );
    }
  );


  columnHeaders.forEach(
    (header) => {
      add(
        header.cell.id
      );
    }
  );


  existing.forEach(
    (id) => {
      add(
        id
      );
    }
  );


  return result;
}


function getCellKey(
  logical:
    LogicalCell
): string {
  return (
    `r${logical.rowStart + 1}` +
    `c${logical.colStart + 1}`
  );
}


function buildHeaderAssociations(
  table: HTMLTableElement
): Map<
  string,
  Set<string>
> {
  const grid =
    buildTableGrid(
      table
    );


  const relationships =
    new Map<
      string,
      Set<string>
    >();


  grid.cells.forEach(
    (logical) => {
      if (
        logical.cell.tagName !==
        'TD'
      ) {
        return;
      }


      relationships.set(
        getCellKey(
          logical
        ),
        new Set(
          inferHeadersForCell(
            grid,
            logical
          )
        )
      );
    }
  );


  return relationships;
}


function applyHeaderRelationships(
  table: HTMLTableElement,
  relationships:
    Map<
      string,
      Set<string>
    >
): void {
  const grid =
    buildTableGrid(
      table
    );


  grid.cells.forEach(
    (logical) => {
      if (
        logical.cell.tagName !==
        'TD'
      ) {
        return;
      }


      const key =
        getCellKey(
          logical
        );


      const ids =
        Array.from(
          relationships.get(
            key
          ) ??
          []
        ).filter(
          Boolean
        );


      if (
        ids.length ===
        0
      ) {
        logical.cell
          .removeAttribute(
            'headers'
          );

        return;
      }


      logical.cell.setAttribute(
        'headers',
        ids.join(
          ' '
        )
      );
    }
  );
}


/* =========================================================
   COMPLEX TABLE DESCRIPTION
   ========================================================= */


function getGeneratedDescription(
  editor: Editor,
  table: HTMLTableElement
): HTMLElement | null {
  const describedBy =
    (
      table.getAttribute(
        'aria-describedby'
      ) ??
      ''
    )
      .split(/\s+/)
      .filter(
        Boolean
      );


  const candidates =
    Array.from(
      editor
        .getBody()
        .querySelectorAll<
          HTMLElement
        >(
          '[data-table-a11y-description="true"]'
        )
    );


  return (
    candidates.find(
      (candidate) =>
        describedBy.includes(
          candidate.id
        )
    ) ??
    null
  );
}


function appendAriaDescribedBy(
  table: HTMLTableElement,
  id: string
): void {
  const values =
    new Set(
      (
        table.getAttribute(
          'aria-describedby'
        ) ??
        ''
      )
        .split(/\s+/)
        .filter(
          Boolean
        )
    );


  values.add(
    id
  );


  table.setAttribute(
    'aria-describedby',
    Array.from(
      values
    ).join(
      ' '
    )
  );
}


function removeAriaDescribedBy(
  table: HTMLTableElement,
  id: string
): void {
  const values =
    (
      table.getAttribute(
        'aria-describedby'
      ) ??
      ''
    )
      .split(/\s+/)
      .filter(
        (value) =>
          value &&
          value !==
          id
      );


  if (
    values.length ===
    0
  ) {
    table.removeAttribute(
      'aria-describedby'
    );

    return;
  }


  table.setAttribute(
    'aria-describedby',
    values.join(
      ' '
    )
  );
}


/* =========================================================
   COMPLEXITY LABEL
   ========================================================= */


function getComplexityLabel(
  complexity:
    TableComplexity
): string {
  switch (
    complexity
  ) {
    case 'simple':
      return 'Simple';

    case 'grouped':
      return 'Grouped / irregular';

    case 'complex':
      return 'Complex / multi-level';
  }
}


/* =========================================================
   PREVIEW TABLE
   ========================================================= */


function createPreviewTable(
  table: HTMLTableElement
): HTMLTableElement {
  const preview =
    table.cloneNode(
      true
    ) as HTMLTableElement;


  /*
   * Prevent duplicate DOM IDs while
   * this preview is open.
   */
  preview
    .querySelectorAll(
      '[id]'
    )
    .forEach(
      (element) => {
        element.removeAttribute(
          'id'
        );
      }
    );


  preview
    .querySelectorAll(
      '[headers]'
    )
    .forEach(
      (element) => {
        element.removeAttribute(
          'headers'
        );
      }
    );


  const grid =
    buildTableGrid(
      preview
    );


  grid.cells.forEach(
    (logical) => {
      logical.cell.dataset
        .reviewCell =
        getCellKey(
          logical
        );
    }
  );


  return preview;
}


/* =========================================================
   COMPLEX TABLE REVIEWER
   ========================================================= */


function openComplexTableReviewer(
  editor: Editor,
  originalTable:
    HTMLTableElement,
  workingTable:
    HTMLTableElement,
  paragraphWrappersRemoved:
    number
): void {
  const tableNumber =
    getTableNumber(
      editor,
      originalTable
    );


  applyInferredHeaderScopes(
    workingTable
  );


  ensureHeaderIds(
    editor,
    workingTable,
    tableNumber
  );


  const structure =
    analyzeTableStructure(
      workingTable
    );


  const grid =
    buildTableGrid(
      workingTable
    );


  const relationships =
    buildHeaderAssociations(
      workingTable
    );


  const headerOptions:
    HeaderOption[] =
    grid.cells
      .filter(
        (logical) =>
          logical.cell
            .tagName ===
          'TH'
      )
      .map(
        (logical) => ({
          id:
            logical.cell.id,

          text:
            normalizeText(
              logical.cell
                .textContent ??
                ''
            ) ||
            '(empty header)',

          logicalCell:
            logical,
        })
      );


  const existingDescription =
    getGeneratedDescription(
      editor,
      originalTable
    );


  const backdrop =
    document.createElement(
      'div'
    );


  backdrop.className =
    'table-a11y-review-backdrop';


  const modal =
    document.createElement(
      'section'
    );


  modal.className =
    'table-a11y-review-modal';


  modal.setAttribute(
    'role',
    'dialog'
  );


  modal.setAttribute(
    'aria-modal',
    'true'
  );


  modal.setAttribute(
    'aria-labelledby',
    'table-a11y-review-title'
  );


  /* -------------------------
     HEADER
     ------------------------- */

  const modalHeader =
    document.createElement(
      'div'
    );


  modalHeader.className =
    'table-a11y-review-header';


  const title =
    document.createElement(
      'h2'
    );


  title.id =
    'table-a11y-review-title';


  title.textContent =
    'Complex Table Accessibility';


  const closeButton =
    document.createElement(
      'button'
    );


  closeButton.type =
    'button';


  closeButton.className =
    'table-a11y-review-close';


  closeButton.textContent =
    '×';


  closeButton.setAttribute(
    'aria-label',
    'Close complex table review'
  );


  modalHeader.append(
    title,
    closeButton
  );


  /* -------------------------
     SUMMARY
     ------------------------- */

  const summary =
    document.createElement(
      'div'
    );


  summary.className =
    'table-a11y-review-summary';


  const reasonHtml =
    structure.reasons.length >
    0
      ? `
        <ul>
          ${structure.reasons
            .map(
              (reason) =>
                `<li>${escapeHtml(
                  reason
                )}</li>`
            )
            .join('')}
        </ul>
      `
      : `
        <p>
          No complex structural
          conditions detected.
        </p>
      `;


  summary.innerHTML =
    `
      <div>
        <strong>
          Classification:
        </strong>

        ${escapeHtml(
          getComplexityLabel(
            structure.complexity
          )
        )}
      </div>

      <div>
        <strong>
          Logical grid:
        </strong>

        ${structure.grid.rows}
        row(s) ×
        ${structure.grid.columns}
        column(s)
      </div>

      <div>
        <strong>
          Header rows:
        </strong>

        ${structure.headerRows}
      </div>

      <div>
        <strong>
          Row-header columns:
        </strong>

        ${structure.rowHeaderColumns}
      </div>

      ${reasonHtml}
    `;


  /* -------------------------
     MAIN BODY
     ------------------------- */

  const body =
    document.createElement(
      'div'
    );


  body.className =
    'table-a11y-review-body';


  const previewPane =
    document.createElement(
      'div'
    );


  previewPane.className =
    'table-a11y-preview-pane';


  const previewHeading =
    document.createElement(
      'h3'
    );


  previewHeading.textContent =
    'Select a data cell';


  const previewHelp =
    document.createElement(
      'p'
    );


  previewHelp.textContent =
    'Click a data cell to review the headers associated with it.';


  const previewContainer =
    document.createElement(
      'div'
    );


  previewContainer.className =
    'table-a11y-table-preview';


  const previewTable =
    createPreviewTable(
      workingTable
    );


  previewContainer.appendChild(
    previewTable
  );


  previewPane.append(
    previewHeading,
    previewHelp,
    previewContainer
  );


  /* -------------------------
     RELATIONSHIP PANEL
     ------------------------- */

  const relationshipPane =
    document.createElement(
      'div'
    );


  relationshipPane.className =
    'table-a11y-relationship-pane';


  const selectedCellTitle =
    document.createElement(
      'h3'
    );


  selectedCellTitle.textContent =
    'Header relationships';


  const selectedCellInfo =
    document.createElement(
      'div'
    );


  selectedCellInfo.className =
    'table-a11y-selected-cell';


  selectedCellInfo.textContent =
    'Select a data cell in the table preview.';


  const headerList =
    document.createElement(
      'div'
    );


  headerList.className =
    'table-a11y-header-list';


  const descriptionLabel =
    document.createElement(
      'label'
    );


  descriptionLabel.className =
    'table-a11y-description-label';


  descriptionLabel.textContent =
    'Complex table description (optional)';


  const descriptionInput =
    document.createElement(
      'textarea'
    );


  descriptionInput.className =
    'table-a11y-description';


  descriptionInput.rows =
    4;


  descriptionInput.value =
    existingDescription
      ?.textContent ??
    '';


  descriptionInput.placeholder =
    'Example: Columns are grouped into personal contact information and work information.';


  relationshipPane.append(
    selectedCellTitle,
    selectedCellInfo,
    headerList,
    descriptionLabel,
    descriptionInput
  );


  body.append(
    previewPane,
    relationshipPane
  );


  /* -------------------------
     FOOTER
     ------------------------- */

  const footer =
    document.createElement(
      'div'
    );


  footer.className =
    'table-a11y-review-footer';


  const validationStatus =
    document.createElement(
      'div'
    );


  validationStatus.className =
    'table-a11y-validation-status';


  const actions =
    document.createElement(
      'div'
    );


  actions.className =
    'table-a11y-review-actions';


  const cancelButton =
    document.createElement(
      'button'
    );


  cancelButton.type =
    'button';


  cancelButton.className =
    'table-a11y-review-button';


  cancelButton.textContent =
    'Cancel';


  const applyButton =
    document.createElement(
      'button'
    );


  applyButton.type =
    'button';


  applyButton.className =
    'table-a11y-review-button table-a11y-review-primary';


  applyButton.textContent =
    'Apply relationships';


  actions.append(
    cancelButton,
    applyButton
  );


  footer.append(
    validationStatus,
    actions
  );


  modal.append(
    modalHeader,
    summary,
    body,
    footer
  );


  backdrop.appendChild(
    modal
  );


  document.body.appendChild(
    backdrop
  );


  const previousOverflow =
    document.body.style
      .overflow;


  document.body.style
    .overflow =
    'hidden';


  let selectedKey:
    string | null =
    null;


  function clearHighlights():
  void {
    previewTable
      .querySelectorAll(
        '.table-a11y-selected-data-cell'
      )
      .forEach(
        (cell) => {
          cell.classList.remove(
            'table-a11y-selected-data-cell'
          );
        }
      );


    previewTable
      .querySelectorAll(
        '.table-a11y-associated-header'
      )
      .forEach(
        (cell) => {
          cell.classList.remove(
            'table-a11y-associated-header'
          );
        }
      );
  }


  function highlightSelection():
  void {
    clearHighlights();


    if (
      !selectedKey
    ) {
      return;
    }


    const selectedCell =
      previewTable
        .querySelector<
          HTMLTableCellElement
        >(
          `[data-review-cell="${selectedKey}"]`
        );


    selectedCell
      ?.classList.add(
        'table-a11y-selected-data-cell'
      );


    const ids =
      relationships.get(
        selectedKey
      ) ??
      new Set<string>();


    ids.forEach(
      (id) => {
        const option =
          headerOptions.find(
            (header) =>
              header.id ===
              id
          );


        if (
          !option
        ) {
          return;
        }


        const headerKey =
          getCellKey(
            option.logicalCell
          );


        const previewHeader =
          previewTable
            .querySelector<
              HTMLTableCellElement
            >(
              `[data-review-cell="${headerKey}"]`
            );


        previewHeader
          ?.classList.add(
            'table-a11y-associated-header'
          );
      }
    );
  }


  function updateValidation():
  void {
    let cellsWithoutHeaders =
      0;


    relationships.forEach(
      (ids) => {
        if (
          ids.size ===
          0
        ) {
          cellsWithoutHeaders++;
        }
      }
    );


    if (
      cellsWithoutHeaders >
      0
    ) {
      validationStatus.textContent =
        `${cellsWithoutHeaders} data cell(s) currently have no header relationship.`;


      validationStatus
        .classList.add(
          'is-warning'
        );


      return;
    }


    validationStatus.textContent =
      'All data cells have at least one proposed header relationship.';


    validationStatus
      .classList.remove(
        'is-warning'
      );
  }


  function renderHeaderOptions():
  void {
    headerList.replaceChildren();


    if (
      !selectedKey
    ) {
      return;
    }


    const selectedLogical =
      grid.cells.find(
        (logical) =>
          getCellKey(
            logical
          ) ===
          selectedKey
      );


    if (
      !selectedLogical
    ) {
      return;
    }


    selectedCellInfo.innerHTML =
      `
        <strong>
          Selected cell:
        </strong>

        ${escapeHtml(
          normalizeText(
            selectedLogical
              .cell
              .textContent ??
              ''
          ) ||
          '(empty cell)'
        )}

        <br>

        <small>
          Row
          ${selectedLogical.rowStart + 1},
          column
          ${selectedLogical.colStart + 1}
        </small>
      `;


    const selectedRelationships =
      relationships.get(
        selectedKey
      ) ??
      new Set<string>();


    headerOptions.forEach(
      (header) => {
        const wrapper =
          document.createElement(
            'label'
          );


        wrapper.className =
          'table-a11y-header-option';


        const checkbox =
          document.createElement(
            'input'
          );


        checkbox.type =
          'checkbox';


        checkbox.checked =
          selectedRelationships.has(
            header.id
          );


        checkbox.addEventListener(
          'change',
          () => {
            let ids =
              relationships.get(
                selectedKey!
              );


            if (
              !ids
            ) {
              ids =
                new Set<string>();


              relationships.set(
                selectedKey!,
                ids
              );
            }


            if (
              checkbox.checked
            ) {
              ids.add(
                header.id
              );
            } else {
              ids.delete(
                header.id
              );
            }


            highlightSelection();

            updateValidation();
          }
        );


        const text =
          document.createElement(
            'span'
          );


        text.innerHTML =
          `
            <strong>
              ${escapeHtml(
                header.text
              )}
            </strong>

            <small>
              ID:
              ${escapeHtml(
                header.id
              )}

              · Row
              ${header.logicalCell.rowStart + 1}

              · Column
              ${header.logicalCell.colStart + 1}
            </small>
          `;


        wrapper.append(
          checkbox,
          text
        );


        headerList.appendChild(
          wrapper
        );
      }
    );


    highlightSelection();
  }


  previewTable.addEventListener(
    'click',
    (event) => {
      const target =
        event.target as
        HTMLElement;


      const cell =
        target.closest<
          HTMLTableCellElement
        >(
          'td'
        );


      if (
        !cell
      ) {
        return;
      }


      const key =
        cell.dataset
          .reviewCell;


      if (
        !key
      ) {
        return;
      }


      selectedKey =
        key;


      renderHeaderOptions();
    }
  );


  function closeReviewer():
  void {
    document.body.style
      .overflow =
      previousOverflow;


    backdrop.remove();


    editor.focus();
  }


  function applyReviewedTable():
  void {
    applyHeaderRelationships(
      workingTable,
      relationships
    );


    const description =
      descriptionInput.value
        .trim();


    const generatedDescription =
      getGeneratedDescription(
        editor,
        originalTable
      );


    editor.undoManager.transact(
      () => {
        if (
          generatedDescription
        ) {
          if (
            description
          ) {
            generatedDescription
              .textContent =
              description;


            appendAriaDescribedBy(
              workingTable,
              generatedDescription.id
            );
          } else {
            removeAriaDescribedBy(
              workingTable,
              generatedDescription.id
            );


            generatedDescription.remove();
          }
        }

        else if (
          description
        ) {
          const reserved =
            new Set<string>();


          const descriptionId =
            createUniqueId(
              editor,
              `tbl-${tableNumber}-description`,
              reserved
            );


          const descriptionElement =
            originalTable
              .ownerDocument
              .createElement(
                'p'
              );


          descriptionElement.id =
            descriptionId;


          descriptionElement
            .setAttribute(
              'data-table-a11y-description',
              'true'
            );


          descriptionElement
            .textContent =
            description;


          originalTable
            .parentNode
            ?.insertBefore(
              descriptionElement,
              originalTable
            );


          appendAriaDescribedBy(
            workingTable,
            descriptionId
          );
        }


        originalTable.replaceWith(
          workingTable
        );


        editor.nodeChanged();
      }
    );


    closeReviewer();


    let message =
      'Complex table accessibility relationships applied.';


    if (
      paragraphWrappersRemoved >
      0
    ) {
      message +=
        ` ${paragraphWrappersRemoved} simple paragraph wrapper(s) removed.`;
    }


    editor
      .notificationManager
      .open({
        text:
          message,

        type:
          'success',

        timeout:
          5000,
      });
  }


  closeButton.addEventListener(
    'click',
    closeReviewer
  );


  cancelButton.addEventListener(
    'click',
    closeReviewer
  );


  applyButton.addEventListener(
    'click',
    applyReviewedTable
  );


  backdrop.addEventListener(
    'click',
    (event) => {
      if (
        event.target ===
        backdrop
      ) {
        closeReviewer();
      }
    }
  );


  updateValidation();


  /*
   * Select first data cell automatically.
   */
  const firstDataCell =
    grid.cells.find(
      (logical) =>
        logical.cell.tagName ===
        'TD'
    );


  if (
    firstDataCell
  ) {
    selectedKey =
      getCellKey(
        firstDataCell
      );


    renderHeaderOptions();
  }
}


/* =========================================================
   HEADER ROW SELECT OPTIONS
   ========================================================= */


function createHeaderRowOptions(
  table: HTMLTableElement
): Array<{
  text: string;

  value: string;
}> {
  const rowCount =
    table.rows.length;


  const maximum =
    Math.min(
      Math.max(
        rowCount - 1,
        0
      ),
      6
    );


  const options:
    Array<{
      text: string;

      value: string;
    }> = [
      {
        text:
          'No top header rows',

        value:
          '0',
      },
    ];


  for (
    let count =
      1;
    count <=
      maximum;
    count++
  ) {
    options.push({
      text:
        count ===
          1
          ? 'First row'
          : `First ${count} rows`,

      value:
        String(
          count
        ),
    });
  }


  return options;
}


/* =========================================================
   ANALYSIS REPORT
   ========================================================= */


function createAnalysisHtml(
  analysis:
    TableAnalysis
): string {
  const reasons =
    analysis
      .complexityReasons
      .length >
    0
      ? `
        <ul>
          ${analysis
            .complexityReasons
            .map(
              (reason) =>
                `<li>${escapeHtml(
                  reason
                )}</li>`
            )
            .join('')}
        </ul>
      `
      : `
        <p>
          No complex-table indicators
          were detected.
        </p>
      `;


  const suggestedHeaders =
    analysis
      .suggestedHeaderRows >
    0
      ? `
        <div
          style="
            margin-top: 14px;
            padding: 12px;
            background: #eef5ff;
            border-radius: 6px;
          "
        >
          <strong>
            Suggested header structure:
          </strong>

          First
          ${analysis.suggestedHeaderRows}
          row(s).

          <br>

          <small>
            This is only a suggestion.
            The coder must confirm it below.
          </small>
        </div>
      `
      : '';


  const warnings =
    analysis.warnings.length >
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
            ${analysis.warnings
              .map(
                (warning) =>
                  `<li>${escapeHtml(
                    warning
                  )}</li>`
              )
              .join('')}
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
          No obvious table accessibility
          issues detected.
        </div>
      `;


  return `
    <div>

      <h3
        style="
          margin-top: 0;
        "
      >
        Table analysis
      </h3>

      <table>

        <tr>
          <td>
            Classification
          </td>

          <td
            style="
              padding-left: 20px;
            "
          >
            <strong>
              ${escapeHtml(
                getComplexityLabel(
                  analysis.complexity
                )
              )}
            </strong>
          </td>
        </tr>

        <tr>
          <td>
            Rows
          </td>

          <td
            style="
              padding-left: 20px;
            "
          >
            <strong>
              ${analysis.rows}
            </strong>
          </td>
        </tr>

        <tr>
          <td>
            Columns
          </td>

          <td
            style="
              padding-left: 20px;
            "
          >
            <strong>
              ${analysis.columns}
            </strong>
          </td>
        </tr>

        <tr>
          <td>
            Existing TH cells
          </td>

          <td
            style="
              padding-left: 20px;
            "
          >
            <strong>
              ${analysis.headerCells}
            </strong>
          </td>
        </tr>

        <tr>
          <td>
            Merged cells
          </td>

          <td
            style="
              padding-left: 20px;
            "
          >
            <strong>
              ${analysis.mergedCells}
            </strong>
          </td>
        </tr>

        <tr>
          <td>
            Safe paragraph wrappers
          </td>

          <td
            style="
              padding-left: 20px;
            "
          >
            <strong>
              ${analysis.safeParagraphWrappers}
            </strong>
          </td>
        </tr>

      </table>


      ${suggestedHeaders}


      <h3>
        Structure indicators
      </h3>

      ${reasons}

      ${warnings}

    </div>
  `;
}


/* =========================================================
   TINYMCE ACCESSIBILITY DIALOG
   ========================================================= */


function openTableAccessibilityDialog(
  editor: Editor,
  table: HTMLTableElement
): void {
  const analysis =
    analyzeTable(
      table
    );


  const existingHeaderRows =
    detectExistingHeaderRows(
      table
    );


  const initialHeaderRows =
    existingHeaderRows >
      0
      ? existingHeaderRows
      : analysis
          .suggestedHeaderRows;


  editor.windowManager.open({
    title:
      'Table Accessibility',

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
            createAnalysisHtml(
              analysis
            ),
        },

        {
          type:
            'input',

          name:
            'caption',

          label:
            'Table caption',

          placeholder:
            'Describe the purpose of this table',
        },

        {
          type:
            'selectbox',

          name:
            'headerRowCount',

          label:
            'Top rows used as column headers',

          items:
            createHeaderRowOptions(
              table
            ),
        },

        {
          type:
            'checkbox',

          name:
            'firstColumnHeaders',

          label:
            'Use the first column of data rows as row headers',
        },

        {
          type:
            'checkbox',

          name:
            'normalizeSections',

          label:
            'Add/normalize THEAD and TBODY',
        },

        {
          type:
            'checkbox',

          name:
            'removeParagraphWrappers',

          label:
            'Remove simple <p> wrappers inside TH and TD cells',
        },
      ],
    },

    initialData: {
      caption:
        analysis.caption,

      headerRowCount:
        String(
          initialHeaderRows
        ),

      firstColumnHeaders:
        analysis
          .firstColumnHasRowHeaders,

      normalizeSections:
        true,

      removeParagraphWrappers:
        false,
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
          analysis.complexity ===
          'complex'
            ? 'Review relationships'
            : 'Apply accessibility',

        buttonType:
          'primary',
      },
    ],

    onSubmit:
      (api) => {
        const data =
          api.getData();


        const rawHeaderRowCount =
          typeof data
            .headerRowCount ===
            'string'
            ? Number(
                data.headerRowCount
              )
            : 0;


        const headerRowCount =
          Number.isFinite(
            rawHeaderRowCount
          )
            ? Math.max(
                0,
                Math.min(
                  rawHeaderRowCount,
                  Math.max(
                    table.rows.length -
                      1,
                    0
                  )
                )
              )
            : 0;


        const options:
          TableAccessibilityOptions = {
            caption:
              typeof data
                .caption ===
                'string'
                ? data.caption
                : '',

            headerRowCount,

            firstColumnHeaders:
              data
                .firstColumnHeaders ===
              true,

            normalizeSections:
              data
                .normalizeSections ===
              true,

            removeParagraphWrappers:
              data
                .removeParagraphWrappers ===
              true,
          };


        const result =
          createAccessibleTable(
            table,
            options
          );


        /*
         * Re-analyze AFTER the coder's
         * header-row decision.
         *
         * This is critical.
         */
        const finalStructure =
          analyzeTableStructure(
            result.table
          );


        if (
          finalStructure
            .complexity ===
          'complex'
        ) {
          api.close();


          openComplexTableReviewer(
            editor,
            table,
            result.table,
            result
              .paragraphWrappersRemoved
          );


          return;
        }


        editor.undoManager.transact(
          () => {
            table.replaceWith(
              result.table
            );


            editor.nodeChanged();
          }
        );


        api.close();


        let message =
          'Table accessibility changes applied.';


        if (
          result
            .paragraphWrappersRemoved >
          0
        ) {
          message +=
            ` ${result.paragraphWrappersRemoved} paragraph wrapper(s) removed.`;
        }


        editor
          .notificationManager
          .open({
            text:
              message,

            type:
              finalStructure
                .complexity ===
              'grouped'
                ? 'warning'
                : 'success',

            timeout:
              4500,
          });
      },
  });
}


/* =========================================================
   TINYMCE TOOLBAR BUTTON
   ========================================================= */


export function registerTableAccessibilityButton(
  editor: Editor
): void {
  editor.ui.registry.addButton(
    'tableaccessibility',
    {
      text:
        'Table Accessibility',

      tooltip:
        'Analyze and improve the selected table',

      onAction:
        () => {
          const table =
            getSelectedTable(
              editor
            );


          if (
            !table
          ) {
            editor
              .notificationManager
              .open({
                text:
                  'Click inside a table first, then choose Table Accessibility.',

                type:
                  'info',

                timeout:
                  4000,
              });


            return;
          }


          openTableAccessibilityDialog(
            editor,
            table
          );
        },
    }
  );
}