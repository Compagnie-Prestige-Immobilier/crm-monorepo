import { readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  DEMO_EXEMPTIONS,
  DEMO_EXEMPTIONS_SENTENCE,
} from '../decorators/demo-writable.decorator.js';

/**
 * Balayage des DISPENSES de lecture seule.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUE CE TEST EMPÊCHE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `demo-read-only.guard.test.ts` vérifie que les dispenses NÉCESSAIRES sont
 * bien là. Il ne peut rien dire des dispenses SUPERFLUES : une route qui
 * gagnerait `@DemoWritable` dans six mois, parce qu'un 409 gênait pendant une
 * recette, rouvrirait le trou que la garde a fermé, et aucun test existant ne
 * s'en apercevrait.
 *
 * Ce balayage-ci épingle la liste ENTIÈRE. Toute dispense ajoutée, retirée ou
 * dont le motif change fait rougir la suite, et oblige à écrire ici pourquoi
 * elle est légitime. C'est le seul mécanisme qui tienne dans la durée : une
 * dispense se justifie au moment où on l'ajoute, jamais après.
 */

const MODULES = new URL('../../modules', import.meta.url).pathname;

/**
 * LA LISTE COMPLÈTE DES DISPENSES, motif compris.
 *
 * Chaque entrée est `fichier:méthode-ou-classe → motif`. Une dispense de
 * CLASSE couvre toutes les routes du contrôleur ; c'est le bon niveau
 * uniquement quand aucune route du contrôleur n'écrit de donnée métier.
 */
const EXPECTED = [
  // Portée CLASSE. Aucune route n'écrit de donnée métier, et il FAUT pouvoir
  // se connecter pour éteindre le mode. Le renouvellement de jeton est en
  // prime ce dont dépend la synchronisation des téléphones déjà en vol.
  'auth/auth.controller.ts → ouvrir et fermer une session n’écrit aucune donnée métier',
  // LE PIÈGE MORTEL. Sans cette dispense, `POST /disable` serait refusé par le
  // mode qu'il éteint, et la plateforme resterait en lecture seule pour
  // toujours. Portée CLASSE : `purge` et `enable` doivent rester manœuvrables
  // eux aussi, et les trois sont déjà réservées à l'ADMIN.
  'demo/demo.controller.ts → sans quoi le mode démonstration ne pourrait plus être éteint',
  // Geste personnel, un horodatage sur la ligne de livraison de l'utilisateur
  // courant. Portée MÉTHODE : la création et l'annulation d'une campagne de
  // notification, sur le même contrôleur, restent bloquées.
  'notifications/notifications.controller.ts → acte personnel et inoffensif, sans effet sur les chiffres',
  // POST qui n'écrit rien : l'aperçu du compositeur est un calcul. La méthode
  // ne vaut POST que parce que la substitution prend un corps.
  'notifications/templates.controller.ts → aperçu calculé, aucune écriture malgré la méthode POST',
  // L'EXEMPTION ABSOLUE. La file hors ligne d'un commercial ne doit jamais
  // être refusée. Portée MÉTHODE, le pull étant un GET que la garde ignore
  // déjà.
  'sync/sync.controller.ts → la remontée hors ligne ne doit JAMAIS être refusée',
] as const;

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return walk(path);
      return entry.name.endsWith('.controller.ts') ? [path] : [];
    }),
  );
  return files.flat();
}

/** Toutes les dispenses posées dans les contrôleurs, motif compris. */
async function sweep(): Promise<{ sites: string[]; empty: string[] }> {
  const files = (await walk(MODULES)).sort();
  const sites: string[] = [];
  const empty: string[] = [];

  for (const file of files) {
    const relative = file.slice(MODULES.length).replace(/^\/+/, '');
    const source = await readFile(file, 'utf8');
    // Le motif est un littéral, pas une variable : une dispense doit se lire
    // entièrement à l'endroit où elle est posée.
    for (const match of source.matchAll(/@DemoWritable\(\s*'((?:[^'\\]|\\.)*)'\s*\)/g)) {
      const reason = match[1] ?? '';
      if (reason.trim() === '') empty.push(relative);
      sites.push(`${relative} → ${reason}`);
    }
  }

  return { sites: sites.sort(), empty };
}

describe('dispenses de lecture seule, balayage', () => {
  it('la liste des dispenses est EXACTEMENT celle qui a été justifiée', async () => {
    const { sites } = await sweep();

    expect(
      sites,
      'Une dispense a été ajoutée, retirée ou reformulée. Chacune rouvre le trou ' +
        'que DemoReadOnlyGuard ferme : justifiez-la dans EXPECTED, ou retirez-la.',
    ).toEqual([...EXPECTED]);
  });

  it('aucune dispense muette', async () => {
    const { empty } = await sweep();

    expect(
      empty,
      'Le motif est un PARAMÈTRE et non un commentaire, précisément pour qu’il ' +
        'ne puisse pas être omis. Une chaîne vide contourne l’intention.',
    ).toEqual([]);
  });

  /**
   * LA PROSE DU CONTRAT DIT-ELLE LA VÉRITÉ ?
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * CE QUI AVAIT DÉRIVÉ
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Trois descriptions OpenAPI énuméraient les dispenses à la main et en
   * annonçaient QUATRE quand le code en portait CINQ : l'aperçu d'un gabarit de
   * notification avait été dispensé sans que personne pense aux phrases.
   *
   * Ce n'était pas une coquille sans conséquence. Le panneau d'administration
   * construit sa confirmation à partir du contrat : un administrateur y lisait
   * que l'aperçu du compositeur était suspendu pendant une démonstration, et
   * évitait pendant sa présentation un écran qui marche.
   *
   * Le remède est en deux temps, et ce test tient le second : la prose est
   * composée à partir de `DEMO_EXEMPTIONS`, et cette table est ÉPINGLÉE sur les
   * motifs réellement posés dans les contrôleurs. Une dispense ajoutée sans son
   * libellé fait rougir ici, pas six mois plus tard devant un client.
   */
  it('la prose du contrat énumère EXACTEMENT les dispenses posées dans le code', async () => {
    const { sites } = await sweep();
    const reasonsPosees = sites.map((site) => site.split(' → ')[1] ?? '').sort();

    expect(
      DEMO_EXEMPTIONS.map((exemption) => exemption.reason).sort(),
      'DEMO_EXEMPTIONS ne décrit plus les dispenses réellement posées. C’est cette ' +
        'table qui compose les descriptions OpenAPI lues par le panneau : un écart ' +
        'ici fait mentir la confirmation affichée à l’administrateur.',
    ).toEqual(reasonsPosees);

    // Un libellé vide passerait le contrôle ci-dessus et produirait une phrase
    // amputée : la dispense disparaîtrait de l'écran sans disparaître du code.
    expect(DEMO_EXEMPTIONS.filter((exemption) => exemption.label.trim() === '')).toEqual([]);
  });

  /**
   * ET LA PROSE PUBLIÉE, PAS SEULEMENT CELLE DES SOURCES.
   *
   * Le document est ce que les générateurs consomment et ce que le panneau
   * affiche. Une description composée correctement mais jamais régénérée
   * laisserait le contrat mentir tout en gardant le code juste, ce qui est
   * précisément l'état qu'on vient de quitter.
   */
  it('les trois descriptions PUBLIÉES portent la liste complète', () => {
    const document = JSON.parse(
      readFileSync(new URL('../../../openapi.json', import.meta.url), 'utf8'),
    ) as {
      paths: Record<string, Record<string, { operationId?: string; description?: string }>>;
      components: {
        schemas: Record<string, { properties?: Record<string, { description?: string }> }>;
      };
    };

    const enable = Object.values(document.paths)
      .flatMap((item) => Object.values(item))
      .find((operation) => operation.operationId === 'enableDemoMode');

    const proses = [
      document.components.schemas.DemoStatusDto?.properties?.enabled?.description ?? '',
      document.components.schemas.ApiErrorDto?.properties?.code?.description ?? '',
      enable?.description ?? '',
    ];

    for (const prose of proses) {
      expect(prose, 'description absente du contrat publié').not.toBe('');
      expect(
        prose.includes(DEMO_EXEMPTIONS_SENTENCE),
        `Cette description n’énumère pas les dispenses : ${prose}`,
      ).toBe(true);
    }
  });

  /**
   * UNE GARDE NON ENREGISTRÉE NE GARDE RIEN.
   *
   * Tout le reste de ce dossier serait du code mort si le fournisseur global
   * disparaissait d'`app.module.ts`, et aucun test unitaire de la garde ne
   * l'apercevrait : ils l'instancient à la main.
   */
  it('la garde est enregistrée globalement, et APRÈS l’authentification', async () => {
    const source = await readFile(new URL('../../app.module.ts', import.meta.url).pathname, 'utf8');

    expect(source).toContain('{ provide: APP_GUARD, useClass: DemoReadOnlyGuard }');

    // L'ordre décide du code rendu à une requête mutante SANS jeton : 401 si
    // le JwtAuthGuard passe d'abord, 409 sinon. Répondre 409 à un anonyme
    // renseignerait sur l'état interne du serveur, et enverrait le client sur
    // la mauvaise piste.
    const roles = source.indexOf('useClass: RolesGuard');
    const readOnly = source.indexOf('useClass: DemoReadOnlyGuard');
    expect(roles).toBeGreaterThan(-1);
    expect(readOnly).toBeGreaterThan(roles);
  });
});
