# Accessibility verification

This document records verification of the GC Design System integration developed on `codex/gcds-download-prototype`, along with the earlier accessibility fixes.

## What changed

- Custom windows use native modal dialogs. Background interaction is blocked, focus enters the window, Tab and Shift+Tab stay inside, and Escape closes it.
- The rich-text iframe and both source editors have accessible names.
- Text toolbar controls retain their visible text in their accessible names.
- Source line numbers and source text have higher contrast. Form-field borders and keyboard focus indicators have sufficient visible contrast.
- Complex-table data cells have real buttons for keyboard selection, expose their selected state, and retain table structure. These buttons exist only in the review preview; saved document cells keep their original HTML.
- The complex-table description has an associated label. Relationship validation and selected-cell information use status semantics.
- Document QA and source scroll areas are keyboard focusable.
- Custom windows can scroll vertically on short viewports instead of hiding their editor or footer. The 320 by 225 CSS pixel viewport represents the available space at 400 percent zoom on a 1280 by 900 viewport.
- Source-window backdrop cancellation waits for pointer release and can be aborted by moving back inside the window.
- The page has a descriptive title. The vendor promotion that exposed an aria-hidden focusable link was disabled.

These address the findings associated with WCAG 2.2 criteria 1.3.1, 1.4.3, 1.4.10, 1.4.11, 2.1.1, 2.4.3, 2.4.7, 2.5.2, 2.5.3, 4.1.2, and 4.1.3. Reference: [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

## Report structure and headings

Application report tables have been replaced with definition lists. Document tables and the table previews used for editing are preserved. Popup titles start at H2, sections use H3, and nested workstation sections use H4. Browser regressions check nonempty heading text, heading order, H2 popup titles, and the absence of report tables at desktop and narrow widths.

## Verification

GC prototype verification on October 15, 2026: the complete 76-test regression run passed. Eight additional checks cover complex-table header assignments, source action wrapping, and all six shared forms at a 320 by 225 CSS pixel viewport. After correcting the source toolbar wrapping and narrow-form overflow, all 18 relevant follow-up checks passed, including repeated desktop/mobile accessibility scans. The suite now contains 84 tests. Complex-table header choices were verified across cell navigation, application, and undo. GC checkbox interaction was tested using Space and visible-label pointer activation. Settings persistence, validation feedback inside the modal, and imported-footnote cancellation were also checked. Desktop and mobile screenshots were visually reviewed.

Earlier baseline verification:

The production build passes. The complete 48-test suite passed for the report and heading fixes, using Chrome and axe-core 4.14.0. After restoring syntax colors, all 12 source-focused checks passed, including a new regression that verifies distinct token colors and contrast. The suite now contains 49 tests. Scans use the WCAG 2.0, 2.1, and 2.2 A/AA tags and test both desktop and 320 CSS pixel widths. All scanned states in that suite have zero detected violations.

Coverage includes:

- Main editor and all four expanded custom toolbar groups.
- Source Code Pro, Document QA, download link and validation, cleanup, sections and TOC creation/removal, footnote manager and imported-footnote conversion, WET style manager, table workstation report/detail, table accessibility, complex-table relationship review, and left row headers.
- Built-in link, source-code, find/replace, table, cell, and row property dialogs.
- Repeated forward/reverse Tab traversal, modal entry, Escape, focus return, keyboard scrolling, table-cell selection, visible focus, and pointer cancellation.
- Saving source edits, cancellation, formatting, and undo; download insertion and undo; table-caption changes and undo; sections/TOC generation and removal; imported-footnote conversion.
- Word-file import success with undo, malformed-file error feedback without document loss, text-spacing overrides, doubled text size, and source editing/applying changes in a short 320-pixel-wide viewport.

Four additional passing regression tests cover built-in source save/undo, source formatting with the keyboard apply shortcut, workstation navigation, and cell target sizes/focus indication.

## Repeat the checks

Install dependencies with `npm ci`. Google Chrome must be installed for the configured Playwright channel. Run:

```powershell
npm run build
npm run test:a11y
```

The browser-test configuration starts a local server on port 5180 if one is not already running. Playwright produces an HTML report when using the default reporter configuration. Failed runs retain screenshots and traces.

## Limits and remaining manual checks

This is verification of the listed application states, not a certification that every possible document and browser state conforms to WCAG. No NVDA, JAWS, or VoiceOver session was performed. A screen-reader user should check editing, toolbar navigation, modal announcements, validation messages, and the complex-table workflow.

Manual review remains for tooltip hover/dismissal behavior, all target-size spacing exceptions, focus obstruction in untested window sizes, native operating-system file pickers, and cross-browser/platform behavior. The 400 percent check simulates the CSS viewport available at that magnification rather than changing Chrome's browser zoom setting. Doubled text is a style-based resize test.

The application accepts arbitrary authored HTML. Document QA provides assistance, but this work does not establish the accessibility of every imported or exported document.
