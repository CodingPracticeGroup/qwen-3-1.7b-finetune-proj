// Wraps every 'e' and 'E' under root in <span class="e">, so CSS can color it.
// A span rather than <mark>, which some screen readers announce on every letter.
export function markE(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts = [];
  while (walker.nextNode()) texts.push(walker.currentNode);

  for (const text of texts) {
    const parts = text.data.split(/([eE])/);
    if (parts.length === 1) continue;
    const marked = document.createDocumentFragment();
    for (const part of parts) {
      if (part === "e" || part === "E") {
        const letter = document.createElement("span");
        letter.className = "e";
        letter.textContent = part;
        marked.append(letter);
      } else if (part) {
        marked.append(part);
      }
    }
    text.replaceWith(marked);
  }
}
