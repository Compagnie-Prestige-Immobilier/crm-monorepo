import { describe, expect, it } from 'vitest';

import {
  formatXof,
  formatXofCompact,
  groupDigits,
  isMoneyString,
  parseMoneyInput,
  sumXof,
  xofToChartNumber,
} from '@/lib/money';

/**
 * Espace insécable ÉTROIT (U+202F) : le séparateur de milliers du français, et
 * celui qu'`Intl.NumberFormat('fr-SN')` produit ailleurs dans le panel. Les
 * tests l'écrivent explicitement plutôt qu'un espace ordinaire, sinon ils
 * passeraient avec un séparateur qui coupe les nombres en fin de ligne.
 */
const NB = '\u202f';

/**
 * Le franc CFA voyage en CHAÎNE, du serveur à l'écran.
 *
 * La colonne est un `Decimal(18,0)`. `Number.MAX_SAFE_INTEGER` s'arrête à
 * 9 007 199 254 740 991 : seize chiffres. Un `Number(montant)` sur un
 * portefeuille consolidé perd donc des unités SANS lever la moindre erreur, et
 * le total affiché diverge de celui du classeur Excel. Ces tests fixent le
 * fait qu'aucune conversion flottante n'a lieu sur le chemin d'affichage.
 */

describe('formatXof', () => {
  it('groupe les milliers et suffixe FCFA', () => {
    expect(formatXof('1200000')).toBe(`1${NB}200${NB}000 FCFA`);
  });

  it('formate un montant qui dépasse la précision d’un nombre JSON', () => {
    // 18 chiffres : la borne exacte de la colonne. `Number('999999999999999999')`
    // vaut 1e18 : soit une unité de plus que la réalité, silencieusement.
    const huge = '999999999999999999';
    expect(formatXof(huge)).toBe(`999${NB}999${NB}999${NB}999${NB}999${NB}999 FCFA`);
    // La preuve du danger, écrite noir sur blanc : la voie flottante ment.
    expect(String(Number(huge))).not.toBe(huge);
  });

  it('conserve chaque chiffre d’un montant de seize chiffres et plus', () => {
    const value = '9007199254740993'; // MAX_SAFE_INTEGER + 2
    expect(formatXof(value)).toContain(`9${NB}007${NB}199${NB}254${NB}740${NB}993`);
  });

  it('distingue « pas de montant » de « montant nul »', () => {
    // Un dossier en instruction n'a AUCUN montant ; un dossier rejeté en a un,
    // qui vaut zéro. Les confondre effacerait la différence entre « pas encore
    // décidé » et « décidé, à zéro ».
    expect(formatXof(null)).toBe('–');
    expect(formatXof(undefined)).toBe('–');
    expect(formatXof('')).toBe('–');
    expect(formatXof('0')).toBe('0 FCFA');
    expect(formatXof(null, '0 FCFA')).toBe('0 FCFA');
  });

  it('normalise les zéros de tête sans perdre le zéro seul', () => {
    expect(formatXof('000042')).toBe('42 FCFA');
    expect(formatXof('000')).toBe('0 FCFA');
  });

  it('affiche une valeur inattendue plutôt que de la masquer', () => {
    // Repli délibéré : si l'API renvoyait un jour un format que ce module ne
    // sait pas lire, mieux vaut montrer la donnée brute qu'un tiret qui
    // laisserait croire à une absence.
    expect(formatXof('1 200,50')).toBe('1 200,50 FCFA');
  });
});

describe('groupDigits', () => {
  it('groupe par trois depuis la droite', () => {
    expect(groupDigits('1')).toBe('1');
    expect(groupDigits('12')).toBe('12');
    expect(groupDigits('123')).toBe('123');
    expect(groupDigits('1234')).toBe(`1${NB}234`);
    expect(groupDigits('1234567')).toBe(`1${NB}234${NB}567`);
  });
});

describe('parseMoneyInput', () => {
  it('accepte les formes que l’agent tape réellement', () => {
    expect(parseMoneyInput('1 200 000')).toBe('1200000');
    expect(parseMoneyInput('1.200.000')).toBe('1200000');
    expect(parseMoneyInput('1200000 FCFA')).toBe('1200000');
  });

  it('rend null sur une saisie sans chiffre, pour ne pas annoncer « 0 FCFA »', () => {
    // Un aperçu « 0 FCFA » sous un champ vierge se lit comme un montant déjà
    // validé.
    expect(parseMoneyInput('')).toBeNull();
    expect(parseMoneyInput('   ')).toBeNull();
    expect(parseMoneyInput('abc')).toBeNull();
  });

  it('refuse au-delà de 18 chiffres, borne de la colonne', () => {
    expect(parseMoneyInput('1'.repeat(18))).toBe('1'.repeat(18));
    expect(parseMoneyInput('1'.repeat(19))).toBeNull();
  });
});

describe('aller-retour saisie → API → affichage', () => {
  it('conserve la valeur exacte à chaque étape', () => {
    // Le parcours réel d'un encaissement : l'agent tape, on normalise, l'API
    // renvoie la même chaîne, on la formate. Aucun `Number` sur le chemin.
    const typed = '12 400 000';
    const toApi = parseMoneyInput(typed);
    expect(toApi).toBe('12400000');
    expect(isMoneyString(toApi)).toBe(true);
    // Ce que l'API renverra, à l'octet près.
    const fromApi = '12400000';
    expect(fromApi).toBe(toApi);
    expect(formatXof(fromApi)).toBe(`12${NB}400${NB}000 FCFA`);
  });
});

describe('sumXof', () => {
  it('additionne en bigint, au-delà de la précision d’un double', () => {
    expect(sumXof(['9007199254740991', '1', '1'])).toBe('9007199254740993');
  });

  it('ignore les valeurs absentes ou mal formées', () => {
    expect(sumXof(['1000', null, undefined, 'abc', '500'])).toBe('1500');
  });
});

describe('xofToChartNumber', () => {
  it('convertit pour un axe de graphique, et seulement pour ça', () => {
    expect(xofToChartNumber('1200000')).toBe(1_200_000);
    expect(xofToChartNumber(null)).toBe(0);
    expect(xofToChartNumber('pas un montant')).toBe(0);
  });
});

/**
 * Le montant ABRÉGÉ des tuiles d'indicateur.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Les cas limites sont TOUS ici, parce que c'est là que l'abrégé ment.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un abrégé se juge à ses frontières : 999 contre 1 000, 999 999 contre
 * 1 000 000, 999 999 999 contre 1 000 000 000. C'est là qu'un arrondi mal
 * choisi fait sauter une unité entière et annonce un milliard là où il y a
 * 999 999 999 francs.
 */
describe('formatXofCompact', () => {
  it('laisse les petits montants entiers : l’abrégé serait plus long', () => {
    expect(formatXofCompact('0')).toBe('0 FCFA');
    expect(formatXofCompact('999')).toBe('999 FCFA');
  });

  it('bascule en milliers à quatre chiffres', () => {
    expect(formatXofCompact('1000')).toBe('1 k FCFA');
    expect(formatXofCompact('85000')).toBe('85 k FCFA');
    expect(formatXofCompact('999999')).toBe('999 k FCFA');
  });

  it('bascule en millions à sept chiffres', () => {
    expect(formatXofCompact('1000000')).toBe('1 M FCFA');
    expect(formatXofCompact('12500000')).toBe('12,5 M FCFA');
    expect(formatXofCompact('340000000')).toBe('340 M FCFA');
    expect(formatXofCompact('999999999')).toBe('999 M FCFA');
  });

  it('bascule en MILLIARDS à dix chiffres, avec l’abréviation française', () => {
    expect(formatXofCompact('1000000000')).toBe('1 Mrd FCFA');
    expect(formatXofCompact('1250000000')).toBe(`1,25 Mrd FCFA`);
    // « B » est l'anglais *billion*, « G » n'est pas du français non plus.
    expect(formatXofCompact('1250000000')).not.toContain('B ');
    expect(formatXofCompact('1250000000')).not.toContain('G ');
  });

  it('TRONQUE, il n’arrondit pas : on n’annonce jamais plus que la caisse', () => {
    // Arrondir donnerait « 1 Mrd » pour un franc de moins qu'un milliard, et
    // ferait sauter une unité par-dessus le marché.
    expect(formatXofCompact('999999999')).toBe('999 M FCFA');
    expect(formatXofCompact('999999')).toBe('999 k FCFA');
  });

  it('tient les 18 chiffres de la colonne sans perdre une unité', () => {
    const huge = '999999999999999999';
    expect(formatXofCompact(huge)).toBe(`999${NB}999${NB}999 Mrd FCFA`);
    // Le montant exact reste juste : c'est lui que l'écran sait rendre à la
    // demande, et il ne passe jamais par un flottant.
    expect(formatXof(huge)).toBe(`999${NB}999${NB}999${NB}999${NB}999${NB}999 FCFA`);
  });

  it('emploie l’espace insécable étroit, comme le montant exact', () => {
    expect(formatXofCompact('1250000000000')).toBe(`1${NB}250 Mrd FCFA`);
  });

  it('garde trois chiffres significatifs, pas davantage', () => {
    expect(formatXofCompact('1234567890')).toBe('1,23 Mrd FCFA');
    expect(formatXofCompact('12345678900')).toBe('12,3 Mrd FCFA');
    expect(formatXofCompact('123456789000')).toBe('123 Mrd FCFA');
  });

  it('rend le repli sur une valeur absente, et jamais « 0 FCFA »', () => {
    // Un dossier en cours d'instruction n'a AUCUN montant ; il n'en a pas un nul.
    expect(formatXofCompact(null)).toBe('–');
    expect(formatXofCompact(undefined)).toBe('–');
    expect(formatXofCompact('')).toBe('–');
    expect(formatXofCompact(null, '0 FCFA')).toBe('0 FCFA');
  });

  it('n’invente rien sur une valeur mal formée', () => {
    expect(formatXofCompact('abc')).toBe('abc FCFA');
  });

  it('ne passe par aucun flottant : la preuve par le montant qui casse', () => {
    // `Number('9007199254740993')` vaut 9007199254740992. La voie flottante
    // perdrait ce franc ; la voie chaîne le garde jusque dans l'abrégé.
    const beyondSafe = '9007199254740993';
    expect(String(Number(beyondSafe))).not.toBe(beyondSafe);
    expect(formatXof(beyondSafe)).toBe(`9${NB}007${NB}199${NB}254${NB}740${NB}993 FCFA`);
    expect(formatXofCompact(beyondSafe)).toBe(`9${NB}007${NB}199 Mrd FCFA`);
  });
});
