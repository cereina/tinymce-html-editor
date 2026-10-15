# GC Design System prototype

Branch: `codex/gcds-download-prototype`. This is a local prototype for the Download popup, using official `@gcds-core/components` 1.6.0 components. It has not been merged into main or published to GitHub.

## Try it

Run `npm install` and `npm run dev`, then open the local URL printed by Vite. Expand **Document tools** and choose **Download**. Enter document details to see the preview, then insert the download link or cancel.

## Scope

The popup uses GC inputs, selects, buttons, explanatory text, and validation alerts. A native HTML dialog provides the modal container, with an H2 title and H3 sections. Small layout rules arrange the form and preview. The existing HTML generation and undo transaction are retained.

GC's global stylesheet supplies official design tokens and fonts. Its font stylesheet requests Google Fonts, as distributed by the package. Production deployment should review font hosting requirements. Other editor windows still use their existing components.

Keyboard behavior includes initial heading focus, Tab and Shift+Tab containment across component shadow roots, Escape, focus return, and Enter submission from text inputs. The form scrolls independently, allowing access at narrow widths and short viewport heights. Required fields have visible labels and inline errors.

## Verification

Run `npm run build` and `npx playwright test`. Tests include automated axe checks for WCAG 2.2 AA rules, heading structure, desktop/mobile layout, validation, insertion, undo, cancellation, keyboard navigation, and preview updates. Automated checks do not establish complete WCAG conformance; manual screen-reader testing remains necessary before production adoption.

Official component documentation: https://design-system.canada.ca/en/components/
