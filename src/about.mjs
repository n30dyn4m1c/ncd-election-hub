// F5: the trust pages under /about/, generated from data/.
import { page, esc } from "./layout.mjs";
import { formatSpan } from "./dates.mjs";

const REPO = "https://github.com/n30dyn4m1c/ncd-election-hub";
export const FUNDING_LABELS = { "enhanced-profile": "Enhanced candidate profile", "briefing": "Campaign briefing pack", "sponsorship": "Sponsorship", "grant": "Grant", "partnership": "Media or data partnership", "test": "Test payment" };
const STATUS_TEXT = {
  unconfirmed: "Unconfirmed: reported, but not yet backed by an official source",
  announced: "Announced by PNGEC",
  gazetted: "Published in the National Gazette",
  changed: "Changed from an earlier official date",
};

const kina = (n) => "K" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
const longDate = (iso) => formatSpan({ start: iso, end: null });
const table = (head, rows, caption) =>
  `  <div class="scroll"><table class="stack">
    <caption>${caption}</caption>
    <thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead>
    <tbody>
${rows.map((r) => `      <tr>${r.map((c, i) => `<td data-label="${head[i]}">${c}</td>`).join("")}</tr>`).join("\n")}
    </tbody>
  </table></div>`;

function charter() {
  return page({
    path: "about/index.html",
    title: "About and charter",
    description: "Who runs the NCD Election Hub, the rules it holds itself to, and where to check its funding, corrections and methods.",
    eyebrow: "About",
    h1: "About this site",
    lede: "The NCD Election Hub gives voters, candidates and journalists independent, sourced information about the five National Capital District seats in Papua New Guinea's 2027 general election. It is not the PNG Electoral Commission, and it is not run by any party or candidate.",
    body: `
  <h2 id="charter">Independence charter</h2>
  <p>These six rules apply to everything the site publishes.</p>
  <ol class="rules">
    <li><b>Every fact has a source you can check.</b> Each source records who published it, when it was retrieved and whether it is official.</li>
    <li><b>Candidates are listed in ballot order</b> once PNGEC publishes it, and alphabetically before that. Payment never changes the order, and nobody can pay to be included or left out.</li>
    <li><b>Anything a candidate writes about themselves</b> appears in a box labelled "Supplied by the candidate", and never replaces a sourced fact.</li>
    <li><b>Every paid candidate listing</b> has a matching entry in the public <a href="funding/">funding ledger</a>.</li>
    <li><b>Every page says the site is independent</b> and links to the PNG Electoral Commission.</li>
    <li><b>Pages load nothing from other servers:</b> no ad networks, trackers or outside scripts.</li>
  </ol>
  <p>Rules 1, 5 and 6 are checked automatically every time the site is built, and a page that breaks one is not published. Rules 2 to 4 will be checked the same way when candidate listings open.</p>

  <h2>More about how the site works</h2>
  <div class="grid">
    <a class="card tool" href="funding/"><h3>Funding</h3><p>Who has paid the site, how much, and for what.</p></a>
    <a class="card tool" href="corrections/"><h3>Corrections</h3><p>Every mistake fixed, with the date, and how to report one.</p></a>
    <a class="card tool" href="methodology/"><h3>Methodology</h3><p>Where the facts come from, what "unconfirmed" means, and what the count simulator can and cannot tell you.</p></a>
    <a class="card tool" href="privacy/"><h3>Privacy</h3><p>What the site stores about you. In short: almost nothing.</p></a>
  </div>`,
  });
}

function funding(data) {
  const rows = data.funding
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
    .map((f) => [longDate(f.date), esc(f.payer), FUNDING_LABELS[f.kind], kina(f.amount_kina), esc(f.purpose)]);
  const ledger = rows.length
    ? table(["Date", "Payer", "Type", "Amount", "What it paid for"], rows, "Funding ledger, newest first")
    : `  <p class="empty"><b>Nothing has been recorded in this ledger yet.</b></p>`;
  return page({
    path: "about/funding/index.html",
    title: "Funding",
    description: "The NCD Election Hub's public funding ledger: every payer, amount and purpose.",
    eyebrow: "About · Funding",
    h1: "Who funds this site",
    lede: "Every payment the site receives from a candidate, campaign, sponsor or funder is listed here with the payer, the amount and what it paid for.",
    body: `
  <section data-job="funding">
  <h2>Funding ledger</h2>
${ledger}
  </section>
  <h2>What money does not buy</h2>
  <p>Payment never changes the order candidates are listed in, whether someone is listed, or what the site writes. See rules 2 to 4 of the <a href="../#charter">independence charter</a>.</p>`,
  });
}

function corrections(data) {
  const rows = data.corrections
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
    .map((c) => [longDate(c.date), `<a href="../../${esc(c.page)}">${esc(c.page_title)}</a>`, esc(c.was), esc(c.now)]);
  const log = rows.length
    ? table(["Date", "Page", "What was wrong", "What it says now"], rows, "Corrections, newest first")
    : `  <p class="empty"><b>No corrections have been published yet.</b></p>`;
  return page({
    path: "about/corrections/index.html",
    title: "Corrections",
    description: "Every correction the NCD Election Hub has made, with the date, and how to report an error.",
    eyebrow: "About · Corrections",
    h1: "Corrections",
    lede: "When the site gets something wrong, it fixes the mistake everywhere it appears and records the fix here.",
    body: `
  <section data-job="corrections">
  <h2>Corrections log</h2>
${log}
  </section>
  <h2 id="report">Report an error</h2>
  <p>Open an issue on the site's <a href="${REPO}/issues/new">public GitHub page</a>. You need a free GitHub account. Say which page is wrong, what it should say, and where that is published, with a link if you have one.</p>
  <p>Reports are public. Do not include anything you would not want others to read.</p>`,
  });
}

function methodology(data) {
  const byId = new Map(data.sources.map((s) => [s.id, s]));
  const srcLink = (id) => { const s = byId.get(id); return `<a href="${esc(s.url)}">${esc(s.title)}</a>`; };
  const dateRows = data.dates.map((d) => [esc(d.label), formatSpan(d), STATUS_TEXT[d.status].split(":")[0], srcLink(d.source)]);
  const sourceRows = data.sources.map((s) => [
    `<a href="${esc(s.url)}">${esc(s.title)}</a>`,
    esc(s.publisher),
    s.official ? "Yes" : "No",
    s.retrieved ? longDate(s.retrieved) : "Not yet recorded",
    s.archive_url ? `<a href="${esc(s.archive_url)}">Archived copy</a>` : "None yet",
  ]);
  return page({
    path: "about/methodology/index.html",
    title: "Methodology",
    description: "Where the NCD Election Hub's facts come from, how election dates are labelled, and what the count simulator can and cannot tell you.",
    eyebrow: "About · Methodology",
    h1: "How the site works",
    lede: "Facts are stored once in the site's data files, each with its source, and every page that uses a fact is built from that record. The count simulator's 2022 figures are still being moved into those files.",
    body: `
  <h2>Sources</h2>
  <p>Each source records who published it, whether it is official (PNGEC, the National Gazette or another government body), when it was retrieved and, where possible, an archived copy in case the original moves.</p>

  <h2 id="dates">How dates are labelled</h2>
  <p>PNG election timetables can move, so every date carries a status:</p>
  <ul>
${Object.values(STATUS_TEXT).map((t) => `    <li>${t.replace(/^([^:]+)/, "<b>$1</b>")}.</li>`).join("\n")}
  </ul>
  <p>A date can only be shown as anything other than unconfirmed if its source is official. Today's dates:</p>
${table(["Event", "Date", "Status", "Source"], dateRows, "2027 election dates and their status")}

  <h2>The count simulator</h2>
  <p>The <a href="../../count-lab/">Moresby Count Lab</a> is a planning tool, not a forecast. Rival candidates are unnamed types built from the shape of each seat's 2022 result. Community shares, reach and campaign effects are calibrated guesses that you can change. Motu-Koita is a new seat with no past results, so its figures are an illustrative stand-in.</p>

  <h2>Every source the site uses</h2>
${table(["Source", "Publisher", "Official", "Retrieved", "Archive"], sourceRows, "All sources")}`,
  });
}

function privacy() {
  return page({
    path: "about/privacy/index.html",
    title: "Privacy",
    description: "What the NCD Election Hub stores about you: no accounts, no cookies, no analytics or trackers.",
    eyebrow: "About · Privacy",
    h1: "Privacy",
    lede: "The site has no accounts, no cookies, no analytics and no trackers, and it does not collect your name or contact details.",
    body: `
  <h2>What stays on your device</h2>
  <ul>
    <li>The <a href="../../count-lab/">count simulator</a> remembers your plan in this browser so it is there next time. It is never sent anywhere.</li>
    <li>If you choose a light or dark theme, that choice is remembered in this browser.</li>
  </ul>
  <p>Clearing your browser's site data removes both.</p>

  <h2>Hosting</h2>
  <p>The site is hosted on GitHub Pages. Like any web host, GitHub may log the IP address of visitors for security. See the <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">GitHub privacy statement</a>.</p>

  <h2>Reporting an error</h2>
  <p>Error reports go through GitHub and are public. See <a href="../corrections/#report">how to report an error</a>.</p>

  <h2>Changes</h2>
  <p>If the site adds an email list or reader polls, this page will name the service used and what it stores before that feature goes live.</p>`,
  });
}

/** All trust pages as a Map of site path to HTML. */
export function aboutPages(data) {
  return new Map([
    ["about/index.html", charter()],
    ["about/funding/index.html", funding(data)],
    ["about/corrections/index.html", corrections(data)],
    ["about/methodology/index.html", methodology(data)],
    ["about/privacy/index.html", privacy()],
  ]);
}
