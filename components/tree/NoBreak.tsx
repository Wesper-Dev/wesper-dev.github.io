// Renders a FAITS string unchanged, with each numeric range (« 3–5 », « 1–3 ») kept on one line (audit Opus 5):
// the text stays identical to FAITS, only the rendering forbids a line break after the dash.
// Short measured ranges only: year spans such as « 2019–2026 » stay plain text (E16.2 reads them whole).
// Round W (contrat-relecture-w.md, W3 3.2): « co-construit » is kept whole the same way (the Croix-Rouge card broke
// it after the hyphen at 390 px); the text keeps its ordinary hyphen, so it reads and searches as before.
const RANGE = /(?<!\d)\d{1,2}–\d{1,2}(?!\d)|\bco-construit\b/g;

export default function NoBreak({ text }: { text: string }) {
  const parts: (string | { range: string })[] = [];
  let at = 0;
  for (const m of text.matchAll(RANGE)) {
    const i = m.index ?? 0;
    if (i > at) parts.push(text.slice(at, i));
    parts.push({ range: m[0] });
    at = i + m[0].length;
  }
  if (at < text.length) parts.push(text.slice(at));
  return (
    <>
      {parts.map((p, k) => (typeof p === 'string' ? p : <span key={k} className="tree-nowrap">{p.range}</span>))}
    </>
  );
}

// A date range (« avr. 2026 – oct. 2026 », « 14 juin 2025 – 15 juin 2025 ») kept on one line (recette Y5): its spaces
// become no-break spaces and it sits in a nowrap span, because a line may still break after the dash even before a
// no-break space (UAX #14, LB12a). The text itself is unchanged.
export function DateRange({ text }: { text: string }) {
  return <span className="tree-nowrap">{text.replace(/ /g, '\u00a0')}</span>;
}
