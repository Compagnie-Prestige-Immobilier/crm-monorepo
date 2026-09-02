import { screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { GrandPublicProspectDetail } from '@/components/grand-public/prospect-detail';
import type { ProspectRow } from '@/lib/types';
import { prospectFixture } from '@/test/prospect-fixture';
import { renderWithQuery } from '@/test/render-query';

const fiche = (over: Partial<ProspectRow> = {}): ProspectRow => {
  const projet = over.projet ?? 'GRAND_PUBLIC';
  return prospectFixture({
    id: 'p-1',
    nom: 'Fall',
    prenom: 'Moussa',
    projet: 'GRAND_PUBLIC',
    journeys:
      projet === 'GRAND_PUBLIC'
        ? [
            {
              id: 'journey-gp',
              projet,
              statut: over.statut ?? 'NOUVEAU',
              consent: 'NON_DEMANDE',
              consentAt: null,
              convertedAt: null,
            },
          ]
        : [],
    banqueId: null,
    banqueName: null,
    syndicatId: null,
    syndicatSigle: null,
    representantId: null,
    representantName: null,
    segment: null,
    ownedByCommercialName: 'Alice Diop',
    clientCreatedAt: '2026-08-14T09:00:00.000Z',
    ...over,
  });
};

/** La valeur portée par la ligne dont l'intitulé est `label`. */
function ligne(label: string): HTMLElement {
  const dt = screen.getByText(label);
  const row = dt.parentElement;
  if (row === null) throw new Error(`Ligne « ${label} » introuvable.`);
  return row;
}

const render = (ui: ReactElement) => renderWithQuery(ui);

describe('le segment absent', () => {
  it('écrit « Aucun » et jamais BDD4', () => {
    render(<GrandPublicProspectDetail prospect={fiche()} />);

    expect(within(ligne('Segment')).getByText('Aucun')).toBeTruthy();
    expect(screen.queryByText(/BDD4/u)).toBeNull();
  });

  it('dit que ni banque ni syndicat ne sont connus', () => {
    render(<GrandPublicProspectDetail prospect={fiche()} />);

    expect(
      within(ligne('Segment')).getByText(
        'Ni banque ni syndicat : la fiche n’entre dans aucune base.',
      ),
    ).toBeTruthy();
  });

  it('nomme la seule pièce qui manque quand l’autre est là', () => {
    render(
      <GrandPublicProspectDetail
        prospect={fiche({ syndicatId: 'snd-1', syndicatSigle: 'SAES' })}
      />,
    );

    expect(within(ligne('Segment')).getByText('La banque manque pour le calculer.')).toBeTruthy();
  });

  it('nomme le syndicat manquant quand la banque est connue', () => {
    render(
      <GrandPublicProspectDetail
        prospect={fiche({ banqueId: 'bnq-1', banqueName: 'CBAO Sénégal' })}
      />,
    );

    expect(within(ligne('Segment')).getByText('Le syndicat manque pour le calculer.')).toBeTruthy();
  });

  it('affiche le segment en toutes lettres quand il est calculé', () => {
    render(
      <GrandPublicProspectDetail
        prospect={fiche({
          banqueId: 'bnq-1',
          banqueName: 'CBAO Sénégal',
          syndicatId: 'snd-1',
          syndicatSigle: 'SAES',
          segment: 'BDD3',
        })}
      />,
    );

    expect(within(ligne('Segment')).getByText('BDD3 : autre syndicat / CBAO')).toBeTruthy();
    expect(screen.queryByText('Aucun')).toBeNull();
  });
});

describe('les autres absences', () => {
  it('distingue le représentant qu’une fiche Grand Public n’a pas', () => {
    render(<GrandPublicProspectDetail prospect={fiche()} />);

    expect(within(ligne('Représentant')).getByText('Sans représentant')).toBeTruthy();
  });

  it('nomme la question non posée plutôt que de poser un tiret', () => {
    render(<GrandPublicProspectDetail prospect={fiche()} />);

    expect(within(ligne('Situation')).getByText('Question non posée')).toBeTruthy();
    expect(within(ligne('Profession')).getByText('Non renseignée')).toBeTruthy();
    expect(within(ligne('Canal de provenance')).getByText('Non renseigné')).toBeTruthy();
    expect(within(ligne('Durée du système')).getByText('Non renseignée')).toBeTruthy();
    expect(within(ligne('Banque de domiciliation')).getByText('Non renseignée')).toBeTruthy();
    expect(within(ligne('Dernier appel')).getByText('Jamais appelé')).toBeTruthy();
    expect(screen.queryByText('–')).toBeNull();
  });

  it('rend la valeur dès qu’elle existe', () => {
    render(
      <GrandPublicProspectDetail
        prospect={fiche({
          type: 'DIASPORA',
          profession: 'Chauffeur',
          canalProvenanceLabel: 'TikTok',
          dureeSystemeMois: 36,
        })}
      />,
    );

    expect(within(ligne('Situation')).getByText('Diaspora')).toBeTruthy();
    expect(within(ligne('Profession')).getByText('Chauffeur')).toBeTruthy();
    expect(within(ligne('Canal de provenance')).getByText('TikTok')).toBeTruthy();
    expect(within(ligne('Durée du système')).getByText('3 ans (36 mois)')).toBeTruthy();
  });

  it('appelle le prospect d’un geste', () => {
    render(<GrandPublicProspectDetail prospect={fiche()} />);

    expect(screen.getByRole('link', { name: /77 123 45 67/u }).getAttribute('href')).toBe(
      'tel:+221771234567',
    );
  });
});

describe('les renseignements propres à la situation', () => {
  it('n’écrit aucune ligne pour ce qui n’a pas été demandé', () => {
    render(<GrandPublicProspectDetail prospect={fiche({ type: 'INFORMEL' })} />);

    const presentes = [
      'Employeur',
      'Type de contrat',
      'Ancienneté',
      'Lieu d’activité',
      'Mode d’épargne',
      'Pays de résidence',
      'WhatsApp',
      'Personne relais',
    ].filter((label) => screen.queryByText(label) !== null);

    expect(presentes).toEqual([]);
  });

  it('nomme l’activité plutôt que la profession pour un informel', () => {
    render(
      <GrandPublicProspectDetail
        prospect={fiche({
          type: 'INFORMEL',
          profession: 'Couturier',
          lieuActivite: 'Marché Sandaga',
          modeEpargne: 'TONTINE',
        })}
      />,
    );

    expect(within(ligne('Activité')).getByText('Couturier')).toBeTruthy();
    expect(screen.queryByText('Profession')).toBeNull();
    expect(within(ligne('Lieu d’activité')).getByText('Marché Sandaga')).toBeTruthy();
    expect(within(ligne('Mode d’épargne')).getByText('Tontine')).toBeTruthy();
  });

  it('traduit le contrat et compte l’ancienneté en années', () => {
    render(
      <GrandPublicProspectDetail
        prospect={fiche({
          type: 'SECTEUR_PRIVE',
          employeur: 'Sonatel',
          typeContrat: 'CDD',
          ancienneteMois: 30,
        })}
      />,
    );

    expect(within(ligne('Employeur')).getByText('Sonatel')).toBeTruthy();
    expect(within(ligne('Type de contrat')).getByText('CDD')).toBeTruthy();
    expect(within(ligne('Ancienneté')).getByText('2 ans et 6 mois')).toBeTruthy();
  });

  it('affiche la résidence, le WhatsApp et le relais d’un prospect de la diaspora', () => {
    render(
      <GrandPublicProspectDetail
        prospect={fiche({
          type: 'DIASPORA',
          paysResidenceLabel: 'Italie',
          villeResidence: 'Turin',
          whatsappE164: '+393331234567',
          relaisNom: 'Awa Fall',
          relaisPhoneE164: '+221775554433',
        })}
      />,
    );

    expect(within(ligne('Pays de résidence')).getByText('Italie')).toBeTruthy();
    expect(within(ligne('Ville de résidence')).getByText('Turin')).toBeTruthy();
    expect(within(ligne('Personne relais')).getByText('Awa Fall')).toBeTruthy();
    expect(ligne('WhatsApp').textContent).toContain('393331234567');
  });
});

describe('une fiche de l’autre projet', () => {
  it('la refuse au lieu de la rendre dans la coque Grand Public', () => {
    render(<GrandPublicProspectDetail prospect={fiche({ projet: 'CHUES' })} />);

    expect(screen.getByText('Cette fiche relève du projet CHUES')).toBeTruthy();
    expect(screen.queryByText('Moussa Fall')).toBeNull();
    expect(screen.queryByText('Segment')).toBeNull();
  });

  it('renvoie vers le suivi CHUES', () => {
    render(<GrandPublicProspectDetail prospect={fiche({ projet: 'CHUES' })} />);

    expect(screen.getByRole('link', { name: 'Ouvrir le suivi CHUES' }).getAttribute('href')).toBe(
      '/chues/prospects',
    );
  });
});
