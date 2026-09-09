const CLE_REPLI = 'cpi_sidebar';
const CLE_PLUS = 'cpi_sidebar_plus';

function lire(cle: string): boolean {
  try {
    return localStorage.getItem(cle) === '1';
  } catch {
    return false;
  }
}

function ecrire(cle: string, valeur: boolean): void {
  try {
    localStorage.setItem(cle, valeur ? '1' : '0');
  } catch {}
}

/** Lu avant le premier rendu : sinon la barre saute d'une largeur à l'autre. */
export const barreRepliee = (): boolean => lire(CLE_REPLI);

export const setBarreRepliee = (valeur: boolean): void => {
  ecrire(CLE_REPLI, valeur);
};

export const replisOuverts = (): boolean => lire(CLE_PLUS);

export const setReplisOuverts = (valeur: boolean): void => {
  ecrire(CLE_PLUS, valeur);
};
