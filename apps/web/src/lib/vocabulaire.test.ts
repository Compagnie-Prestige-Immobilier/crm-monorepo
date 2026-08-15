import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * UN métier, UN mot. Ce test garde la décision, parce qu'elle dérive seule.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La même personne était appelée de trois façons sur UN SEUL écran : le bouton
 * disait « Nouveau commercial », la colonne « Téléconseiller », et le dialogue
 * s'intitulait « Nouveau téléconseiller ». Personne ne l'avait décidé ; c'est ce
 * que produisent trois correctifs successifs sans arbitre.
 *
 * La décision : « téléconseiller » dans TOUTE la copie visible, parce que c'est
 * ce que disent déjà `ROLE_LABELS`, la barre latérale et `nav-items.test.ts`.
 * « commercial » ne subsiste que dans les IDENTIFIANTS de code, où il vient du
 * contrat engendré (`commercialId`, `CampaignCommercialDto`, `perCommercial`) et
 * ne peut pas être renommé depuis le panel.
 *
 * Le test balaie donc les chaînes littérales du JSX et refuse les formes
 * visibles. Il ne peut pas distinguer parfaitement une chaîne rendue d'une
 * chaîne technique : les exceptions sont donc listées, nommément, ci-dessous.
 * Une liste courte qu'on doit allonger sciemment vaut mieux qu'un test absent.
 */

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Fichiers dont les chaînes ne sont PAS de la copie d'interface.
 *
 * `query-keys.ts` nomme des clés de cache, `user-filters.ts` des paramètres
 * d'URL héritant du contrat, et ce test cite lui-même les formes proscrites.
 */
const EXEMPT = new Set([
  'lib/query-keys.ts',
  'lib/user-filters.ts',
  'lib/data/inbox.ts',
  'components/layout/nav-items.ts',
]);

/** Formes VISIBLES du mot proscrit, avec leur casse et leurs accords. */
const FORBIDDEN = /\b(commercial|commerciale|commerciaux|commerciales)\b/iu;

/**
 * Tout ce qu'un fichier peut RENDRE : chaînes littérales et texte JSX.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Les deux, et pas seulement les chaînes.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La plus grande part de la copie française de ce panel n'est pas entre
 * guillemets : c'est du texte nu entre deux balises (`<Button>Nouveau
 * téléconseiller</Button>`). Une première version de ce test ne lisait que les
 * littéraux, et laissait donc passer précisément le défaut qui lui a donné
 * naissance. Le texte JSX est extrait par les segments compris entre `>` et `<`.
 *
 * Les commentaires sont volontairement HORS du champ : ils expliquent le code et
 * citent donc légitimement les identifiants du contrat. C'est ce que l'on REND
 * qui est en jeu.
 */
function renderable(source: string): string[] {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/(^|[^:])\/\/.*$/gmu, '$1');

  /*
    Les substitutions d'un gabarit et les expressions JSX sont RETIRÉES :
    `${commercial.progress}` et `{commerciaux.map(…)}` sont du code, pas de la
    copie, et les garder ferait échouer le test sur une chaîne irréprochable
    (« Programme PDF (… appels) »).
  */
  const strings = [...withoutComments.matchAll(/'([^'\\\n]*)'|"([^"\\\n]*)"|`([^`\\]*)`/gu)].map(
    (match) => (match[1] ?? match[2] ?? match[3] ?? '').replace(/\$\{[^}]*\}/gu, ''),
  );

  /*
    Le découpage `>…<` attrape aussi du CODE : une flèche `=>`, une comparaison,
    une clôture `) : (`. On ne garde donc que les segments qui ressemblent à de
    la prose, c'est-à-dire dépourvus des caractères qui ne s'écrivent pas dans
    une phrase française. Le filtre est volontairement strict : un faux négatif
    coûte une phrase non surveillée, un faux positif coûte un test qu'on
    désactive.
  */
  const jsxText = [...withoutComments.matchAll(/>([^<>{}]+)</gu)]
    .map((match) => match[1] ?? '')
    .filter((text) => !/[=;()[\]|&$/*+`_]/u.test(text) && /\p{L}/u.test(text));

  return [...strings, ...jsxText];
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, acc);
    } else if (/\.tsx?$/u.test(entry) && !/\.test\.tsx?$/u.test(entry)) {
      /*
        Les fichiers de test sont hors du champ : leurs intitulés nomment
        légitimement le RÔLE du contrat (« refuse un COMMERCIAL même
        authentifié »), qui est une valeur d'énumération et non de la copie.
      */
      acc.push(full);
    }
  }
  return acc;
}

describe('vocabulaire de l’interface', () => {
  it('ne dit jamais « commercial » là où l’utilisateur lit « téléconseiller »', () => {
    const offenders: string[] = [];

    for (const file of walk(SRC)) {
      const relative = path.relative(SRC, file).split(path.sep).join('/');
      if (EXEMPT.has(relative)) continue;

      for (const value of renderable(readFileSync(file, 'utf8'))) {
        /*
          Une chaîne d'interface porte au moins un espace ou un accent : les
          identifiants du contrat (`commercialId`, `top-commercials`) et les
          chemins (`/commerciaux`) n'en ont pas. Le filtre est grossier, et c'est
          voulu : il laisse passer les identifiants sans exiger qu'on les liste
          un par un, et rattrape toute phrase française.
        */
        if (!/\s/u.test(value)) continue;
        if (FORBIDDEN.test(value)) offenders.push(`${relative} : « ${value.trim()} »`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
