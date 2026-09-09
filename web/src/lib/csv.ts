type Cellule = string | number | null | undefined;

function cellule(valeur: Cellule): string {
  if (valeur === null || valeur === undefined) return '';
  const texte = String(valeur);
  return /[";\r\n]/.test(texte) ? `"${texte.replaceAll('"', '""')}"` : texte;
}

// Point-virgule et BOM : ce qu'Excel en français ouvre sans assistant.
export function telechargerCsv(nom: string, lignes: readonly (readonly Cellule[])[]): void {
  const contenu = lignes.map((ligne) => ligne.map(cellule).join(';')).join('\r\n');
  const bom = String.fromCodePoint(0xfeff);
  const url = URL.createObjectURL(new Blob([bom, contenu], { type: 'text/csv;charset=utf-8' }));
  const ancre = document.createElement('a');
  ancre.href = url;
  ancre.download = nom;
  ancre.click();
  URL.revokeObjectURL(url);
}
