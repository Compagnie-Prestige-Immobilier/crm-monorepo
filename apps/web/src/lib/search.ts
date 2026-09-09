const LIGATURES: readonly (readonly [RegExp, string])[] = [
  [/œ/gu, 'oe'],
  [/æ/gu, 'ae'],
];

function foldForSearch(value: string): string {
  let folded = value.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  for (const [pattern, replacement] of LIGATURES) {
    folded = folded.replace(pattern, replacement);
  }
  return folded.replace(/[’‘‛`´]/gu, "'").toLocaleLowerCase('fr');
}

export function matchesSearch(haystack: string, needle: string): boolean {
  const terms = foldForSearch(needle)
    .split(/\s+/u)
    .filter((term) => term !== '');
  if (terms.length === 0) return true;
  const target = foldForSearch(haystack);
  return terms.every((term) => target.includes(term));
}
