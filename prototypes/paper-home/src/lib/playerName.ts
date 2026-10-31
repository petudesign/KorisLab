const HYPHEN = /([\-‐‑‒–—])/;
const APOSTROPHE = /(['’])/;
// The source writes these in capitals even when the rest of the name is normal: AJ, DJ, III.
const KEEP_CAPITALS = /^(?:\p{L}J|I{2,3}|IV)$/iu;
const upper = (text: string) => text.toLocaleUpperCase("fi-FI");
const lower = (text: string) => text.toLocaleLowerCase("fi-FI");
const initial = (text: string) => {
  const [first = "", ...rest] = text;
  return upper(first) + rest.join("");
};
const isCapitals = (text: string) => /\p{L}/u.test(text) && text === upper(text);

// Capitals lose the original spelling, so McCoy and De'Vion are rebuilt by rule. A last letter after an apostrophe stays small: Viont'e.
function fromCapitals(part: string): string {
  const word = lower(part);
  if (/^mc\p{L}{2}/u.test(word)) return `Mc${initial(word.slice(2))}`;
  return word.split(APOSTROPHE).map((piece, index) => index === 0 || [...piece].length > 1 ? initial(piece) : piece).join("");
}

// Only the casing of the shown name changes; ids and source files stay as they are.
export function playerDisplayName(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "";
  return trimmed.split(/(\s+)/).map((word) => {
    if (KEEP_CAPITALS.test(word)) return upper(word);
    return word.split(HYPHEN).map((part) => isCapitals(part) ? fromCapitals(part) : initial(part)).join("");
  }).join("");
}
