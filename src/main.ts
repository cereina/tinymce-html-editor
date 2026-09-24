import './style.css';

import {
  initTinyMCE,
} from './editor/tinymce';


document.querySelector<HTMLDivElement>(
  '#app'
)!.innerHTML = `
  <main class="container">

    <h1>
      HTML Editor
    </h1>

    <textarea id="editor">
      <h2>Start editing</h2>

      <p>
        Your HTML content goes here.
      </p>
    </textarea>

  </main>
`;


void initTinyMCE();