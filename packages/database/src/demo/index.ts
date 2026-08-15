/**
 * JEU DE DONNÉES DE DÉMONSTRATION : CPI GO
 *
 * À quoi ça sert
 * ──────────────
 * Peupler la plateforme d'une activité crédible le temps d'une démonstration :
 * six comptes, quinze représentants, cent vingt prospects répartis sur les
 * quatre segments BDD, deux campagnes d'appels et vingt dossiers bancaires.
 * Tous les écrans : listes, tableau de bord, programme d'appel, tableau
 * Banque & Finance, courbes dans le temps : doivent avoir quelque chose à
 * montrer, et ce quelque chose doit se tenir : un tableau de bord rempli de
 * bruit aléatoire se lit comme du bruit aléatoire.
 *
 * Ce fichier est une DESCRIPTION PURE : aucun accès base, aucun client Prisma,
 * aucun effet de bord. C'est le module `demo` de l'API qui l'écrit en base
 * derrière l'interrupteur admin, et qui l'efface en s'appuyant sur le registre
 * `DemoEntity`. Le jeu de données ignore tout de la manière dont il est semé.
 *
 * Règle nº 1 : RÉFÉRENCE PAR CLÉ NATURELLE
 * ────────────────────────────────────────
 * Rien ici ne désigne une ligne par son identifiant. Les référentiels sont
 * référencés par la clé stable qui porte le sens métier :
 *
 *   Banque               → `shortName`  (CBAO, SGS, Ecobank, BHS, CMS…)
 *   Syndicat             → `sigle`      (CHUES, UES, SAEMSS, SUTSAS, CNTS…)
 *   Departement          → `code`       (DK-DAK, TH-THI, SL-STL…)
 *   BankCaseStage        → `code`       (A_TRAITER, ENCAISSE, REJETE…)
 *   BankRejectionReason  → `code`       (DOCUMENT_MANQUANT, SOLDE_INSUFFISANT…)
 *
 * Les identifiants sont générés : ils diffèrent entre le poste du développeur,
 * la préproduction et la production. Un jeu de données qui en contiendrait ne
 * serait semable que sur la base où il a été écrit. Le semeur résout ces clés
 * au moment du semis ; une clé absente du référentiel fait échouer le semis :
 * c'est pourquoi `demo.test.ts` vérifie CHACUNE d'entre elles contre
 * `seed-data/`, à froid, plutôt que devant un auditoire.
 *
 * Règle nº 2 : DATES RELATIVES ET DÉTERMINISME
 * ────────────────────────────────────────────
 * Aucune date absolue, aucun `Date.now()`, aucun `Math.random()`. Tout est un
 * décalage `daysAgo` que le semeur convertit à l'instant du semis. Le même jeu
 * de données produit donc exactement la même démonstration aujourd'hui, dans
 * six mois et sur n'importe quelle machine, et la courbe « prospects dans le
 * temps » n'est jamais vide.
 */
import { DEMO_BANK_CASES } from './bank-cases.js';
import { DEMO_CAMPAIGNS } from './campaigns.js';
import { DEMO_PROSPECTS } from './prospects.js';
import { DEMO_REPRESENTANTS } from './representants.js';
import type { DemoDataset } from './types.js';
import { DEMO_USERS } from './users.js';

export * from './types.js';
export { DEMO_PASSWORD, DEMO_USERS, DEMO_COMMERCIAL_KEYS } from './users.js';
export { DEMO_REPRESENTANTS } from './representants.js';
export { DEMO_PROSPECTS } from './prospects.js';
export { DEMO_CAMPAIGNS } from './campaigns.js';
export { DEMO_BANK_CASES } from './bank-cases.js';

/**
 * L'ordre des tableaux EST l'ordre de création : un représentant a besoin de
 * son commercial, un prospect de son représentant, un dossier de son prospect.
 * Le semeur écrit dans cet ordre et enregistre chaque ligne dans `DemoEntity`
 * avec son rang ; la suppression parcourt ce registre à l'envers, ce qui
 * satisfait les clés étrangères sans tri topologique.
 */
export const DEMO_DATASET: DemoDataset = {
  users: DEMO_USERS,
  representants: DEMO_REPRESENTANTS,
  prospects: DEMO_PROSPECTS,
  campaigns: DEMO_CAMPAIGNS,
  bankCases: DEMO_BANK_CASES,
};
