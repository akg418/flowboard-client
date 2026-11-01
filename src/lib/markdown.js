import { marked } from 'marked';

/**
 * Renders markdown that was typed as plain text (“# Title”, “- item”, “**bold**”) in a note's HTML.
 * Only top-level paragraphs are touched; real headings, lists and mentions are kept as they are.
 */
export function renderTypedMarkdown(html) {
  if (!html) return html;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild;
  let run = [];
  const flush = () => {
    if (!run.length) return;
    // Paragraphs inside the editor arrive HTML-escaped; marked must see the raw markdown characters.
    const md = run.map((p) => p.innerHTML.replace(/&gt;/g, '>').replace(/&amp;/g, '&')).join('\n\n');
    const out = doc.createElement('div');
    out.innerHTML = marked.parse(md, { breaks: true });
    run[0].before(...out.childNodes);
    run.forEach((p) => p.remove());
    run = [];
  };
  for (const node of [...root.childNodes]) {
    if (node.nodeName === 'P') run.push(node);
    else flush();
  }
  flush();
  return root.innerHTML;
}
