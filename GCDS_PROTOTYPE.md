# GC Design System prototype

Branch: `codex/gcds-download-prototype`. This is a local prototype for the Download, Clean HTML, and Document QA popups, using official `@gcds-core/components` 1.6.0 components. It has not been merged into main or published to GitHub.

## Try it

Run `npm install` and `npm run dev`, then open the local URL printed by Vite. Expand **Document tools** and choose **Download**. Enter document details to see the preview, then insert the download link or cancel.

Choose **Document → Clean HTML** to review cleanup findings. GC alerts show whether changes are proposed and whether references need review. Findings use definition lists under H3 section headings, below an H2 dialog title. **Apply cleanup** changes the document in one undo transaction; Cancel, Close, and Escape preserve it. Apply is disabled when no changes are required. The report scrolls independently of the action buttons.

Choose **Document → Document QA** to inspect the existing QA checks in a GC report. A GC summary alert communicates the result. Counts and document metrics use definition lists, categories use H3 headings, and individual issues use H4 headings with explicit severity labels. GC **Go to issue** buttons close the report and select the associated document element. **Re-run checks** refreshes the report in place, retains button focus, and announces the updated counts. The QA popup does not edit the document.

## Scope

The popup uses GC inputs, selects, buttons, explanatory text, and validation alerts. A native HTML dialog provides the modal container, with an H2 title and H3 sections. Small layout rules arrange the form and preview. The existing HTML generation and undo transaction are retained.

GC's global stylesheet supplies official design tokens and fonts. Its font stylesheet requests Google Fonts, as distributed by the package. Production deployment should review font hosting requirements. Other editor windows still use their existing components.

Keyboard behavior includes initial heading focus, Tab and Shift+Tab containment across component shadow roots, Escape, focus return, and Enter submission from text inputs. The form scrolls independently, allowing access at narrow widths and short viewport heights. Required fields have visible labels and inline errors.

## Verification

Run `npm run build` and `npx playwright test`. Tests include automated axe checks for WCAG 2.2 AA rules, heading structure, desktop/mobile layout, validation, insertion, undo, cancellation, keyboard navigation, and preview updates. Automated checks do not establish complete WCAG conformance; manual screen-reader testing remains necessary before production adoption.

Official component documentation: https://design-system.canada.ca/en/components/
