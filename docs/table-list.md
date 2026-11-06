# List of tables

Choose **Document → List of tables**. Every table, including nested tables, must have a non-empty direct `<caption>`. If captions are missing, the window identifies the tables by document order and offers **Go to first missing caption**. Use Table Accessibility to add captions, then reopen the tool. An empty document shows a no-tables message. Nothing is generated in either case.

Enter a section heading and choose H2–H6 (H2 by default). Choose a standard heading and list, or an expand/collapse section with the heading in `<summary>` and the list inside `<details>`. Match the heading level to the surrounding document structure.

Recommended placement is immediately after the generated TOC and before the generated List of figures. With only a figures list, the table list goes immediately before it. With neither, it goes at document start, after a leading H1 title. Alternatively choose document start, document end, or after the top-level content block containing the cursor when the popup was opened. The window describes these locations. If existing navigation lists are in the opposite order, fix their order or select another location; the tool does not silently move those lists.

Each entry uses its table caption as the link text and points to the table's ID. Existing unique IDs are retained; missing or duplicate IDs receive the next available `table-N` ID, avoiding IDs anywhere in the document. These ID changes and list insertion share one Undo transaction. Classes and table headers are not changed by this tool.

An existing generated List of tables is updated rather than duplicated. It stays in its current position by default; select another location to relocate it. Captions are checked again on Apply. Cancel, Escape and validation errors do not change the document. Use Undo/Redo to restore an earlier list or its placement. Reopen the tool to refresh links after changing table captions or IDs.

Build / Rebuild Sections treats the generated list as a complete block and does not add section wrappers around it or inside it. The list uses `data-table-contents="true"` to retain this identity through editing and export. No external library or inline stylesheet is added.
