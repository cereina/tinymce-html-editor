import type {
  Editor,
} from 'tinymce';

import './table-workstation.css';


/* =========================================================
   TYPES
   ========================================================= */


type TableComplexity =
  | 'simple'
  | 'grouped'
  | 'complex';


type IssueSeverity =
  | 'error'
  | 'warning'
  | 'review';


interface LogicalCell {
  cell:
    HTMLTableCellElement;

  rowStart:
    number;

  rowEnd:
    number;

  colStart:
    number;

  colEnd:
    number;
}


interface TableGrid {
  rows:
    number;

  columns:
    number;

  cells:
    LogicalCell[];

  matrix:
    Array<
      Array<
        LogicalCell | null
      >
    >;
}


interface TableIssue {
  severity:
    IssueSeverity;

  title:
    string;

  detail:
    string;

  target:
    HTMLElement | null;
}


interface TableReport {
  table:
    HTMLTableElement;

  index:
    number;

  label:
    string;

  rows:
    number;

  columns:
    number;

  complexity:
    TableComplexity;

  hasCaption:
    boolean;

  caption:
    string;

  hasThead:
    boolean;

  hasTbody:
    boolean;

  tbodyCount:
    number;

  headerCells:
    number;

  dataCells:
    number;

  headerRows:
    number;

  suggestedHeaderRows:
    number;

  rowHeaderCells:
    number;

  mergedHeaderCells:
    number;

  mergedDataCells:
    number;

  headerCellsWithoutScope:
    number;

  emptyHeaderCells:
    number;

  dataCellsWithHeadersAttribute:
    number;

  dataCellsNeedingReview:
    number;

  duplicateIds:
    string[];

  brokenHeaderReferences:
    string[];

  missingDescriptionTargets:
    string[];

  issues:
    TableIssue[];
}


interface DocumentTableSummary {
  tables:
    number;

  simple:
    number;

  grouped:
    number;

  complex:
    number;

  passed:
    number;

  review:
    number;

  errors:
    number;

  totalIssues:
    number;
}


type WorkstationView =
  | 'document'
  | 'table';


/* =========================================================
   STATE
   ========================================================= */


let activeTableWorkstationClose:
  (() => void) | null =
  null;


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


function truncate(
  value: string,
  maxLength = 70
): string {
  if (
    value.length <=
    maxLength
  ) {
    return value;
  }


  return (
    `${value.substring(
      0,
      maxLength - 3
    )}...`
  );
}


function parseIdReferenceList(
  value: string | null
): string[] {
  if (
    !value
  ) {
    return [];
  }


  return value
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
}


/* =========================================================
   TABLE GRID
   ========================================================= */


function buildTableGrid(
  table: HTMLTableElement
): TableGrid {
  const rows =
    Array.from(
      table.rows
    );


  const matrix:
    Array<
      Array<
        LogicalCell | null
      >
    > = [];


  const cells:
    LogicalCell[] =
    [];


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
        (
          cell
        ) => {
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
              1,
              cell.rowSpan ||
                1
            );


          const colSpan =
            Math.max(
              1,
              cell.colSpan ||
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
              logicalCell.rowStart;
            r <=
              logicalCell.rowEnd;
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
                logicalCell.colStart;
              c <=
                logicalCell.colEnd;
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


  matrix.forEach(
    (
      row
    ) => {
      while (
        row.length <
        maxColumns
      ) {
        row.push(
          null
        );
      }
    }
  );


  return {
    rows:
      rows.length,

    columns:
      maxColumns,

    cells,

    matrix,
  };
}


/* =========================================================
   DOCUMENT ID ANALYSIS
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
        ) +
          1
      );
    }
  );


  return counts;
}


/* =========================================================
   TABLE LABEL
   ========================================================= */


function getTableLabel(
  table:
    HTMLTableElement,
  index:
    number
): string {
  const caption =
    normalizeText(
      table.caption
        ?.textContent ??
        ''
    );


  if (
    caption
  ) {
    return truncate(
      caption
    );
  }


  const ariaLabel =
    normalizeText(
      table.getAttribute(
        'aria-label'
      ) ??
        ''
    );


  if (
    ariaLabel
  ) {
    return truncate(
      ariaLabel
    );
  }


  const labelledBy =
    parseIdReferenceList(
      table.getAttribute(
        'aria-labelledby'
      )
    );


  for (
    const id of labelledBy
  ) {
    const target =
      table.ownerDocument
        .getElementById(
          id
        );


    const text =
      normalizeText(
        target
          ?.textContent ??
          ''
      );


    if (
      text
    ) {
      return truncate(
        text
      );
    }
  }


  const firstHeader =
    table.querySelector(
      'th'
    );


  const firstHeaderText =
    normalizeText(
      firstHeader
        ?.textContent ??
        ''
    );


  if (
    firstHeaderText
  ) {
    return truncate(
      firstHeaderText
    );
  }


  return (
    `Table ${index + 1}`
  );
}


/* =========================================================
   HEADER ANALYSIS
   ========================================================= */


function detectHeaderRows(
  table:
    HTMLTableElement
): number {
  const rows =
    Array.from(
      table.rows
    );


  let count =
    0;


  for (
    const row of rows
  ) {
    const cells =
      Array.from(
        row.cells
      );


    if (
      cells.length ===
      0
    ) {
      break;
    }


    if (
      cells.every(
        (
          cell
        ) =>
          cell.tagName ===
          'TH'
      )
    ) {
      count++;

      continue;
    }


    break;
  }


  return count;
}


function detectSuggestedHeaderRows(
  table:
    HTMLTableElement
): number {
  const existing =
    detectHeaderRows(
      table
    );


  if (
    existing >
    0
  ) {
    return existing;
  }


  const rows =
    Array.from(
      table.rows
    );


  const firstRow =
    rows[
      0
    ];


  if (
    !firstRow
  ) {
    return 0;
  }


  const firstCells =
    Array.from(
      firstRow.cells
    );


  const hasMergedStructure =
    firstCells.some(
      (
        cell
      ) =>
        cell.colSpan >
          1 ||
        cell.rowSpan >
          1
    );


  if (
    !hasMergedStructure
  ) {
    return 0;
  }


  return (
    rows.length >
    1
      ? 2
      : 1
  );
}


function isLikelyRowHeader(
  logicalCell:
    LogicalCell
): boolean {
  const scope =
    logicalCell.cell
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
    return true;
  }


  return (
    logicalCell.cell
      .tagName ===
      'TH' &&
    logicalCell
      .colStart ===
      0
  );
}


/* =========================================================
   HEADERS REFERENCES
   ========================================================= */


function getBrokenHeaderReferences(
  table:
    HTMLTableElement
): string[] {
  const broken =
    new Set<string>();


  const document =
    table.ownerDocument;


  Array.from(
    table.querySelectorAll<
      HTMLTableCellElement
    >(
      'td[headers], th[headers]'
    )
  ).forEach(
    (
      cell
    ) => {
      const ids =
        parseIdReferenceList(
          cell.getAttribute(
            'headers'
          )
        );


      ids.forEach(
        (
          id
        ) => {
          const target =
            document
              .getElementById(
                id
              );


          if (
            !target ||
            target.tagName !==
              'TH'
          ) {
            broken.add(
              id
            );
          }
        }
      );
    }
  );


  return Array.from(
    broken
  );
}


/* =========================================================
   DESCRIPTION REFERENCES
   ========================================================= */


function getMissingDescriptionTargets(
  table:
    HTMLTableElement
): string[] {
  const ids =
    parseIdReferenceList(
      table.getAttribute(
        'aria-describedby'
      )
    );


  return ids.filter(
    (
      id
    ) =>
      !table.ownerDocument
        .getElementById(
          id
        )
  );
}


/* =========================================================
   HEADER ASSOCIATION ANALYSIS
   ========================================================= */


function rangesOverlap(
  startA:
    number,
  endA:
    number,
  startB:
    number,
  endB:
    number
): boolean {
  return (
    startA <=
      endB &&
    startB <=
      endA
  );
}


function hasValidExplicitHeaders(
  cell:
    HTMLTableCellElement
): boolean {
  const ids =
    parseIdReferenceList(
      cell.getAttribute(
        'headers'
      )
    );


  if (
    ids.length ===
    0
  ) {
    return false;
  }


  return ids.every(
    (
      id
    ) => {
      const target =
        cell.ownerDocument
          .getElementById(
            id
          );


      return Boolean(
        target &&
        target.tagName ===
          'TH'
      );
    }
  );
}


function hasScopeBasedAssociation(
  logicalCell:
    LogicalCell,
  grid:
    TableGrid
): boolean {
  const headers =
    grid.cells.filter(
      (
        item
      ) =>
        item.cell
          .tagName ===
        'TH'
    );


  for (
    const header of headers
  ) {
    const scope =
      header.cell
        .getAttribute(
          'scope'
        )
        ?.toLowerCase() ??
      '';


    const isInThead =
      Boolean(
        header.cell
          .closest(
            'thead'
          )
      );


    const columnOverlap =
      rangesOverlap(
        header.colStart,
        header.colEnd,
        logicalCell.colStart,
        logicalCell.colEnd
      );


    const isAbove =
      header.rowEnd <
      logicalCell.rowStart;


    if (
      columnOverlap &&
      isAbove &&
      (
        scope ===
          'col' ||
        scope ===
          'colgroup' ||
        isInThead
      )
    ) {
      return true;
    }


    const rowOverlap =
      rangesOverlap(
        header.rowStart,
        header.rowEnd,
        logicalCell.rowStart,
        logicalCell.rowEnd
      );


    const isLeft =
      header.colEnd <
      logicalCell.colStart;


    if (
      rowOverlap &&
      isLeft &&
      (
        scope ===
          'row' ||
        scope ===
          'rowgroup' ||
        header.colStart ===
          0
      )
    ) {
      return true;
    }
  }


  return false;
}


/* =========================================================
   COMPLEXITY
   ========================================================= */


function determineComplexity(
  mergedHeaderCells:
    number,
  mergedDataCells:
    number,
  existingHeadersAttributes:
    number,
  tbodyCount:
    number,
  headerRows:
    number,
  rowHeaderCells:
    number
): TableComplexity {
  if (
    mergedDataCells >
      0 ||
    existingHeadersAttributes >
      0 ||
    tbodyCount >
      1
  ) {
    return 'complex';
  }


  if (
    mergedHeaderCells >
      0 ||
    headerRows >
      1 ||
    rowHeaderCells >
      0
  ) {
    return 'grouped';
  }


  return 'simple';
}


/* =========================================================
   TABLE ANALYSIS
   ========================================================= */


function analyzeTable(
  table:
    HTMLTableElement,
  index:
    number,
  documentIdCounts:
    Map<
      string,
      number
    >
): TableReport {
  const grid =
    buildTableGrid(
      table
    );


  const allCells =
    grid.cells;


  const headers =
    allCells.filter(
      (
        item
      ) =>
        item.cell
          .tagName ===
        'TH'
    );


  const dataCells =
    allCells.filter(
      (
        item
      ) =>
        item.cell
          .tagName ===
        'TD'
    );


  const headerRows =
    detectHeaderRows(
      table
    );


  const suggestedHeaderRows =
    detectSuggestedHeaderRows(
      table
    );


  const rowHeaderCells =
    headers.filter(
      isLikelyRowHeader
    ).length;


  const mergedHeaderCells =
    headers.filter(
      (
        item
      ) =>
        item.cell.colSpan >
          1 ||
        item.cell.rowSpan >
          1
    ).length;


  const mergedDataCells =
    dataCells.filter(
      (
        item
      ) =>
        item.cell.colSpan >
          1 ||
        item.cell.rowSpan >
          1
    ).length;


  const existingHeadersAttributes =
    allCells.filter(
      (
        item
      ) =>
        parseIdReferenceList(
          item.cell
            .getAttribute(
              'headers'
            )
        ).length >
        0
    ).length;


  const headerCellsWithoutScope =
    headers.filter(
      (
        item
      ) =>
        !item.cell
          .getAttribute(
            'scope'
          )
    ).length;


  const emptyHeaderCells =
    headers.filter(
      (
        item
      ) =>
        !normalizeText(
          item.cell
            .textContent ??
            ''
        ) &&
        !normalizeText(
          item.cell
            .getAttribute(
              'aria-label'
            ) ??
            ''
        )
    ).length;


  const dataCellsWithHeadersAttribute =
    dataCells.filter(
      (
        item
      ) =>
        parseIdReferenceList(
          item.cell
            .getAttribute(
              'headers'
            )
        ).length >
        0
    ).length;


  const dataCellsNeedingReview =
    dataCells.filter(
      (
        item
      ) =>
        !hasValidExplicitHeaders(
          item.cell
        ) &&
        !hasScopeBasedAssociation(
          item,
          grid
        )
    ).length;


  const duplicateIds =
    Array.from(
      table.querySelectorAll<
        HTMLElement
      >(
        '[id]'
      )
    )
      .map(
        (
          element
        ) =>
          element.id
      )
      .filter(
        (
          id
        ) =>
          Boolean(
            id
          ) &&
          (
            documentIdCounts.get(
              id
            ) ??
            0
          ) >
            1
      )
      .filter(
        (
          id,
          position,
          array
        ) =>
          array.indexOf(
            id
          ) ===
          position
      );


  const brokenHeaderReferences =
    getBrokenHeaderReferences(
      table
    );


  const missingDescriptionTargets =
    getMissingDescriptionTargets(
      table
    );


  const caption =
    normalizeText(
      table.caption
        ?.textContent ??
        ''
    );


  const hasCaption =
    Boolean(
      caption
    );


  const tbodyCount =
    table.tBodies.length;


  const hasTbody =
    tbodyCount >
    0;


  const hasThead =
    Boolean(
      table.tHead
    );


  const complexity =
    determineComplexity(
      mergedHeaderCells,
      mergedDataCells,
      existingHeadersAttributes,
      tbodyCount,
      headerRows,
      rowHeaderCells
    );


  const issues:
    TableIssue[] = [];


  if (
    !hasCaption
  ) {
    issues.push({
      severity:
        'warning',

      title:
        'Missing table caption',

      detail:
        'The table does not have a meaningful caption.',

      target:
        table,
    });
  }


  if (
    headers.length ===
    0
  ) {
    issues.push({
      severity:
        'error',

      title:
        'No header cells detected',

      detail:
        suggestedHeaderRows >
          0
          ? `The first ${suggestedHeaderRows} row(s) appear structurally similar to headers, but they currently use TD cells.`
          : 'No TH elements were found in this table.',

      target:
        table.rows[
          0
        ] ??
        table,
    });
  }


  if (
    suggestedHeaderRows >
      0 &&
    headerRows ===
      0
  ) {
    issues.push({
      severity:
        'review',

      title:
        'Possible header rows detected',

      detail:
        `The first ${suggestedHeaderRows} row(s) contain structural clues such as colspan or rowspan. Confirm whether they should be table headers.`,

      target:
        table.rows[
          0
        ] ??
        table,
    });
  }


  if (
    headers.length >
      0 &&
    !hasThead
  ) {
    issues.push({
      severity:
        'warning',

      title:
        'No THEAD detected',

      detail:
        'Header cells exist, but the table does not currently contain a THEAD element.',

      target:
        headers[
          0
        ]?.cell ??
        table,
    });
  }


  if (
    !hasTbody
  ) {
    issues.push({
      severity:
        'warning',

      title:
        'No TBODY detected',

      detail:
        'The table does not currently contain a TBODY element.',

      target:
        table,
    });
  }


  if (
    tbodyCount >
      1
  ) {
    issues.push({
      severity:
        'review',

      title:
        'Multiple TBODY groups',

      detail:
        `The table contains ${tbodyCount} TBODY elements. Confirm whether row groups are intentional.`,

      target:
        table,
    });
  }


  if (
    headerCellsWithoutScope >
    0
  ) {
    issues.push({
      severity:
        complexity ===
        'complex'
          ? 'review'
          : 'warning',

      title:
        'Header cells without scope',

      detail:
        `${headerCellsWithoutScope} TH cell(s) do not have a scope attribute. Complex tables may instead use explicit id/headers relationships.`,

      target:
        headers.find(
          (
            item
          ) =>
            !item.cell
              .getAttribute(
                'scope'
              )
        )?.cell ??
        table,
    });
  }


  if (
    emptyHeaderCells >
    0
  ) {
    issues.push({
      severity:
        'warning',

      title:
        'Empty header cells',

      detail:
        `${emptyHeaderCells} TH cell(s) contain no meaningful text or aria-label.`,

      target:
        headers.find(
          (
            item
          ) =>
            !normalizeText(
              item.cell
                .textContent ??
                ''
            )
        )?.cell ??
        table,
    });
  }


  if (
    brokenHeaderReferences.length >
    0
  ) {
    issues.push({
      severity:
        'error',

      title:
        'Broken headers references',

      detail:
        `The following headers reference(s) do not resolve to TH elements: ${brokenHeaderReferences.join(
          ', '
        )}.`,

      target:
        table.querySelector<
          HTMLElement
        >(
          '[headers]'
        ) ??
        table,
    });
  }


  if (
    duplicateIds.length >
    0
  ) {
    issues.push({
      severity:
        'error',

      title:
        'Duplicate IDs',

      detail:
        `Duplicate ID(s) used by this table: ${duplicateIds.join(
          ', '
        )}.`,

      target:
        table.querySelector<
          HTMLElement
        >(
          '[id]'
        ) ??
        table,
    });
  }


  if (
    missingDescriptionTargets.length >
    0
  ) {
    issues.push({
      severity:
        'error',

      title:
        'Broken aria-describedby reference',

      detail:
        `The following description target(s) do not exist: ${missingDescriptionTargets.join(
          ', '
        )}.`,

      target:
        table,
    });
  }


  if (
    mergedDataCells >
    0
  ) {
    issues.push({
      severity:
        'review',

      title:
        'Merged data cells',

      detail:
        `${mergedDataCells} TD cell(s) use rowspan or colspan. Manual header-association review is recommended.`,

      target:
        dataCells.find(
          (
            item
          ) =>
            item.cell.colSpan >
              1 ||
            item.cell.rowSpan >
              1
        )?.cell ??
        table,
    });
  }


  if (
    headers.length >
      0 &&
    dataCellsNeedingReview >
      0
  ) {
    issues.push({
      severity:
        complexity ===
        'simple'
          ? 'warning'
          : 'review',

      title:
        'Data cells need header review',

      detail:
        `${dataCellsNeedingReview} data cell(s) do not currently have an explicit valid headers relationship or an obvious scope-based association.`,

      target:
        dataCells.find(
          (
            item
          ) =>
            !hasValidExplicitHeaders(
              item.cell
            ) &&
            !hasScopeBasedAssociation(
              item,
              grid
            )
        )?.cell ??
        table,
    });
  }


  return {
    table,

    index,

    label:
      getTableLabel(
        table,
        index
      ),

    rows:
      grid.rows,

    columns:
      grid.columns,

    complexity,

    hasCaption,

    caption,

    hasThead,

    hasTbody,

    tbodyCount,

    headerCells:
      headers.length,

    dataCells:
      dataCells.length,

    headerRows,

    suggestedHeaderRows,

    rowHeaderCells,

    mergedHeaderCells,

    mergedDataCells,

    headerCellsWithoutScope,

    emptyHeaderCells,

    dataCellsWithHeadersAttribute,

    dataCellsNeedingReview,

    duplicateIds,

    brokenHeaderReferences,

    missingDescriptionTargets,

    issues,
  };
}


/* =========================================================
   DOCUMENT ANALYSIS
   ========================================================= */


function analyzeDocumentTables(
  editor: Editor
): TableReport[] {
  const body =
    editor.getBody();


  const tables =
    Array.from(
      body.querySelectorAll<
        HTMLTableElement
      >(
        'table'
      )
    );


  const idCounts =
    getDocumentIdCounts(
      body
    );


  return tables.map(
    (
      table,
      index
    ) =>
      analyzeTable(
        table,
        index,
        idCounts
      )
  );
}


/* =========================================================
   STATUS
   ========================================================= */


function getTableStatus(
  report:
    TableReport
):
  | 'pass'
  | 'review'
  | 'error' {
  if (
    report.issues.some(
      (
        issue
      ) =>
        issue.severity ===
        'error'
    )
  ) {
    return 'error';
  }


  if (
    report.issues.length >
    0
  ) {
    return 'review';
  }


  return 'pass';
}


function getStatusIcon(
  status:
    'pass'
    | 'review'
    | 'error'
): string {
  switch (
    status
  ) {
    case 'pass':
      return '✓';

    case 'error':
      return '✕';

    default:
      return '⚠';
  }
}


function getDocumentSummary(
  reports:
    TableReport[]
): DocumentTableSummary {
  return {
    tables:
      reports.length,

    simple:
      reports.filter(
        (
          report
        ) =>
          report.complexity ===
          'simple'
      ).length,

    grouped:
      reports.filter(
        (
          report
        ) =>
          report.complexity ===
          'grouped'
      ).length,

    complex:
      reports.filter(
        (
          report
        ) =>
          report.complexity ===
          'complex'
      ).length,

    passed:
      reports.filter(
        (
          report
        ) =>
          getTableStatus(
            report
          ) ===
          'pass'
      ).length,

    review:
      reports.filter(
        (
          report
        ) =>
          getTableStatus(
            report
          ) ===
          'review'
      ).length,

    errors:
      reports.filter(
        (
          report
        ) =>
          getTableStatus(
            report
          ) ===
          'error'
      ).length,

    totalIssues:
      reports.reduce(
        (
          total,
          report
        ) =>
          total +
          report.issues.length,
        0
      ),
  };
}


/* =========================================================
   CURRENT TABLE
   ========================================================= */


function getCurrentTable(
  editor:
    Editor
): HTMLTableElement | null {
  const node =
    editor.selection.getNode();


  if (
    !node ||
    node.nodeType !==
      1
  ) {
    return null;
  }


  const table =
    (
      node as
        Element
    ).closest(
      'table'
    );


  return (
    table
      ? table as
          HTMLTableElement
      : null
  );
}


/* =========================================================
   EDITOR NAVIGATION
   ========================================================= */


function selectElementInEditor(
  editor:
    Editor,
  element:
    HTMLElement
): void {
  editor.focus();


  editor.selection.select(
    element,
    true
  );


  element.scrollIntoView({
    behavior:
      'smooth',

    block:
      'center',

    inline:
      'nearest',
  });


  editor.nodeChanged();
}


/* =========================================================
   PREVIEW
   ========================================================= */


/* =========================================================
   SAFE PREVIEW SANITIZATION
   ========================================================= */


const PREVIEW_BLOCKED_SELECTOR =
  'script, style, iframe, object, embed, link, meta, base, ' +
  'form, input, button, select, textarea, video, audio, ' +
  'source, track, canvas, svg';


const PREVIEW_URL_ATTRIBUTES =
  new Set<string>([
    'src',
    'srcset',
    'href',
    'xlink:href',
    'action',
    'formaction',
    'poster',
    'data',
    'ping',
    'background',
  ]);


/**
 * Preview content is copied from the
 * editable document into the main app DOM.
 *
 * Strip active content, event handlers,
 * inline CSS and URL-bearing attributes so
 * a preview cannot execute code, submit a
 * form, navigate, or load a remote resource.
 */
function sanitizePreviewClone(
  root: HTMLElement
): void {
  root
    .querySelectorAll(
      PREVIEW_BLOCKED_SELECTOR
    )
    .forEach(
      (element) => {
        element.remove();
      }
    );


  const elements: HTMLElement[] = [
    root,
    ...Array.from(
      root.querySelectorAll<HTMLElement>(
        '*'
      )
    ),
  ];


  elements.forEach(
    (element) => {
      Array.from(
        element.attributes
      ).forEach(
        (attribute) => {
          const name =
            attribute.name
              .toLowerCase();


          if (
            name.startsWith(
              'on'
            ) ||
            name ===
              'style' ||
            PREVIEW_URL_ATTRIBUTES
              .has(
                name
              )
          ) {
            element.removeAttribute(
              attribute.name
            );
          }
        }
      );
    }
  );
}


function createPreviewTable(
  report:
    TableReport
): HTMLElement {
  const wrapper =
    document.createElement(
      'div'
    );


  wrapper.className =
    'table-workstation-preview';


  const clone =
    report.table.cloneNode(
      true
    ) as HTMLElement;


  sanitizePreviewClone(
    clone
  );


  clone.classList.add(
    'table-workstation-preview-table'
  );


  clone.removeAttribute(
    'id'
  );


  Array.from(
    clone.querySelectorAll(
      '[id]'
    )
  ).forEach(
    (
      element
    ) => {
      element.removeAttribute(
        'id'
      );
    }
  );


  wrapper.appendChild(
    clone
  );


  return wrapper;
}


/* =========================================================
   DOCUMENT REPORT HTML
   ========================================================= */


function createDocumentSummaryHtml(
  reports:
    TableReport[]
): string {
  const summary =
    getDocumentSummary(
      reports
    );


  return `
    <div class="table-workstation-document">

      <h2>
        Document Table Report
      </h2>

      <p>
        This is an automated structural
        review. Passing these checks does
        not by itself confirm that a table
        is fully accessible.
      </p>

      <div class="table-workstation-metrics">

        <div class="table-workstation-metric">
          <span>Tables</span>
          <strong>${summary.tables}</strong>
        </div>

        <div class="table-workstation-metric">
          <span>Automated checks passed</span>
          <strong>${summary.passed}</strong>
        </div>

        <div class="table-workstation-metric">
          <span>Need review</span>
          <strong>${summary.review}</strong>
        </div>

        <div class="table-workstation-metric">
          <span>Errors</span>
          <strong>${summary.errors}</strong>
        </div>

        <div class="table-workstation-metric">
          <span>Simple</span>
          <strong>${summary.simple}</strong>
        </div>

        <div class="table-workstation-metric">
          <span>Grouped</span>
          <strong>${summary.grouped}</strong>
        </div>

        <div class="table-workstation-metric">
          <span>Complex</span>
          <strong>${summary.complex}</strong>
        </div>

        <div class="table-workstation-metric">
          <span>Total findings</span>
          <strong>${summary.totalIssues}</strong>
        </div>

      </div>

      <div class="table-workstation-report-list">

        ${reports
          .map(
            (
              report
            ) => {
              const status =
                getTableStatus(
                  report
                );


              return `
                <button
                  type="button"
                  class="table-workstation-report-card"
                  data-report-table-index="${report.index}"
                >

                  <span
                    class="table-workstation-status table-workstation-status--${status}"
                  >
                    ${getStatusIcon(
                      status
                    )}
                  </span>

                  <span class="table-workstation-report-card-main">

                    <strong>
                      Table ${report.index + 1}
                      —
                      ${escapeHtml(
                        report.label
                      )}
                    </strong>

                    <span>
                      ${escapeHtml(
                        report.complexity
                      )}
                      ·
                      ${report.rows} row(s)
                      ·
                      ${report.columns} column(s)
                      ·
                      ${report.issues.length} finding(s)
                    </span>

                  </span>

                </button>
              `;
            }
          )
          .join(
            ''
          )}

      </div>

    </div>
  `;
}


/* =========================================================
   TABLE DETAIL HTML
   ========================================================= */


function createTableDetailHtml(
  report:
    TableReport
): string {
  const status =
    getTableStatus(
      report
    );


  const issueHtml =
    report.issues.length >
    0
      ? report.issues
          .map(
            (
              issue,
              index
            ) => `
              <button
                type="button"
                class="table-workstation-issue table-workstation-issue--${issue.severity}"
                data-issue-index="${index}"
              >

                <span class="table-workstation-issue-symbol">
                  ${
                    issue.severity ===
                    'error'
                      ? '✕'
                      : '⚠'
                  }
                </span>

                <span>

                  <strong>
                    ${escapeHtml(
                      issue.title
                    )}
                  </strong>

                  <span>
                    ${escapeHtml(
                      issue.detail
                    )}
                  </span>

                </span>

              </button>
            `
          )
          .join(
            ''
          )
      : `
        <div class="table-workstation-pass-message">
          ✓ No issues were detected by
          the current automated checks.
        </div>
      `;


  return `
    <div class="table-workstation-table-detail">

      <div class="table-workstation-detail-heading">

        <div>

          <div class="table-workstation-eyebrow">
            Table ${report.index + 1}
          </div>

          <h2>
            ${escapeHtml(
              report.label
            )}
          </h2>

        </div>

        <span
          class="table-workstation-badge table-workstation-badge--${status}"
        >
          ${getStatusIcon(
            status
          )}

          ${
            status ===
            'pass'
              ? 'Automated checks passed'
              : status ===
                'error'
                ? 'Errors detected'
                : 'Review recommended'
          }
        </span>

      </div>


      <div class="table-workstation-actions">

        <button
          type="button"
          data-action="previous-table"
        >
          ← Previous
        </button>

        <button
          type="button"
          data-action="next-table"
        >
          Next →
        </button>

        <button
          type="button"
          data-action="go-to-table"
        >
          Go to table
        </button>

        <button
          type="button"
          class="table-workstation-primary"
          data-action="detailed-review"
        >
          Select for detailed review
        </button>

      </div>


      <h3>
        Structure
      </h3>

      <div class="table-workstation-metrics">

        <div class="table-workstation-metric">
          <span>Rows</span>
          <strong>${report.rows}</strong>
        </div>

        <div class="table-workstation-metric">
          <span>Columns</span>
          <strong>${report.columns}</strong>
        </div>

        <div class="table-workstation-metric">
          <span>Complexity</span>
          <strong>${escapeHtml(
            report.complexity
          )}</strong>
        </div>

        <div class="table-workstation-metric">
          <span>Caption</span>
          <strong>
            ${
              report.hasCaption
                ? '✓'
                : '⚠'
            }
          </strong>
        </div>

        <div class="table-workstation-metric">
          <span>THEAD</span>
          <strong>
            ${
              report.hasThead
                ? '✓'
                : '—'
            }
          </strong>
        </div>

        <div class="table-workstation-metric">
          <span>TBODY</span>
          <strong>
            ${
              report.hasTbody
                ? report.tbodyCount
                : '—'
            }
          </strong>
        </div>

        <div class="table-workstation-metric">
          <span>Header rows</span>
          <strong>${report.headerRows}</strong>
        </div>

        <div class="table-workstation-metric">
          <span>Suggested header rows</span>
          <strong>${report.suggestedHeaderRows}</strong>
        </div>

      </div>


      <h3>
        Accessibility relationships
      </h3>

      <div class="table-workstation-metrics">

        <div class="table-workstation-metric">
          <span>TH cells</span>
          <strong>${report.headerCells}</strong>
        </div>

        <div class="table-workstation-metric">
          <span>TD cells</span>
          <strong>${report.dataCells}</strong>
        </div>

        <div class="table-workstation-metric">
          <span>Row headers</span>
          <strong>${report.rowHeaderCells}</strong>
        </div>

        <div class="table-workstation-metric">
          <span>TH without scope</span>
          <strong>${report.headerCellsWithoutScope}</strong>
        </div>

        <div class="table-workstation-metric">
          <span>Merged header cells</span>
          <strong>${report.mergedHeaderCells}</strong>
        </div>

        <div class="table-workstation-metric">
          <span>Merged data cells</span>
          <strong>${report.mergedDataCells}</strong>
        </div>

        <div class="table-workstation-metric">
          <span>TD with headers</span>
          <strong>${report.dataCellsWithHeadersAttribute}</strong>
        </div>

        <div class="table-workstation-metric">
          <span>Cells needing review</span>
          <strong>${report.dataCellsNeedingReview}</strong>
        </div>

      </div>


      <h3>
        Findings
      </h3>

      <div class="table-workstation-issues">
        ${issueHtml}
      </div>


      <h3>
        Table preview
      </h3>

      <div data-preview-container></div>

    </div>
  `;
}


/* =========================================================
   NAVIGATION HTML
   ========================================================= */


function createNavigationHtml(
  reports:
    TableReport[],
  selectedIndex:
    number | null,
  view:
    WorkstationView
): string {
  return `
    <button
      type="button"
      class="table-workstation-nav-item ${
        view ===
        'document'
          ? 'is-selected'
          : ''
      }"
      data-view="document"
    >

      <span class="table-workstation-nav-icon">
        ▦
      </span>

      <span>

        <strong>
          Document report
        </strong>

        <small>
          ${reports.length} table(s)
        </small>

      </span>

    </button>


    ${reports
      .map(
        (
          report
        ) => {
          const status =
            getTableStatus(
              report
            );


          return `
            <button
              type="button"
              class="table-workstation-nav-item ${
                view ===
                  'table' &&
                selectedIndex ===
                  report.index
                  ? 'is-selected'
                  : ''
              }"
              data-table-index="${report.index}"
            >

              <span
                class="table-workstation-status table-workstation-status--${status}"
              >
                ${getStatusIcon(
                  status
                )}
              </span>

              <span>

                <strong>
                  Table ${report.index + 1}
                </strong>

                <small>
                  ${escapeHtml(
                    report.label
                  )}
                </small>

              </span>

            </button>
          `;
        }
      )
      .join(
        ''
      )}
  `;
}


/* =========================================================
   WORKSTATION
   ========================================================= */


function openTableWorkstation(
  editor:
    Editor,
  options?: {
    initialView?:
      WorkstationView;

    initialTable?:
      HTMLTableElement | null;
  }
): void {
  const reports =
    analyzeDocumentTables(
      editor
    );


  if (
    reports.length ===
    0
  ) {
    editor.notificationManager.open({
      text:
        'No tables were found in the document.',

      type:
        'info',

      timeout:
        4000,
    });


    return;
  }


  if (
    activeTableWorkstationClose
  ) {
    activeTableWorkstationClose();
  }


  let selectedIndex:
    number | null =
    null;


  if (
    options?.initialTable
  ) {
    const match =
      reports.find(
        (
          report
        ) =>
          report.table ===
          options.initialTable
      );


    selectedIndex =
      match?.index ??
      null;
  }


  let view:
    WorkstationView =
    options?.initialView ??
    (
      selectedIndex !==
      null
        ? 'table'
        : 'document'
    );


  if (
    view ===
      'table' &&
    selectedIndex ===
      null
  ) {
    selectedIndex =
      0;
  }


  const previousOverflow =
    document.body
      .style
      .overflow;


  document.body
    .style
    .overflow =
    'hidden';


  const backdrop =
    document.createElement(
      'div'
    );


  backdrop.className =
    'table-workstation-backdrop';


  backdrop.innerHTML = `
    <div
      class="table-workstation-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="table-workstation-title"
    >

      <header class="table-workstation-header">

        <div>

          <h1 id="table-workstation-title">
            Table Workstation
          </h1>

          <p>
            Review every table in the
            current document.
          </p>

        </div>

        <button
          type="button"
          class="table-workstation-close"
          data-action="close"
          aria-label="Close Table Workstation"
        >
          ×
        </button>

      </header>


      <div class="table-workstation-body">

        <aside class="table-workstation-sidebar">

          <div class="table-workstation-sidebar-heading">
            Tables
          </div>

          <div data-navigation></div>

        </aside>


        <main
          class="table-workstation-content"
          data-content
        ></main>

      </div>

    </div>
  `;


  const navigation =
    backdrop.querySelector<
      HTMLElement
    >(
      '[data-navigation]'
    );


  const content =
    backdrop.querySelector<
      HTMLElement
    >(
      '[data-content]'
    );


  if (
    !navigation ||
    !content
  ) {
    document.body
      .style
      .overflow =
      previousOverflow;


    return;
  }


  /* -------------------------------------------------------
     CLOSE
     ------------------------------------------------------- */


  const close =
    (): void => {
      backdrop.remove();


      document.removeEventListener(
        'keydown',
        onKeyDown
      );


      document.body
        .style
        .overflow =
        previousOverflow;


      activeTableWorkstationClose =
        null;
    };


  /* -------------------------------------------------------
     GO TO TABLE
     ------------------------------------------------------- */


  const goToTable =
    (
      report:
        TableReport
    ): void => {
      close();


      selectElementInEditor(
        editor,
        report.table
      );
    };


  /* -------------------------------------------------------
     ISSUE
     ------------------------------------------------------- */


  const goToIssue =
    (
      report:
        TableReport,
      issueIndex:
        number
    ): void => {
      const issue =
        report.issues[
          issueIndex
        ];


      if (
        !issue
      ) {
        return;
      }


      const target =
        issue.target ??
        report.table;


      close();


      selectElementInEditor(
        editor,
        target
      );


      editor.notificationManager.open({
        text:
          issue.title,

        type:
          issue.severity ===
          'error'
            ? 'error'
            : 'warning',

        timeout:
          4500,
      });
    };


  /* -------------------------------------------------------
     DETAILED REVIEW
     ------------------------------------------------------- */


  const selectForDetailedReview =
    (
      report:
        TableReport
    ): void => {
      close();


      selectElementInEditor(
        editor,
        report.table
      );


      editor.notificationManager.open({
        text:
          `Table ${report.index + 1} selected. Click Table Accessibility to open its detailed accessibility reviewer.`,

        type:
          'info',

        timeout:
          6000,
      });
    };


  /* -------------------------------------------------------
     RENDER
     ------------------------------------------------------- */


  const render =
    (): void => {
      navigation.innerHTML =
        createNavigationHtml(
          reports,
          selectedIndex,
          view
        );


      if (
        view ===
        'document'
      ) {
        content.innerHTML =
          createDocumentSummaryHtml(
            reports
          );


        return;
      }


      const report =
        reports[
          selectedIndex ??
          0
        ];


      if (
        !report
      ) {
        view =
          'document';


        selectedIndex =
          null;


        render();

        return;
      }


      content.innerHTML =
        createTableDetailHtml(
          report
        );


      const previewContainer =
        content.querySelector<
          HTMLElement
        >(
          '[data-preview-container]'
        );


      if (
        previewContainer
      ) {
        previewContainer.appendChild(
          createPreviewTable(
            report
          )
        );
      }
    };


  /* -------------------------------------------------------
     DELEGATED CLICK HANDLER
     ------------------------------------------------------- */


  backdrop.addEventListener(
    'click',
    (
      event
    ) => {
      /*
       * event.target is EventTarget | null.
       *
       * EventTarget does not expose
       * Element methods such as closest().
       *
       * Because the workstation itself
       * lives in the main document, this
       * instanceof Element check is safe.
       */
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
          'button'
        );


      if (
        !button ||
        !backdrop.contains(
          button
        )
      ) {
        return;
      }


      /* ---------------------------------------------------
         ACTIONS
         --------------------------------------------------- */


      const action =
        button.dataset
          .action
          ?.trim();


      if (
        action
      ) {
        switch (
          action
        ) {
          case 'close':
            close();

            return;


          case 'previous-table': {
            const current =
              selectedIndex ??
              0;


            selectedIndex =
              (
                current -
                1 +
                reports.length
              ) %
              reports.length;


            view =
              'table';


            render();

            return;
          }


          case 'next-table': {
            const current =
              selectedIndex ??
              0;


            selectedIndex =
              (
                current +
                1
              ) %
              reports.length;


            view =
              'table';


            render();

            return;
          }


          case 'go-to-table': {
            const report =
              reports[
                selectedIndex ??
                0
              ];


            if (
              report
            ) {
              goToTable(
                report
              );
            }


            return;
          }


          case 'detailed-review': {
            const report =
              reports[
                selectedIndex ??
                0
              ];


            if (
              report
            ) {
              selectForDetailedReview(
                report
              );
            }


            return;
          }
        }
      }


      /* ---------------------------------------------------
         DOCUMENT REPORT
         --------------------------------------------------- */


      const viewName =
        button.dataset
          .view
          ?.trim();


      if (
        viewName ===
        'document'
      ) {
        view =
          'document';


        selectedIndex =
          null;


        render();

        return;
      }


      /* ---------------------------------------------------
         SIDEBAR TABLE
         --------------------------------------------------- */


      const tableIndexText =
        button.dataset
          .tableIndex;


      if (
        tableIndexText !==
        undefined
      ) {
        const tableIndex =
          Number(
            tableIndexText
          );


        if (
          Number.isInteger(
            tableIndex
          ) &&
          tableIndex >=
            0 &&
          tableIndex <
            reports.length
        ) {
          selectedIndex =
            tableIndex;


          view =
            'table';


          render();
        }


        return;
      }


      /* ---------------------------------------------------
         DOCUMENT REPORT TABLE CARD
         --------------------------------------------------- */


      const reportTableIndexText =
        button.dataset
          .reportTableIndex;


      if (
        reportTableIndexText !==
        undefined
      ) {
        const tableIndex =
          Number(
            reportTableIndexText
          );


        if (
          Number.isInteger(
            tableIndex
          ) &&
          tableIndex >=
            0 &&
          tableIndex <
            reports.length
        ) {
          selectedIndex =
            tableIndex;


          view =
            'table';


          render();
        }


        return;
      }


      /* ---------------------------------------------------
         ISSUE
         --------------------------------------------------- */


      const issueIndexText =
        button.dataset
          .issueIndex;


      if (
        issueIndexText !==
        undefined
      ) {
        const issueIndex =
          Number(
            issueIndexText
          );


        const report =
          reports[
            selectedIndex ??
              0
          ];


        if (
          report &&
          Number.isInteger(
            issueIndex
          )
        ) {
          goToIssue(
            report,
            issueIndex
          );
        }
      }
    }
  );


  /* -------------------------------------------------------
     BACKDROP CLICK
     ------------------------------------------------------- */


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


  /* -------------------------------------------------------
     ESCAPE KEY
     ------------------------------------------------------- */


  function onKeyDown(
    event:
      KeyboardEvent
  ): void {
    if (
      event.key ===
      'Escape'
    ) {
      event.preventDefault();


      close();
    }
  }


  document.addEventListener(
    'keydown',
    onKeyDown
  );


  /* -------------------------------------------------------
     OPEN
     ------------------------------------------------------- */


  document.body.appendChild(
    backdrop
  );


  activeTableWorkstationClose =
    close;


  render();
}


/* =========================================================
   CURRENT TABLE ANALYSIS
   ========================================================= */


function openCurrentTableAnalysis(
  editor:
    Editor
): void {
  const table =
    getCurrentTable(
      editor
    );


  if (
    !table
  ) {
    editor.notificationManager.open({
      text:
        'Place the cursor inside a table first.',

      type:
        'info',

      timeout:
        4000,
    });


    return;
  }


  openTableWorkstation(
    editor,
    {
      initialView:
        'table',

      initialTable:
        table,
    }
  );
}


/* =========================================================
   PUBLIC REGISTRATION
   ========================================================= */


export function registerTableWorkstationMenu(
  editor:
    Editor
): void {
  editor.ui.registry.addMenuButton(
    'tableworkstation',
    {
      text:
        'Tables',

      tooltip:
        'Open the table accessibility workstation',

      fetch:
        (
          callback
        ) => {
          callback([
            {
              type:
                'menuitem',

              text:
                'Open Table Workstation...',

              onAction:
                () => {
                  const currentTable =
                    getCurrentTable(
                      editor
                    );


                  openTableWorkstation(
                    editor,
                    {
                      initialView:
                        currentTable
                          ? 'table'
                          : 'document',

                      initialTable:
                        currentTable,
                    }
                  );
                },
            },

            {
              type:
                'menuitem',

              text:
                'Analyze Current Table...',

              onAction:
                () => {
                  openCurrentTableAnalysis(
                    editor
                  );
                },
            },

            {
              type:
                'menuitem',

              text:
                'Document Table Report...',

              onAction:
                () => {
                  openTableWorkstation(
                    editor,
                    {
                      initialView:
                        'document',
                    }
                  );
                },
            },
          ]);
        },
    }
  );
}