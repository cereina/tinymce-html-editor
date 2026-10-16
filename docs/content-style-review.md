# Content style review

Open **Document QA**, then find **Content style review**. Choose the content's default language: English or French. Explicit `lang` attributes take precedence, including regional variants such as `fr-CA`. Other explicitly declared languages are skipped.

The first release offers author-reviewed suggestions for percentages, dollar-symbol position, selected written dates, and non-breaking spaces between numbers and selected words or units. Ambiguous numeric dates and selected small numbers in narrative prose are review-only. It does not determine whether a date is valid or whether a currency, quantity, or translation is correct.

**Apply suggestion** changes only the selected occurrence, in one editor Undo transaction. Close QA and use the editor's Undo command to reverse it. **Ignore** hides that occurrence for the current dialog session; changing its text makes it eligible for review again. **Go to content issue** closes QA and selects the original text. Re-run checks after other edits.

Suggestions are separate from accessibility findings and require editorial judgment. They are not a complete style-guide audit. Checks operate within individual text nodes; phrases split across inline elements may be missed. Code, preformatted text, links, hidden content, non-editable content, and HTML attributes are excluded. No automatic document-wide cleanup is performed.

Sources: [Canada.ca Content Style Guide](https://design.canada.ca/style-guide/) and [Guide de rédaction du contenu du site Canada.ca](https://conception.canada.ca/guide-redaction/), particularly the numbers and dates guidance. Review these sources when extending rules. Automated accessibility checks do not establish full WCAG conformance; manual keyboard and screen-reader review remains necessary.
