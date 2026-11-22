// Shared page furniture: relative paths, theme switch, footer, and the
// wrapper for generated content pages.

export const INDEPENDENCE =
  'This site is independent. It is not the PNG Electoral Commission. For official enrolment, polling places and results, see <a href="https://pngec.gov.pg">pngec.gov.pg</a>.';

/** Trust pages every footer links to, as [site path, label]. */
export const TRUST_LINKS = [
  ["about/", "About and charter"],
  ["about/funding/", "Funding"],
  ["about/corrections/", "Corrections"],
  ["about/methodology/", "Methodology"],
  ["about/privacy/", "Privacy"],
];

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Prefix from a built file back to the site root: "index.html" → "", "about/funding/index.html" → "../../". */
export const rel = (path) => "../".repeat(path.split("/").length - 1);

/** Apply a saved theme before first paint, so there is no flash. */
export const THEME_HEAD =
  '<script>try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}</script>';

// Hidden without JavaScript, because it cannot work without it.
const THEME_SWITCH = `<button type="button" class="theme-btn" id="themeBtn" hidden>Theme: Auto</button>
<script>(function(){var b=document.getElementById("themeBtn"),r=document.documentElement,n=["auto","light","dark"],L={auto:"Auto",light:"Light",dark:"Dark"};
function cur(){return r.dataset.theme||"auto"}function show(){b.textContent="Theme: "+L[cur()]}
b.hidden=false;show();b.addEventListener("click",function(){var t=n[(n.indexOf(cur())+1)%3];
if(t==="auto")delete r.dataset.theme;else r.dataset.theme=t;try{if(t==="auto")localStorage.removeItem("theme");else localStorage.setItem("theme",t)}catch(e){}show()})})();</script>`;

/** Footer contents for a page at `path`: independence statement, trust links, theme switch. */
export function footer(path) {
  const root = rel(path);
  const links = TRUST_LINKS.map(([href, label]) => `<a href="${root}${href}">${label}</a>`).join(" · ");
  return `<p>${INDEPENDENCE}</p>
    <p class="foot-links">${links} · ${THEME_SWITCH}</p>`;
}

/** A complete content page using the shared stylesheet. */
export function page({ path, title, description, eyebrow, h1, lede, body }) {
  const root = rel(path);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · NCD Election Hub</title>
<meta name="description" content="${esc(description)}">
${THEME_HEAD}
<link rel="stylesheet" href="${root}assets/site.css">
</head>
<body>
<div class="wrap">
  <nav class="crumb"><a href="${root}">← NCD Election Hub</a></nav>
  <div class="eyebrow">${esc(eyebrow)}</div>
  <h1>${esc(h1)}</h1>
  ${lede ? `<p class="lede">${lede}</p>` : ""}
${body}
  <footer>
    ${footer(path)}
  </footer>
</div>
</body>
</html>
`;
}
