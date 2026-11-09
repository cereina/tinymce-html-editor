# Tables with group headers

In **Table Accessibility**, choose the top rows that provide column headings. The first row must contain more than one cell, and some of those cells can span multiple columns. Under **Group headers in the table body**, select each full-width merged row that labels the data below it. For example, select rows 4, 7, and 10 when row 1 contains the column headings. Optionally use the first column as row headers.

Continue to the relationship reviewer. Select a data cell in the preview to see and adjust its associations. Each cell is linked to the top headers that cover its columns, the closest selected group above it, and any applicable left row header. Data above the first group has no group association. The editor preserves the existing cell merges and uses explicit `id` and `headers` links. It does not split the table into separate row groups to represent the selected headers.

Choose **Apply relationships** to save, or close the preview to leave the table unchanged. Reopen Table Accessibility to adjust saved group choices. **Remove header markup** clears those choices as well as the generated relationships. Use Undo to restore the prior table.

A vertical merge crossing a selected header boundary or using `rowspan="0"` needs manual review. The group-row mode will flag it rather than guess at the associations.
