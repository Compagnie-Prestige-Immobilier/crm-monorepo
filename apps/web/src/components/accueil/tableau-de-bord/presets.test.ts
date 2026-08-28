import { describe, expect, it } from 'vitest';

import { marquesCompatibles } from '@/components/accueil/tableau-de-bord/recommandation';
import { PRESETS } from '@/components/accueil/tableau-de-bord/presets';
import { SOURCES, type Forme } from '@/components/accueil/tableau-de-bord/sources';

const SOURCE_IDS = Object.keys(SOURCES).sort();

describe('les préréglages', () => {
  it('ne nomment que des sources existantes, avec une marque compatible', () => {
    for (const [preset, widgets] of Object.entries(PRESETS)) {
      for (const widget of widgets) {
        expect(SOURCE_IDS, `${preset} : source « ${widget.source} » inconnue`).toContain(
          widget.source,
        );
        const compatibles = marquesCompatibles(SOURCES[widget.source].forme as Forme);
        expect(
          compatibles,
          `${preset} : « ${widget.marque} » n’est pas compatible avec ${widget.source}`,
        ).toContain(widget.marque);
      }
    }
  });

  it('« Tout » contient toutes les sources du registre', () => {
    const sourcesDeComplet = PRESETS.complet.map((widget) => widget.source).sort();
    expect(sourcesDeComplet).toEqual(SOURCE_IDS);
  });
});

// La liste que le schéma engendré déclare pour `DashboardSource`. `SOURCES`
// est typé `Record<DashboardSource, …>` : une source ajoutée côté API sans
// entrée ici est déjà une erreur de compilation ; ce test protège la valeur
// à l’exécution, catalogue contre schéma.
const SOURCES_DU_SCHEMA = [
  'avec-telephone',
  'jour-le-plus-charge',
  'moyenne-journaliere',
  'par-agent',
  'par-destinataire',
  'par-destinataire-direction',
  'par-direction',
  'par-entreprise',
  'par-entreprise-objet',
  'par-heure',
  'par-heure-jour-semaine',
  'par-jour',
  'par-jour-semaine',
  'par-mois',
  'par-objet',
  'par-objet-mois',
  'qualite-de-saisie',
  'total-visites',
  'visiteurs-recurrents',
].sort();

describe('contrat de sources', () => {
  it('le registre des sources égale la liste du schéma engendré', () => {
    expect(SOURCE_IDS).toEqual(SOURCES_DU_SCHEMA);
  });
});
