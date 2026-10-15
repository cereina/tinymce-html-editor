# Dependency audit — October 14, 2026

## Current result

npm audit reports **0 vulnerabilities** after the updates below. The vulnerable dependency was removed rather than hidden through audit exclusions.

## Source-map security patch

The development dependency path `vite → postcss → source-map-js` resolves to source-map-js 1.2.2 rather than 1.2.1. This fixes [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).

## Mammoth dependency-chain removal

The original dependency chain was:

```
mammoth@1.12.3 → argparse@1.0.10 → sprintf-js@1.0.3
```

A Mammoth-scoped npm override now selects argparse 2.0.1. This parser version has no sprintf-js dependency, removing sprintf-js and the three inherited moderate audit entries. Mammoth itself is retained at the existing installed version.

```json
"overrides": {
  "mammoth": {
    "argparse": "2.0.1"
  }
}
```

Mammoth's older parser API calls are supported through argparse 2's compatibility aliases. Both CLI help and actual DOCX conversion were checked. The CLI emits deprecation notices for those aliases; the browser importer does not invoke this CLI.

The override is intentionally limited to Mammoth. Review it when upgrading Mammoth, especially if its upstream parser dependency changes. Do not replace it with an untested major-version override or downgrade Mammoth to the version proposed by `npm audit fix --force`.

The underlying sprintf-js advisory remains unpatched upstream, but sprintf-js is no longer installed in this project's dependency tree: [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c).

## Tested results

The production build passed. All five focused regression tests passed: main app accessibility, imported-footnote review, Word import success/undo, malformed-file handling, and Mammoth CLI conversion. The final npm audit reported zero vulnerabilities.

## Repeat verification

```powershell
npm install
npm audit
npm run build
npm run test:a11y
```

All changes are local to `codex/accessibility-wcag22`; main and GitHub are unchanged.
