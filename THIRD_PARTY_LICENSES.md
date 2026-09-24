# Third-Party Software Licenses

This project uses third-party open-source software. The entries below summarize the direct dependencies currently locked by `package-lock.json`.

## Runtime / bundled dependencies

| Package | Locked version | License |
| --- | ---: | --- |
| TinyMCE | 8.9.2 | GPL-2.0-or-later |
| codemirror | 6.0.2 | MIT |
| @codemirror/lang-html | 6.4.12 | MIT |
| @codemirror/state | 6.7.6 | MIT |
| @codemirror/theme-one-dark | 6.1.3 | MIT |
| @codemirror/view | 6.43.13 | MIT |
| Mammoth.js | 1.12.3 | BSD-2-Clause |
| Prettier | 3.9.9 | MIT |

## Development dependencies

| Package | Locked version | License |
| --- | ---: | --- |
| Vite | 8.3.0 | MIT |
| TypeScript | 6.0.3 | Apache-2.0 |

## TinyMCE licensing

This repository currently configures self-hosted TinyMCE with:

```ts
license_key: 'gpl'
```

That means TinyMCE is being used under the GNU General Public License, version 2 or later (GPL-2.0-or-later). A copy of that license is included at `LICENSES/GPL-2.0-or-later.txt`.

If this application is distributed while TinyMCE remains in GPL mode, the distribution must comply with the applicable GPL requirements. If a proprietary distribution is desired instead, the TinyMCE licensing model and application licensing should be reviewed before release.

## Bundled dependency license report

Vite is configured to generate `dist/licenses.md` during production builds. That generated file contains license information and license text for dependencies that are actually included in the bundled output, including transitive bundled dependencies.

Run:

```bash
npm run build
```

and keep `dist/licenses.md` with any distributed build.

## Project source code

This notice documents third-party licenses only. It does **not** declare a separate license for the original source code in this repository. The repository is currently private, so the project owner can decide the project's own license before any public or commercial distribution.
