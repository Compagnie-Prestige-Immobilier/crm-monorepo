import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Balayage — aucun service de lecture ne doit oublier la visibilité de démo.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI UN TEST DE BALAYAGE ET PAS UN TEST PAR SERVICE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un test par service vérifie les services qui EXISTENT. Le défaut redouté est
 * l'inverse : le service écrit dans six mois, par quelqu'un qui n'aura pas lu
 * `demo-visibility.ts`, et dont la requête ressortira des fiches fictives dans
 * un export transmis au siège. Aucun test existant ne se met au rouge pour un
 * fichier qui n'existait pas quand il a été écrit.
 *
 * Ce test-ci parcourt l'arborescence. Un fichier ajouté demain y entre sans que
 * personne ait à y penser, et c'est tout son intérêt.
 *
 * La règle vérifiée : tout service qui lit un modèle porteur d'`isDemo` doit
 * mentionner la visibilité, d'une des trois manières admises — `demoScope`,
 * `demoScopeSql`, ou `isDemo` posé à la main dans un `where`.
 */

const SRC = new URL('..', import.meta.url).pathname;

/** Modèles porteurs d'une colonne `isDemo` dans le schéma Prisma. */
const DEMO_MODELS = [
  'user',
  'prospect',
  'representant',
  'bankCase',
  'callCampaign',
  'callTask',
  'callAttempt',
  'bankCaseTransition',
] as const;

/**
 * Fichiers dispensés, chacun pour une raison NOMMÉE.
 *
 * La liste est volontairement courte et commentée ligne à ligne : une dispense
 * sans motif est une régression qui a trouvé où se cacher.
 */
const EXEMPT = new Map<string, string>([
  // Le module démonstration DOIT voir ses propres lignes pour les compter et
  // les purger. C'est le seul endroit où ignorer le filtre est le but.
  ['modules/demo/demo.service.ts', 'ensemence, compte et purge le jeu de démonstration'],
  ['modules/demo/demo-seeder.ts', 'écrit le jeu de démonstration'],
  ['modules/demo/demo-registry.ts', 'registre des identifiants créés'],
  // Doubles d'essai : aucune requête réelle.
  ['modules/sync/fake-prisma.ts', 'double d’essai'],
  ['modules/bank-cases/fake-prisma.ts', 'double d’essai'],
  ['prisma/fake-demo-visibility.ts', 'double d’essai'],
  // Écritures pures : `create`, `update` et `delete` ne présentent rien à
  // l'écran. La visibilité est une règle de LECTURE.
  ['modules/sync/batch-store.ts', 'idempotence des lots, aucune lecture métier'],
  ['modules/prospects/last-attempt.ts', 'projection d’une ligne déjà filtrée par l’appelant'],

  // La purge administrative doit compter TOUT ce qu'elle s'apprête à effacer.
  // Filtrée, elle annoncerait « 120 prospects » puis en supprimerait 240 — le
  // seul écran où un chiffre partiel serait plus dangereux qu'aucun chiffre.
  ['modules/admin/purge-steps.ts', 'compte l’intégralité des lignes avant effacement'],
  ['modules/admin/purge.service.ts', 'orchestre l’effacement, même portée que ses étapes'],

  // Garde-fou avant de désactiver une étape bancaire : il compte les dossiers
  // qui y stationnent. Un dossier de démonstration masqué reste un dossier
  // ACCROCHÉ à l'étape ; l'ignorer désactiverait une étape encore occupée et
  // laisserait la ligne orpheline le jour où le mode se rallume.
  ['modules/bank-cases/bank-case-stages.service.ts', 'garde-fou d’intégrité, compte tout'],

  // Chemin d'ÉCRITURE de la synchronisation mobile : il résout une fiche par
  // son identifiant, déjà cloisonné en amont. Y poser le filtre ferait
  // répondre « introuvable » à un appareil qui détient bien la ligne, et la
  // file de synchronisation se bloquerait sur une erreur inexplicable.
  ['modules/phase2/phase2-sync.service.ts', 'chemin d’écriture, résolution par identifiant'],

  // L'authentification doit trouver le compte pour vérifier le mot de passe,
  // mode de démonstration éteint ou non. Le refus se joue sur `isActive`, qui
  // est la vraie porte ; masquer le compte ici rendrait une erreur de
  // connexion indiscernable d'un compte inexistant.
  ['modules/auth/auth.service.ts', 'résolution du compte à la connexion'],
]);

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.name.endsWith('.ts') && !entry.name.includes('.test.') ? [full] : [];
    }),
  );
  return files.flat();
}

/** `true` si le fichier interroge un modèle porteur d'`isDemo`. */
function readsDemoModel(source: string): boolean {
  const methods = ['findMany', 'findFirst', 'findUnique', 'count', 'aggregate', 'groupBy'];
  return DEMO_MODELS.some((model) =>
    methods.some((method) => source.includes(`.${model}.${method}(`)),
  );
}

/** `true` si le fichier écrit du SQL brut sur une table porteuse d'`isDemo`. */
function readsDemoTableInSql(source: string): boolean {
  return /FROM "(prospects|representants|bank_cases|call_campaigns|call_tasks)"/.test(source);
}

function mentionsVisibility(source: string): boolean {
  return (
    source.includes('demoScope') ||
    source.includes('demoScopeSql') ||
    source.includes('isDemo') ||
    // Le fichier délègue à un constructeur de clause déjà couvert par ce test.
    source.includes('buildProspectWhere') ||
    source.includes('prospectConditions') ||
    source.includes('bankCaseConditions') ||
    source.includes('this.demo.enabled()')
  );
}

describe('visibilité de démonstration — balayage', () => {
  it('aucun service de lecture n’omet le filtre', async () => {
    const files = await walk(SRC);
    const coupables: string[] = [];

    for (const file of files) {
      const relative = file.slice(SRC.length).replace(/^\/+/, '');
      if (EXEMPT.has(relative)) continue;

      const source = await readFile(file, 'utf8');
      if (!readsDemoModel(source) && !readsDemoTableInSql(source)) continue;
      if (mentionsVisibility(source)) continue;

      coupables.push(relative);
    }

    expect(
      coupables,
      `Ces fichiers lisent un modèle porteur d’isDemo sans jamais mentionner la ` +
        `visibilité de démonstration. Composez demoScope(await this.demo.enabled()) ` +
        `dans le where — ou, si la lecture doit délibérément tout voir, ajoutez le ` +
        `fichier à EXEMPT avec son motif.\n  ${coupables.join('\n  ')}`,
    ).toEqual([]);
  });

  it('chaque dispense porte un motif', () => {
    for (const [file, motif] of EXEMPT) {
      expect(motif.length, `dispense sans motif : ${file}`).toBeGreaterThan(10);
    }
  });
});
