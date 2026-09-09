import { formatXof } from '@/lib/format';

const CHIFFRES = /^\d{1,18}$/u;

export function estMontant(valeur: string): boolean {
  return CHIFFRES.test(valeur);
}

/** Un champ de montant ne garde que ses chiffres : le contrat les transporte en chaîne. */
export function saisieMontant(brut: string): string | null {
  const chiffres = brut.replace(/\D/gu, '').replace(/^0+(?=\d)/u, '');
  if (chiffres === '' || chiffres.length > 18) return null;
  return chiffres;
}

/** « – » et non « 0 FCFA » : un dossier en instruction n'a aucun montant. */
export function formatMontant(valeur: string | null | undefined, absent = '–'): string {
  if (valeur === null || valeur === undefined || valeur === '') return absent;
  return formatXof(valeur);
}
