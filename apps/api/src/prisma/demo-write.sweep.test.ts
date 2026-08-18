import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = new URL('..', import.meta.url).pathname;

type Verdict = 'SEMEUR' | 'BLOQUE' | 'REEL' | 'HERITE' | 'REGISTRE' | 'LECTURE' | 'RESIDU';

interface Site {
  verdict: Verdict;
  note: string;
}

const SITES: Record<string, Site> = {
  'modules/demo/demo-seeder.ts → true': {
    verdict: 'SEMEUR',
    note: 'chaque ligne créée ici est inscrite dans demo_entities par DemoRegistry, dans la MÊME transaction',
  },

  'modules/users/users.service.ts → await this.demo.enabledForWrite()': {
    verdict: 'BLOQUE',
    note: 'POST /v1/users, refusé en 409 pendant une démonstration',
  },
  'modules/representants/representants.service.ts → await this.demo.enabledForWrite()': {
    verdict: 'BLOQUE',
    note: 'POST /v1/representants, refusé en 409 pendant une démonstration',
  },
  'modules/notifications/templates.service.ts → await this.demo.enabledForWrite()': {
    verdict: 'BLOQUE',
    note: 'POST /v1/notification-templates, refusé en 409 ; seul /render est dispensé et n’écrit rien',
  },
  'modules/notifications/notifications.service.ts → isDemo (abrégé)': {
    verdict: 'BLOQUE',
    note:
      'POST /v1/notifications, refusé en 409 pendant une démonstration. Deux sites en forme ABRÉGÉE, ' +
      'la notification et ses livraisons, qui portent la même valeur : une livraison visible accrochée ' +
      'à une notification masquée afficherait une ligne vide dans la boîte de réception',
  },
  'modules/phase2/campaigns.service.ts → demoEnabled': {
    verdict: 'BLOQUE',
    note: 'POST /v1/phase2/campaigns, refusé en 409 pendant une démonstration',
  },
  'modules/rep-campaigns/rep-campaigns.service.ts → demoEnabled': {
    verdict: 'BLOQUE',
    note: 'POST /v1/rep-campaigns, refusé en 409 ; la valeur vient d’enabledForWrite, elle ne peut donc pas être devinée sur panne de lecture',
  },
  'modules/rep-campaigns/rep-campaigns.service.ts → demoPopulation': {
    verdict: 'LECTURE',
    note:
      'filtre de POPULATION d’eligibleWhere, pas une création. Le paramètre s’appelait demoEnabled comme la ' +
      'variable d’écriture deux cents lignes plus haut, ce qui rendait les deux usages indiscernables pour un ' +
      'lecteur comme pour le contrôle « aucune valeur écrite ne se décide sur enabled() »',
  },
  'modules/client-requests/client-requests.service.ts → demoEnabled': {
    verdict: 'BLOQUE',
    note: 'POST /v1/client-requests, refusé en 409 pendant une démonstration',
  },
  'modules/prospects/prospects.service.ts → (await this.demo.enabledForWrite()) || representant.isDemo':
    {
      verdict: 'BLOQUE',
      note: 'POST /v1/prospects, refusé en 409 ; le terme de gauche ne peut donc jamais valoir true, et celui de droite hérite du représentant',
    },

  'modules/phase2/phase2-sync.service.ts → prospect.isDemo': {
    verdict: 'RESIDU',
    note:
      'SEUL chemin d’écriture atteignable pendant une démonstration, via le push de synchronisation, qui est dispensé. ' +
      'L’annuaire de phase 2 n’est PAS cloisonné par commercial (choix assumé, un commercial doit pouvoir compléter n’importe quel numéro) : ' +
      'mode allumé, un commercial réel peut donc télécharger un prospect fictif et déposer une tentative dessus, qui naîtra isDemo: true ' +
      'sans figurer dans demo_entities. Elle reste RÉCUPÉRABLE, CallAttempt.prospect est en onDelete: Cascade et la purge supprime le prospect fictif. ' +
      'C’est ce qui distingue ce résidu du suivant.',
  },
  'modules/rep-campaigns/rep-campaigns.service.ts → representant.isDemo': {
    verdict: 'HERITE',
    note: 'POST /v1/rep-campaigns/attempts, refusé en 409 ; et mode éteint, demoScope écarte les fiches fictives, la fiche lue est donc réelle',
  },
  'modules/bank-cases/bank-cases.service.ts → prospect.isDemo': {
    verdict: 'HERITE',
    note: 'POST /v1/bank-cases, refusé en 409 ; le dossier suit le prospect qu’il instruit',
  },
  'modules/bank-cases/bank-cases.service.ts → existing.isDemo': {
    verdict: 'HERITE',
    note: 'transition d’étape, refusée en 409 ; la transition suit son dossier',
  },
  'modules/imports/imports.service.ts → false': {
    verdict: 'REEL',
    note: 'création du travail d’import ; le CRON échappe à la garde de lecture seule, la valeur est donc littérale',
  },
  'modules/imports/representants.adapter.ts → false': {
    verdict: 'REEL',
    note: 'les représentants importés sont réels par construction : le classeur vient du terrain',
  },
  'modules/imports/prospects-import.adapter.ts → false': {
    verdict: 'REEL',
    note: 'idem pour les prospects ; un import de démonstration passe par l’ensemenceur, jamais par ce chemin',
  },
  'modules/prospects/segment-change.service.ts → existing.isDemo': {
    verdict: 'HERITE',
    note:
      'PATCH /v1/prospects/:id/segment, refusé en 409 pendant une démonstration ; la trace de bascule suit ' +
      'la FICHE qu’elle décrit, et non le mode en vigueur à la seconde du clic. SegmentChange.prospect est ' +
      'en onDelete: Cascade : une trace née sur un prospect fictif part avec lui à la purge',
  },
  'modules/representants/relation-change.ts → change.isDemo': {
    verdict: 'HERITE',
    note:
      'SEUL site qui écrit une bascule de relation, pour ses deux appelants ; tous deux refusés en 409 ' +
      'pendant une démonstration. La trace suit la FICHE qu’elle décrit et non le mode en vigueur, et ' +
      'RepresentantRelationChange.representant est en onDelete: Cascade : une trace née sur un ' +
      'représentant fictif part avec lui à la purge',
  },
  'modules/representants/representants.service.ts → existing.isDemo': {
    verdict: 'HERITE',
    note: 'PATCH /v1/representants/:id, refusé en 409 ; la nature de la fiche relue est passée à applyRelationChange',
  },
  'modules/client-requests/client-requests.service.ts → request.isDemo': {
    verdict: 'HERITE',
    note: 'approbation d’une demande, refusée en 409 ; le prospect créé suit la demande',
  },

  'modules/notifications/reminders.service.ts → false': {
    verdict: 'REEL',
    note:
      'TÂCHE PLANIFIÉE, donc HORS de la garde, qui ne juge que des requêtes HTTP. Le balayage des rappels ne consulte plus l’interrupteur : ' +
      'il compte sous demoScope(false) et écrit isDemo: false sur la notification comme sur ses livraisons, mode allumé comme éteint. ' +
      'Deux raisons, et la seconde est la vraie : une relance porte du TRAVAIL DÛ À UNE VRAIE PERSONNE, l’écrire fictive la ferait disparaître ' +
      'de sa boîte à l’extinction sans que la purge sache la reprendre (ni Notification ni NotificationDelivery ne figurent dans ' +
      'DEMO_ENTITY_TYPES) ; et la clé d’idempotence (reminderKey, period) ne porte pas isDemo, si bien qu’une relance fictive occuperait la ' +
      'place du vrai rappel du jour. Écrire toujours false rend ce site incapable de produire une ligne fictive.',
  },

  'common/guards/fresh-session.guard.ts → true': {
    verdict: 'LECTURE',
    note:
      'clause `select` de la relecture d’autorité sur les routes à rôle : la garde LIT isDemo pour ' +
      'refuser une session de démonstration survivant à l’extinction du mode, et n’écrit rien. ' +
      'C’est le pendant, pour les jetons DÉJÀ émis, du refus d’émission d’AuthService',
  },
  'modules/representants/relation-change.ts → boolean;': {
    verdict: 'LECTURE',
    note: 'déclaration de type de RelationChange.isDemo',
  },
  'prisma/demo-visibility.ts → false': {
    verdict: 'LECTURE',
    note: 'le fragment `where` lui-même, celui que tout le reste compose',
  },

  'prisma/demo-visibility.ts → isDemo (SQL brut)': {
    verdict: 'LECTURE',
    note: 'demoScopeSql, le fragment `"isDemo" = FALSE` que les agrégats en SQL brut composent dans leur WHERE',
  },
  'modules/analytics/analytics.sql.ts → isDemo (SQL brut)': {
    verdict: 'LECTURE',
    note: 'conditions de cloisonnement des agrégats de prospection ; aucune de ces requêtes n’écrit',
  },
  'modules/analytics/pilotage.sql.ts → isDemo (SQL brut)': {
    verdict: 'LECTURE',
    note: 'conditions de cloisonnement des agrégats de pilotage',
  },
  'modules/bank-cases/bank-cases.sql.ts → isDemo (SQL brut)': {
    verdict: 'LECTURE',
    note: 'conditions de cloisonnement des agrégats de dossiers bancaires',
  },
  'modules/prospects/prospects.service.ts → true': {
    verdict: 'LECTURE',
    note: 'projection : `select: { isDemo: true }` RAPPORTE la colonne, il ne l’écrit pas',
  },
  'modules/prospects/prospects.service.ts → boolean': {
    verdict: 'LECTURE',
    note: 'déclaration de type du retour',
  },
  'modules/phase2/phase2-sync.service.ts → true': {
    verdict: 'LECTURE',
    note: 'projection dans PROSPECT_STATE_SELECT',
  },
  'modules/phase2/phase2-sync.service.ts → boolean;': {
    verdict: 'LECTURE',
    note: 'déclaration de type de ProspectState',
  },
  'modules/rep-campaigns/rep-campaigns.service.ts → true': {
    verdict: 'LECTURE',
    note: 'projection sur la fiche appelée, lue pour l’écriture de la tentative',
  },
  'modules/bank-cases/bank-cases.service.ts → true': {
    verdict: 'LECTURE',
    note: 'projection sur le prospect instruit',
  },
  'modules/sync/sync.service.ts → authorIsDemo': {
    verdict: 'REGISTRE',
    note:
      'création d’un représentant par la synchronisation, DISPENSÉE de la garde. La fiche suit la nature de son ' +
      'AUTEUR : l’animateur d’une démonstration saisit sur le téléphone avec un compte de démonstration, et la ' +
      'colonne prenait auparavant son défaut false, ce qui faisait entrer la fiche fictive dans l’annuaire réel. ' +
      'Inscrite au registre par recordDemoEntity, dans la transaction du groupe',
  },
  'modules/sync/sync.service.ts → authorIsDemo || parent.isDemo': {
    verdict: 'REGISTRE',
    note:
      'création d’un prospect par la synchronisation. MÊME COMPOSITION que prospects.service.ts, auteur ET ' +
      'représentant de rattachement : l’annuaire de phase 2 n’est pas cloisonné par commercial, aucune des deux ' +
      'sources ne suffit seule. Inscrite au registre',
  },
  'modules/sync/sync.service.ts → representant.isDemo': {
    verdict: 'LECTURE',
    note: 'valeur RENDUE par assertRepresentantUsable à son appelant, qui décide ; aucune écriture ici',
  },
  'modules/sync/sync.service.ts → true': {
    verdict: 'LECTURE',
    note: 'projections : select isDemo sur l’auteur et sur le représentant de rattachement',
  },
  'modules/sync/sync.service.ts → boolean': {
    verdict: 'LECTURE',
    note: 'déclarations de type du retour d’assertRepresentantUsable et des passages d’authorIsDemo',
  },
  'modules/sync/sync.service.ts → boolean;': {
    verdict: 'LECTURE',
    note: 'déclaration de type de BatchAuthority.isDemo, la nature de l’auteur lue une fois par lot',
  },
  'modules/sync/sync.service.ts → author?.isDemo ?? false': {
    verdict: 'LECTURE',
    note:
      'readAuthority : RECOPIE la nature de l’auteur telle qu’elle est en base, elle ne la décide ' +
      'pas. Le repli `false` vaut pour un auteur introuvable, cas où l’ancien isDemoAuthor rendait ' +
      'déjà false, et il va dans le sens du réel : une ligne écrite réelle reste exportable et ' +
      'supprimable, l’inverse serait indestructible',
  },
  'modules/auth/auth.service.ts → boolean': {
    verdict: 'LECTURE',
    note:
      'déclaration de type du paramètre d’assertDemoSessionAllowed : la connexion LIT le drapeau ' +
      'pour refuser une session de démonstration hors démonstration, elle n’écrit rien',
  },
};

const isTestDouble = (relative: string): boolean =>
  relative.split('/').some((segment) => segment.startsWith('fake-'));

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return walk(path);
      return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
    }),
  );
  return files.flat();
}

const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const codeOnly = (source: string): string =>
  withoutComments(source)
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');

function sitesIn(source: string): string[] {
  const found: string[] = [];

  const text = withoutComments(source);
  const code = codeOnly(source);

  for (const match of code.matchAll(/\bisDemo:\s*([^,\n}]+)/g)) {
    found.push((match[1] ?? '').trim());
  }

  if (/\[\s*['"`]isDemo['"`]\s*\]\s*:/.test(text)) found.push('isDemo (clé calculée)');

  if (/"isDemo"/.test(text)) found.push('isDemo (SQL brut)');

  if (/(?<![.\w])isDemo\s*(?=[,}])/.test(code)) found.push('isDemo (abrégé)');

  return found;
}

async function sweep(): Promise<string[]> {
  const files = (await walk(SRC)).sort();
  const sites = new Set<string>();

  for (const file of files) {
    const relative = file.slice(SRC.length).replace(/^\/+/, '');
    if (isTestDouble(relative)) continue;

    for (const site of sitesIn(await readFile(file, 'utf8'))) {
      sites.add(`${relative} → ${site}`);
    }
  }

  return [...sites].sort();
}

describe('écritures d’isDemo, balayage', () => {
  it('tout site posant isDemo est CLASSÉ', async () => {
    const sites = await sweep();
    const inconnus = sites.filter((site) => !(site in SITES));

    expect(
      inconnus,
      'Ces sites posent `isDemo` sans être classés. Un `isDemo` qui peut valoir ' +
        '`true` hors ensemenceur crée une ligne que la purge ne sait pas reprendre : ' +
        'elle devient invisible, inexportable et indestructible. Classez chaque site ' +
        'dans SITES, avec la raison pour laquelle il ne peut pas produire ça.',
    ).toEqual([]);
  });

  it('et aucune classification ne survit au site qu’elle décrivait', async () => {
    const sites = new Set(await sweep());
    const orphelines = Object.keys(SITES).filter((site) => !sites.has(site));

    expect(orphelines).toEqual([]);
  });

  it('le résidu connu est EXACTEMENT celui-là', () => {
    const residus = Object.entries(SITES)
      .filter(([, site]) => site.verdict === 'RESIDU')
      .map(([site]) => site)
      .sort();

    expect(residus).toEqual(['modules/phase2/phase2-sync.service.ts → prospect.isDemo']);
  });

  it('AUCUNE valeur écrite dans isDemo ne se décide sur `enabled()`', async () => {
    const coupables: string[] = [];
    const files = (await walk(SRC)).sort();

    for (const file of files) {
      const relative = file.slice(SRC.length).replace(/^\/+/, '');
      if (isTestDouble(relative)) continue;

      const code = codeOnly(await readFile(file, 'utf8'));
      for (const match of code.matchAll(/\bisDemo:\s*([^,\n}]+)/g)) {
        const expression = (match[1] ?? '').trim();

        if (expression.includes('this.demo.enabled()')) {
          coupables.push(`${relative} → ${expression}`);
          continue;
        }

        if (!/^[A-Za-z_$][\w$]*$/.test(expression)) continue;

        const before = code.slice(0, match.index);
        const declarations = [
          ...before.matchAll(
            new RegExp(
              String.raw`(?:const|let)\s+${expression}\s*=\s*await\s+this\.demo\.(enabled|enabledForWrite)\(\)`,
              'g',
            ),
          ),
        ];
        if (declarations.at(-1)?.[1] === 'enabled') {
          coupables.push(`${relative} → ${expression} (indirect)`);
        }
      }
    }

    expect(
      coupables,
      'Ces sites ÉCRIVENT une valeur décidée par `enabled()`, qui rend `false` quand la ' +
        'lecture du réglage échoue : la ligne serait enregistrée comme RÉELLE alors que ' +
        'personne ne sait si elle l’est. Utilisez `enabledForWrite()`, qui refuse dans le ' +
        'doute. `enabled()` reste le bon appel pour une décision de VISIBILITÉ.',
    ).toEqual([]);
  });

  it('ce que le relevé VOIT', () => {
    expect(sitesIn('data: { isDemo: true }')).toEqual(['true']);
    expect(sitesIn('data: { isDemo }')).toEqual(['isDemo (abrégé)']);
    expect(sitesIn("data: { ['isDemo']: true }")).toEqual(['isDemo (clé calculée)']);
    expect(sitesIn('await tx.$executeRaw`UPDATE p SET "isDemo" = TRUE`')).toEqual([
      'isDemo (SQL brut)',
    ]);
  });

  it('et ce qu’il NE VOIT PAS, ce qui est la moitié qui compte', () => {
    expect(sitesIn('const champ = "isDemo"; data = { [champ]: true };')).not.toContain(
      'isDemo (clé calculée)',
    );

    expect(sitesIn('tx.prospect.create({ data: { nom, phoneE164 } })')).toEqual([]);

    expect(sitesIn('WHERE "isDemo" = FALSE')).toEqual(sitesIn('SET "isDemo" = TRUE'));
  });

  it('le verdict BLOQUE repose sur une garde réellement enregistrée', async () => {
    const source = await readFile(new URL('../app.module.ts', import.meta.url).pathname, 'utf8');
    expect(source).toContain('{ provide: APP_GUARD, useClass: DemoReadOnlyGuard }');
  });
});
