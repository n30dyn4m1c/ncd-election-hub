// Date formatting shared by the build and the generated pages.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parts(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m: m - 1, d };
}

/** "6 May 2027"; style "daymonth" gives "26 June". */
export function formatDate(iso, style = "full") {
  const { y, m, d } = parts(iso);
  if (style === "daymonth") return `${d} ${MONTHS_LONG[m]}`;
  if (style === "full") return `${d} ${MONTHS[m]} ${y}`;
  throw new Error(`unknown date style "${style}"`);
}

/** "29 Apr – 6 May 2027", or without the year when withYear is false. */
export function formatSpan(entry, { withYear = true } = {}) {
  const a = parts(entry.start);
  if (!entry.end) return `${a.d} ${MONTHS[a.m]} ${a.y}`;
  const b = parts(entry.end);
  const left = a.y === b.y ? `${a.d} ${MONTHS[a.m]}` : `${a.d} ${MONTHS[a.m]} ${a.y}`;
  return `${left} – ${b.d} ${MONTHS[b.m]}${withYear || a.y !== b.y ? ` ${b.y}` : ""}`;
}
