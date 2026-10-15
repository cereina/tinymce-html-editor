# Dependency audit — October 14, 2026

The audit initially reported one high and three moderate entries.

## Fixed

The development dependency path `vite → postcss → source-map-js` now resolves to source-map-js 1.2.2 rather than 1.2.1. This fixes the indexed-source-map denial-of-service advisory [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).

Only this compatible patch version changed in the lockfile. Application dependencies and import behavior were retained.

## Remaining upstream warning

npm still reports three moderate entries for one dependency chain:

```
mammoth@1.12.3 → argparse@1.0.10 → sprintf-js@1.0.3
```

The underlying issue is [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), involving attacker-controlled format precision. The advisory currently lists no patched sprintf-js release. Mammoth's latest available release, 1.13.0, still declares the same argparse dependency, so upgrading Mammoth alone does not remove the warning.

In the installed Mammoth source, argparse is required by `node_modules/mammoth/bin/mammoth`, its Node command-line program. This application uses Mammoth's browser conversion API. Neither argparse nor sprintf-js appears in the generated browser bundle license report. This supports treating that chain as outside the current browser import path, rather than claiming the upstream packages themselves are fixed.

Do not use `npm audit fix --force` to clear the warning: npm proposes downgrading Mammoth to 0.3.29, which would replace the current importer with a much older incompatible release.

The residual warnings remain visible; no audit exclusions or forced dependency overrides were introduced.

## Verification

- npm audit: zero high or critical entries; three moderate entries remain as described above.
- Production build passes.
- All four application and Word-import regression tests passed for this update.
- All changes are local to `codex/accessibility-wcag22`; main and GitHub are unchanged.
