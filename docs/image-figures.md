# Review images

Choose **Document → Review images**. The tool reviews editable `<img>` elements in document order, including images already in figures. It does not upload files: enter a relative source path or an image URL appropriate for the exported page.

Authored URLs are preserved rather than converted relative to the editor's local address. For example, `/en/img/photo.jpg` retains its leading slash through editing and export. A source pointing to an actual image file is needed to display it; `/en/img/` alone is normally a folder path.

The window prefills the source and alternative text. Enter a caption (default: “Add image caption”). Check **This image is decorative** only when it conveys no information or function; the result receives `alt=""`. Otherwise, enter alternative text describing the image's purpose. Captions and alternative text have different roles. An image-only link must retain an accessible name.

When a text paragraph immediately precedes the image paragraph or existing figure, the window also offers its text as an editable suggested caption. Select **Use the suggested caption and remove the original paragraph above the image** to accept it. This choice starts unchecked. Applying an accepted suggestion moves the text into the caption and removes the original paragraph in the same Undo transaction. Leaving it unchecked uses the ordinary Image caption field and keeps the paragraph. Skip, Close, validation errors and Escape never remove it. Headings, intervening content, and paragraphs containing other media or form controls are not caption candidates. Changed source paragraphs require a fresh review.

**Apply and next** saves this image and opens the next. **Skip image** leaves it unchanged. **Close** or Escape stops the review without changing the current image; earlier applied changes remain. Use the editor's Undo/Redo commands for individual applied images.

Image paragraphs become figures with a first-child `<figcaption id="img_N"><strong>…</strong></figcaption>`. New IDs avoid existing document IDs. Existing figures and caption IDs are reused. Images receive `img-responsive` while retaining other classes and attributes. Source and `alt` are updated from the form. Existing presentational roles or `aria-hidden="true"` are removed when the image becomes informative.

Paragraph text and image links are preserved, splitting a mixed paragraph around the figure when necessary. Picture sources remain intact, so an existing `srcset` may take precedence over the entered `src`. Review those attributes in Source Code Pro if changing a responsive image's source set. Existing figure captions are replaced by the entered plain text inside `<strong>`; Undo restores their previous markup.

The `img-responsive` class relies on the destination page's styles, such as WET/Bootstrap. This workflow does not add a stylesheet to exported HTML.

## Optional list of figures

After the last image is reviewed, a **List of figures** window offers an optional section for all captioned images currently in the document. **Not now** or Escape leaves the document unchanged. Enter a section heading, select H2–H6 (H2 is the default), and choose a standard heading with a list below or an expand/collapse section with the heading inside `<summary>` and the list inside `<details>`.

Build / Rebuild Sections preserves the generated list as a complete section or details block. It does not wrap the list heading in another section or absorb the list into the preceding generated section.

Choose document start (after a leading H1 page title, if present) or document end. The window explains both locations; choose a heading level appropriate to the surrounding content. Each list link uses a caption's text and points to that caption's ID. Missing and duplicate caption IDs are repaired in the same Undo transaction. Uncaptioned images are omitted. Existing generated lists are updated in place instead of duplicated. To refresh the list after editing captions, complete Review images again. List insertion or updating can be undone independently of image conversions.

At document start, a new figure list follows an existing List of tables, or the generated TOC if no table list exists. This preserves the order TOC → List of tables → List of figures.
