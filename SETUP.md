# Local Setup Guide

This guide explains how to run the TinyMCE HTML Editor on a local machine after downloading or cloning the project.

## 1. Requirements

Install the following software first:

- **Node.js** (recommended: current LTS version)
- **npm** (included with Node.js)
- A modern browser such as Microsoft Edge, Chrome, or Firefox

Optional but recommended:

- **Visual Studio Code**
- **Git**

You can verify that Node.js and npm are installed by opening a terminal and running:

```bash
node --version
npm --version
```

If both commands return version numbers, continue to the next step.

## 2. Download the project

You can either:

- download the repository as a ZIP file from GitHub and extract it, or
- clone the repository with Git.

Example:

```bash
git clone https://github.com/cereina/tinymce-html-editor.git
```

Then open the project folder:

```bash
cd tinymce-html-editor
```

## 3. Install the project dependencies

From the project root folder, run:

```bash
npm install
```

This installs TinyMCE, CodeMirror, Mammoth.js, Prettier, Vite, TypeScript, and the other required npm dependencies.

The `node_modules` folder will be created automatically.

## 4. Start the tool locally

Run:

```bash
npm run dev
```

Vite will display a local address in the terminal, usually similar to:

```text
http://localhost:5173/
```

Open that address in your browser.

The tool is now running locally on your machine.

## 5. Stop the local server

Return to the terminal and press:

```text
Ctrl + C
```

This stops the development server.

## 6. Create a production build

To confirm that the project compiles correctly, run:

```bash
npm run build
```

A successful build creates a `dist` folder.

The build also generates:

```text
dist/licenses.md
```

This file contains license information for third-party software included in the production bundle.

## 7. Preview the production build

After running `npm run build`, you can preview the production version locally with:

```bash
npm run preview
```

Vite will display another local URL. Open it in your browser to test the production build.

## 8. Updating the project later

If the project was cloned with Git, get the latest changes with:

```bash
git pull origin main
```

Then update installed dependencies if needed:

```bash
npm install
```

Finally, start the tool again:

```bash
npm run dev
```

## Important notes

- The application currently runs entirely on the local machine.
- No database or external server is required for normal use.
- Do not commit or share passwords, API keys, access tokens, or private work content.
- The repository currently uses self-hosted TinyMCE in GPL mode.
- Third-party license information is available in `THIRD_PARTY_LICENSES.md`.

## Quick start

For someone who already has Node.js installed:

```bash
git clone https://github.com/cereina/tinymce-html-editor.git
cd tinymce-html-editor
npm install
npm run dev
```

Then open the local URL shown in the terminal.
