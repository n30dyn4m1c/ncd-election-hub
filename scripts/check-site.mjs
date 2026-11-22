// Checks the built site. Usage: node scripts/check-site.mjs _site
// Prints one "<area>: OK" line per area and exits non-zero on any failure.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative, posix } from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

/** Hosts a page may load resources (scripts, styles, fonts, images, frames) from. Links to sources are fine anywhere. */
export const RESOURCE_HOSTS = [];
/** Gzip budgets in bytes. Tools are interactive pages with an inline engine. */
export const BUDGET = { content: 30 * 1024, tool: 150 * 1024 };
const TOOL_PREFIXES = ["count-lab/", "tools/"];
export const INDEPENDENCE_TEXT = "This site is independent. It is not the PNG Electoral Commission.";

function walk(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p, base) : [relative(base, p).split("\\").join("/")];
  });
}

const attrs = (html, re) => [...html.matchAll(re)].map((m) => m[1] ?? m[2] ?? m[3]);
const stripComments = (html) => html.replace(/<!--[\s\S]*?-->/g, "");
const stripScripts = (html) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
const isExternal = (u) => /^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith("//");

function resolveInternal(dir, page, url) {
  const clean = url.split("#")[0].split("?")[0];
  if (!clean) return true; // pure fragment or query
  let target = posix.normalize(posix.join(posix.dirname(page), clean));
  if (target.startsWith("..")) return false;
  if (clean.endsWith("/") || target === ".") target = posix.join(target, "index.html");
  const abs = join(dir, target);
  if (existsSync(abs) && statSync(abs).isDirectory()) return existsSync(join(abs, "index.html"));
  return existsSync(abs);
}

/** Returns { area: [error, ...] }. */
export function checkSite(dir) {
  const out = { pages: [], footer: [], links: [], hosts: [], budget: [] };
  const files = walk(dir);
  const pages = files.filter((f) => f.endsWith(".html"));
  if (!pages.length) out.pages.push("no HTML pages found");

  for (const page of pages) {
    const raw = readFileSync(join(dir, page), "utf8");
    const html = stripComments(raw);
    const markup = stripScripts(html);
    const at = (msg) => `${page}: ${msg}`;

    // pages: lang, title, description, exactly one h1
    const lang = html.match(/<html\b[^>]*\blang=["']?([^"'\s>]*)/i);
    if (!lang || !lang[1]) out.pages.push(at("<html> has no lang"));
    const title = html.match(/<title>([\s\S]*?)<\/title>/i);
    if (!title || !title[1].trim()) out.pages.push(at("missing <title>"));
    if (!/<meta\s+name=["']?description["']?\s+content=["'][^"']+["']/i.test(html)) out.pages.push(at("missing meta description"));
    const h1s = (markup.match(/<h1\b/gi) || []).length;
    if (h1s !== 1) out.pages.push(at(`has ${h1s} <h1> elements, expected 1`));

    // footer: independence statement and PNGEC link inside <footer>
    const footer = markup.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/i);
    if (!footer) out.footer.push(at("no <footer>"));
    else {
      if (!footer[1].includes(INDEPENDENCE_TEXT)) out.footer.push(at("footer lacks the independence statement"));
      if (!/href=["']https:\/\/pngec\.gov\.pg\/?["']/.test(footer[1])) out.footer.push(at("footer lacks the pngec.gov.pg link"));
    }

    // links: every internal href/src resolves to a built file
    const urls = attrs(markup, /\s(?:href|src)=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi);
    for (const u of urls) {
      if (isExternal(u) || u.startsWith("#")) continue;
      if (!resolveInternal(dir, page, u)) out.links.push(at(`broken internal link "${u}"`));
    }

    // hosts: no resource loads from hosts outside the allowlist
    const resourceUrls = [
      ...attrs(html, /<script\b[^>]*\ssrc=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi),
      ...attrs(markup, /<(?:img|iframe|source|audio|video|embed)\b[^>]*\ssrc=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi),
      ...[...markup.matchAll(/<link\b[^>]*>/gi)].map((m) => (m[0].match(/\shref=["']?([^"'\s>]+)/i) || [])[1]).filter(Boolean),
      ...attrs(html, /@import\s+(?:url\()?["']?([^"')\s]+)/gi),
      ...attrs(html, /url\(\s*["']?(https?:\/\/[^"')\s]+)/gi),
    ];
    for (const u of resourceUrls) {
      if (!isExternal(u)) continue;
      let host;
      try { host = new URL(u, "https://local.invalid/").host; } catch { host = u; }
      if (!RESOURCE_HOSTS.includes(host)) out.hosts.push(at(`loads a resource from ${host}`));
    }
  }

  // budget: gzip size per HTML/CSS/JS file
  for (const f of files.filter((f) => /\.(html|css|js|mjs)$/.test(f))) {
    const size = gzipSync(readFileSync(join(dir, f))).length;
    const kind = TOOL_PREFIXES.some((p) => f.startsWith(p)) ? "tool" : "content";
    if (size > BUDGET[kind]) out.budget.push(`${f}: ${size} bytes gzipped, over the ${kind} budget of ${BUDGET[kind]}`);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), "..", "_site");
  if (!existsSync(dir)) {
    console.error(`site: ${dir} does not exist; run node build.mjs first`);
    process.exit(1);
  }
  let failed = false;
  for (const [area, errors] of Object.entries(checkSite(dir))) {
    if (!errors.length) console.log(`${area}: OK`);
    else {
      failed = true;
      console.error(`${area}: ${errors.length} error(s)`);
      for (const e of errors) console.error(`  - ${e}`);
    }
  }
  process.exit(failed ? 1 : 0);
}
