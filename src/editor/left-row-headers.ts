import type {
  Editor,
} from 'tinymce';


type HeaderUnit =
  | 'row'
  | 'rowgroup';


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


interface ApplyResult {
  table:
    HTMLTableElement;

  convertedHeaders:
    number;

  explicitRelationships:
    number;

  mergedGroupHeaders:
    number;
}


/* =========================================================
   BASIC UTILITIES
   ========================================================= */


function normalizeText(
  value:
    string
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


function getSelectedTable(
  editor:
    Editor
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


/* =========================================================
   LOGICAL GRID
   ========================================================= */


function buildTableGrid(
  table:
    HTMLTableElement
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


          const logical:
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
            logical
          );


          for (
            let r =
              logical.rowStart;
            r <=
              logical.rowEnd;
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
                logical.colStart;
              c <=
                logical.colEnd;
              c++
            ) {
              matrix[
                r
              ][
                c
              ] =
                logical;
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
   HEADER REGION DETECTION
   ========================================================= */


function detectTopHeaderRows(
  table:
    HTMLTableElement
): number {
  if (
    table.tHead &&
    table.tHead.rows.length >
      0
  ) {
    return table.tHead
      .rows.length;
  }


  let count =
    0;


  for (
    const row of
    Array.from(
      table.rows
    )
  ) {
    const cells =
      Array.from(
        row.cells
      );


    if (
      cells.length ===
      0 ||
      !cells.every(
        (
          cell
        ) =>
          cell.tagName ===
          'TH'
      )
    ) {
      break;
    }


    count++;
  }


  return count;
}


function detectExistingLeftHeaderColumns(
  table:
    HTMLTableElement,
  headerRows:
    number
): number {
  const grid =
    buildTableGrid(
      table
    );


  let maximum =
    0;


  for (
    let column =
      0;
    column <
      grid.columns;
    column++
  ) {
    const bodyCells =
      grid.cells.filter(
        (
          logical
        ) =>
          logical.rowStart >=
            headerRows &&
          logical.colStart ===
            column &&
          logical.cell.closest(
            'tfoot'
          ) ===
            null
      );


    if (
      bodyCells.length ===
      0
    ) {
      break;
    }


    const allHeaders =
      bodyCells.every(
        (
          logical
        ) =>
          logical.cell.tagName ===
          'TH'
      );


    if (
      !allHeaders
    ) {
      break;
    }


    maximum =
      column +
      1;
  }


  return maximum;
}


function hasPartialBoundaryCell(
  table:
    HTMLTableElement,
  headerRows:
    number,
  headerColumns:
    number
): boolean {
  const grid =
    buildTableGrid(
      table
    );


  return grid.cells.some(
    (
      logical
    ) =>
      logical.rowStart >=
        headerRows &&
      logical.cell.closest(
        'tfoot'
      ) ===
        null &&
      logical.colStart <
        headerColumns &&
      logical.colEnd >=
        headerColumns
  );
}


/* =========================================================
   CELL CONVERSION
   ========================================================= */


function replaceCellTag(
  cell:
    HTMLTableCellElement,
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
    (
      attribute
    ) => {
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


function getTrueRowGroupScope(
  table:
    HTMLTableElement,
  logical:
    LogicalCell
): HeaderUnit | null {
  if (
    logical.cell.rowSpan <=
    1
  ) {
    return 'row';
  }


  const row =
    logical.cell.parentElement as
      HTMLTableRowElement | null;


  const tbody =
    row?.parentElement;


  if (
    !row ||
    !tbody ||
    tbody.tagName !==
      'TBODY'
  ) {
    return null;
  }


  const allRows =
    Array.from(
      table.rows
    );


  const bodyRows =
    Array.from(
      (
        tbody as
          HTMLTableSectionElement
      ).rows
    );


  const firstBodyRow =
    bodyRows[
      0
    ];


  const lastBodyRow =
    bodyRows[
      bodyRows.length -
        1
    ];


  if (
    !firstBodyRow ||
    !lastBodyRow
  ) {
    return null;
  }


  const firstIndex =
    allRows.indexOf(
      firstBodyRow
    );


  const lastIndex =
    allRows.indexOf(
      lastBodyRow
    );


  if (
    logical.rowStart ===
      firstIndex &&
    logical.rowEnd ===
      lastIndex
  ) {
    return 'rowgroup';
  }


  /*
   * A rowspan that covers only part of one
   * TBODY is not a true HTML row group.
   *
   * We leave scope off that merged header and
   * use explicit id/headers relationships
   * instead. This avoids overstating its range.
   */
  return null;
}


/* =========================================================
   UNIQUE HEADER IDS
   ========================================================= */


function countDocumentIdOccurrences(
  editor:
    Editor,
  id:
    string
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
    (
      element
    ) =>
      element.id ===
      id
  ).length;
}


function getTableNumber(
  editor:
    Editor,
  table:
    HTMLTableElement
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


  return index >=
    0
      ? index +
        1
      : tables.length +
        1;
}


function createUniqueId(
  editor:
    Editor,
  preferred:
    string,
  reserved:
    Set<string>
): string {
  let candidate =
    preferred;


  let suffix =
    2;


  while (
    reserved.has(
      candidate
    ) ||
    countDocumentIdOccurrences(
      editor,
      candidate
    ) >
      0
  ) {
    candidate =
      preferred +
      '-' +
      suffix;

    suffix++;
  }


  reserved.add(
    candidate
  );


  return candidate;
}


function ensureRelevantHeaderIds(
  editor:
    Editor,
  table:
    HTMLTableElement,
  originalTable:
    HTMLTableElement,
  topHeaderRows:
    number,
  leftHeaderColumns:
    number
): void {
  const grid =
    buildTableGrid(
      table
    );


  const tableNumber =
    getTableNumber(
      editor,
      originalTable
    );


  const reserved =
    new Set<string>();


  grid.cells.forEach(
    (
      logical
    ) => {
      const cell =
        logical.cell;


      if (
        cell.tagName !==
        'TH'
      ) {
        return;
      }


      const relevant =
        logical.rowStart <
          topHeaderRows ||
        (
          logical.rowStart >=
            topHeaderRows &&
          logical.colStart <
            leftHeaderColumns
        );


      if (
        !relevant
      ) {
        return;
      }


      const existing =
        cell.id.trim();


      if (
        existing &&
        countDocumentIdOccurrences(
          editor,
          existing
        ) <=
          1 &&
        !reserved.has(
          existing
        )
      ) {
        reserved.add(
          existing
        );

        return;
      }


      const preferred =
        'tbl-' +
        tableNumber +
        '-r' +
        (
          logical.rowStart +
          1
        ) +
        '-c' +
        (
          logical.colStart +
          1
        );


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
   EXPLICIT HEADER RELATIONSHIPS
   ========================================================= */


function getValidExistingHeaderIds(
  table:
    HTMLTableElement,
  cell:
    HTMLTableCellElement
): string[] {
  const headerIds =
    new Set(
      Array.from(
        table.querySelectorAll<
          HTMLTableCellElement
        >(
          'th[id]'
        )
      ).map(
        (
          header
        ) =>
          header.id
      )
    );


  return (
    cell.getAttribute(
      'headers'
    ) ??
    ''
  )
    .split(
      /\s+/
    )
    .map(
      (
        id
      ) =>
        id.trim()
    )
    .filter(
      (
        id
      ) =>
        Boolean(
          id
        ) &&
        headerIds.has(
          id
        )
    );
}


function getHeadersForDataCell(
  table:
    HTMLTableElement,
  grid:
    TableGrid,
  data:
    LogicalCell,
  topHeaderRows:
    number,
  leftHeaderColumns:
    number
): string[] {
  const rowHeaders =
    grid.cells
      .filter(
        (
          header
        ) =>
          header.cell.tagName ===
            'TH' &&
          header.rowStart >=
            topHeaderRows &&
          header.colStart <
            leftHeaderColumns &&
          header.colEnd <
            data.colStart &&
          rangesOverlap(
            header.rowStart,
            header.rowEnd,
            data.rowStart,
            data.rowEnd
          )
      )
      .sort(
        (
          a,
          b
        ) =>
          a.colStart -
          b.colStart
      );


  const columnHeaders =
    grid.cells
      .filter(
        (
          header
        ) =>
          header.cell.tagName ===
            'TH' &&
          header.rowStart <
            topHeaderRows &&
          header.rowEnd <
            data.rowStart &&
          rangesOverlap(
            header.colStart,
            header.colEnd,
            data.colStart,
            data.colEnd
          )
      )
      .sort(
        (
          a,
          b
        ) => {
          if (
            a.rowStart !==
            b.rowStart
          ) {
            return a.rowStart -
              b.rowStart;
          }


          return a.colStart -
            b.colStart;
        }
      );


  const result:
    string[] = [];


  const add =
    (
      id:
        string | undefined
    ): void => {
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
    (
      header
    ) => {
      add(
        header.cell.id
      );
    }
  );


  columnHeaders.forEach(
    (
      header
    ) => {
      add(
        header.cell.id
      );
    }
  );


  getValidExistingHeaderIds(
    table,
    data.cell
  ).forEach(
    add
  );


  return result;
}


function applyExplicitRelationships(
  table:
    HTMLTableElement,
  topHeaderRows:
    number,
  leftHeaderColumns:
    number
): number {
  const grid =
    buildTableGrid(
      table
    );


  let applied =
    0;


  grid.cells.forEach(
    (
      logical
    ) => {
      const cell =
        logical.cell;


      if (
        cell.tagName !==
          'TD' ||
        logical.rowStart <
          topHeaderRows ||
        logical.colStart <
          leftHeaderColumns ||
        cell.closest(
          'tfoot'
        )
      ) {
        return;
      }


      const ids =
        getHeadersForDataCell(
          table,
          grid,
          logical,
          topHeaderRows,
          leftHeaderColumns
        );


      if (
        ids.length ===
        0
      ) {
        cell.removeAttribute(
          'headers'
        );

        return;
      }


      cell.setAttribute(
        'headers',
        ids.join(
          ' '
        )
      );


      applied++;
    }
  );


  return applied;
}


/* =========================================================
   APPLY LEFT ROW HEADERS
   ========================================================= */


function applyLeftRowHeaders(
  editor:
    Editor,
  originalTable:
    HTMLTableElement,
  leftHeaderColumns:
    number
): ApplyResult {
  const clone =
    originalTable.cloneNode(
      true
    ) as HTMLTableElement;


  const topHeaderRows =
    detectTopHeaderRows(
      clone
    );


  if (
    hasPartialBoundaryCell(
      clone,
      topHeaderRows,
      leftHeaderColumns
    )
  ) {
    throw new Error(
      'A merged cell crosses the selected left-header boundary. Split that cell or choose a different number of left header columns.'
    );
  }


  const originalGrid =
    buildTableGrid(
      clone
    );


  const targets =
    originalGrid.cells.filter(
      (
        logical
      ) =>
        logical.rowStart >=
          topHeaderRows &&
        logical.colStart <
          leftHeaderColumns &&
        logical.colEnd <
          leftHeaderColumns &&
        logical.cell.closest(
          'tfoot'
        ) ===
          null
    );


  let convertedHeaders =
    0;


  let mergedGroupHeaders =
    0;


  targets.forEach(
    (
      logical
    ) => {
      const wasHeader =
        logical.cell.tagName ===
        'TH';


      const header =
        replaceCellTag(
          logical.cell,
          'th'
        );


      if (
        !wasHeader
      ) {
        convertedHeaders++;
      }


      const refreshedGrid =
        buildTableGrid(
          clone
        );


      const refreshed =
        refreshedGrid.cells.find(
          (
            candidate
          ) =>
            candidate.cell ===
            header
        );


      if (
        !refreshed
      ) {
        return;
      }


      const scope =
        getTrueRowGroupScope(
          clone,
          refreshed
        );


      if (
        header.rowSpan >
        1
      ) {
        mergedGroupHeaders++;
      }


      if (
        scope
      ) {
        header.setAttribute(
          'scope',
          scope
        );
      } else {
        header.removeAttribute(
          'scope'
        );
      }
    }
  );


  ensureRelevantHeaderIds(
    editor,
    clone,
    originalTable,
    topHeaderRows,
    leftHeaderColumns
  );


  const explicitRelationships =
    applyExplicitRelationships(
      clone,
      topHeaderRows,
      leftHeaderColumns
    );


  return {
    table:
      clone,

    convertedHeaders,

    explicitRelationships,

    mergedGroupHeaders,
  };
}


/* =========================================================
   DIALOG
   ========================================================= */


function createColumnOptions(
  table:
    HTMLTableElement
): Array<{
  text:
    string;

  value:
    string;
}> {
  const columns =
    buildTableGrid(
      table
    ).columns;


  const maximum =
    Math.max(
      columns -
      1,
      0
    );


  const options:
    Array<{
      text:
        string;

      value:
        string;
    }> = [
      {
        text:
          'No left row-header columns',

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
          ? 'First column'
          : 'First ' +
            count +
            ' columns',

      value:
        String(
          count
        ),
    });
  }


  return options;
}


function openLeftRowHeadersDialog(
  editor:
    Editor,
  table:
    HTMLTableElement
): void {
  const grid =
    buildTableGrid(
      table
    );


  if (
    grid.columns <
    2
  ) {
    editor.notificationManager.open({
      text:
        'This table does not have enough columns to create a left row-header region.',

      type:
        'info',

      timeout:
        4000,
    });


    return;
  }


  const topHeaderRows =
    detectTopHeaderRows(
      table
    );


  const existingLeftHeaders =
    detectExistingLeftHeaderColumns(
      table,
      topHeaderRows
    );


  editor.windowManager.open({
    title:
      'Configure Left Row Headers',

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
            '<div>' +
              '<p><strong>Use this for tables with one or more header columns on the left.</strong></p>' +
              '<p>The selected columns are converted to <code>&lt;th&gt;</code> cells. ' +
              'For multi-level tables, the tool also creates explicit <code>id</code> and <code>headers</code> relationships so data cells can be associated with all applicable row and column headers.</p>' +
              '<p><strong>Detected structure:</strong> ' +
                grid.rows +
                ' row(s), ' +
                grid.columns +
                ' column(s), ' +
                topHeaderRows +
                ' top header row(s).</p>' +
              '<p>Merged left headers that span only part of a <code>&lt;tbody&gt;</code> are associated explicitly rather than being incorrectly marked <code>scope="rowgroup"</code>.</p>' +
            '</div>',
        },

        {
          type:
            'selectbox',

          name:
            'leftHeaderColumns',

          label:
            'Left columns used as row headers',

          items:
            createColumnOptions(
              table
            ),
        },
      ],
    },

    initialData: {
      leftHeaderColumns:
        String(
          existingLeftHeaders >
            0
            ? existingLeftHeaders
            : 1
        ),
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
          'Apply left headers',

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


        const rawCount =
          typeof data
            .leftHeaderColumns ===
            'string'
            ? Number(
                data.leftHeaderColumns
              )
            : 0;


        const leftHeaderColumns =
          Number.isFinite(
            rawCount
          )
            ? Math.max(
                0,
                Math.min(
                  rawCount,
                  grid.columns -
                    1
                )
              )
            : 0;


        if (
          leftHeaderColumns ===
          0
        ) {
          editor.notificationManager.open({
            text:
              'Choose at least one left row-header column.',

            type:
              'warning',

            timeout:
              3500,
          });


          return;
        }


        try {
          const result =
            applyLeftRowHeaders(
              editor,
              table,
              leftHeaderColumns
            );


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
            leftHeaderColumns +
            ' left row-header column(s) applied. ' +
            result.explicitRelationships +
            ' data cell relationship(s) generated.';


          if (
            result.mergedGroupHeaders >
            0
          ) {
            message +=
              ' ' +
              result.mergedGroupHeaders +
              ' merged row header(s) were handled with explicit associations where needed.';
          }


          editor.notificationManager.open({
            text:
              message,

            type:
              'success',

            timeout:
              6000,
          });
        } catch (
          error
        ) {
          editor.notificationManager.open({
            text:
              error instanceof
              Error
                ? error.message
                : 'Unable to apply left row headers.',

            type:
              'error',

            timeout:
              6500,
          });
        }
      },
  });
}


/* =========================================================
   TINYMCE BUTTON
   ========================================================= */


export function registerLeftRowHeadersButton(
  editor:
    Editor
): void {
  editor.ui.registry.addButton(
    'leftrowheaders',
    {
      text:
        'Left Headers',

      tooltip:
        'Configure one or more left row-header columns',

      onAction:
        () => {
          const table =
            getSelectedTable(
              editor
            );


          if (
            !table
          ) {
            editor.notificationManager.open({
              text:
                'Click inside a table first, then choose Left Headers.',

              type:
                'info',

              timeout:
                4000,
            });


            return;
          }


          openLeftRowHeadersDialog(
            editor,
            table
          );
        },
    }
  );
}
