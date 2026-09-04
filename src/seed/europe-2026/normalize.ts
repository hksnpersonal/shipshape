/**
 * Guards against a specific data-entry hazard.
 *
 * The source notes are UTF-8. Reading them with a tool that assumes the Windows ANSI
 * codepage turns every arrow, dash and accented letter into a two- or three-character
 * sequence ("Firenze â Venezia"). If that text is pasted into a seed file it looks
 * almost right and survives review. `MOJIBAKE_SEQUENCES` is asserted absent across the
 * whole seed by a test; `fixMojibake` repairs a string that already has it.
 */

/** Ordered longest-first so multi-byte sequences are replaced before their prefixes. */
const REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  ['\u00e2\u20ac\u201c', '\u2013'], // en dash
  ['\u00e2\u20ac\u201d', '\u2014'], // em dash
  ['\u00e2\u20ac\u2122', "'"], // right single quote
  ['\u00e2\u20ac\u0153', '"'], // left double quote
  ['\u00e2\u20ac\u009d', '"'], // right double quote
  ['\u00e2\u20ac\u00a2', '\u00b7'], // bullet
  ['\u00e2\u2020\u2019', '\u2192'], // right arrow
  ['\u00e2\u2030\u02c6', '\u2248'], // almost equal
  ['\u00e2\u201a\u00ac', '\u20ac'], // euro sign
  ['\u00c2\u00b7', '\u00b7'], // middot
  ['\u00c3\u00a0', '\u00e0'],
  ['\u00c3\u00a1', '\u00e1'],
  ['\u00c3\u00a2', '\u00e2'],
  ['\u00c3\u00a4', '\u00e4'],
  ['\u00c3\u00a8', '\u00e8'],
  ['\u00c3\u00a9', '\u00e9'],
  ['\u00c3\u00ab', '\u00eb'],
  ['\u00c3\u00ac', '\u00ec'],
  ['\u00c3\u00b2', '\u00f2'],
  ['\u00c3\u00b6', '\u00f6'],
  ['\u00c3\u00b9', '\u00f9'],
  ['\u00c3\u00bc', '\u00fc'],
  ['\u00c2\u00a0', ' '], // non-breaking space
];

/** The sequences a seed string must never contain. */
export const MOJIBAKE_SEQUENCES: readonly string[] = REPLACEMENTS.map(([bad]) => bad);

export function fixMojibake(input: string): string {
  let out = input;
  for (const [bad, good] of REPLACEMENTS) out = out.split(bad).join(good);
  return out;
}

/** Every mojibake sequence found in a string, for a test failure message. */
export function findMojibake(input: string): string[] {
  return MOJIBAKE_SEQUENCES.filter((seq) => input.includes(seq));
}

/** Walk any nested value and collect `path -> bad sequence` for every string it holds. */
export function scanForMojibake(value: unknown, path = '$'): Array<{ path: string; seq: string }> {
  if (typeof value === 'string') {
    return findMojibake(value).map((seq) => ({ path, seq }));
  }
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => scanForMojibake(v, `${path}[${i}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => scanForMojibake(v, `${path}.${k}`));
  }
  return [];
}
