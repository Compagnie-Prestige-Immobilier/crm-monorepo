import { ApiError } from '@crm/api-client/query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MOIS_LABELS,
  bornes,
  evolution,
  fetchVisitesStats,
  moisPrecedent,
  nonRenseigne,
  partDe,
  periodeLabel,
  serieJournaliere,
  serieMensuelle,
  visitesCsv,
  visitesCsvFileName,
  type VisitesStats,
} from '@/lib/data/visites-stats';

const vide: VisitesStats = {
  from: '2026-02-01',
  to: '2026-02-28',
  total: 0,
  parEntreprise: [],
  parDirection: [],
  parDestinataire: [],
  parObjet: [],
  parMois: [],
  parJour: [],
  sansDirection: 0,
  sansDestinataire: 0,
};

const reponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('les bornes de la periode', () => {
  it('couvre le mois entier, dernier jour compris', () => {
    expect(bornes({ annee: 2026, mois: 2 })).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(bornes({ annee: 2024, mois: 2 })).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(bornes({ annee: 2026, mois: 12 })).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('couvre l’annee entiere pour le cumul', () => {
    expect(bornes({ annee: 2025, mois: null })).toEqual({ from: '2025-01-01', to: '2025-12-31' });
  });
});

describe('le libelle de la periode', () => {
  it('nomme le mois puis l’annee', () => {
    expect(periodeLabel({ annee: 2026, mois: 3 })).toBe('mars 2026');
  });

  it('nomme le cumul annuel', () => {
    expect(periodeLabel({ annee: 2025, mois: null })).toBe('année 2025');
  });
});

describe('le mois precedent', () => {
  it('remonte au mois d’avant', () => {
    expect(moisPrecedent({ annee: 2026, mois: 3 })).toEqual({ annee: 2026, mois: 2 });
  });

  it('bascule sur decembre de l’annee precedente', () => {
    expect(moisPrecedent({ annee: 2026, mois: 1 })).toEqual({ annee: 2025, mois: 12 });
  });

  it('n’existe pas pour un cumul annuel', () => {
    expect(moisPrecedent({ annee: 2026, mois: null })).toBeNull();
  });
});

describe('la serie des jours du mois', () => {
  it('rend un fevrier bissextile entier, chaque jour a zero', () => {
    const jours = serieJournaliere(2024, 2, []);

    expect(jours).toHaveLength(29);
    expect(jours[0]).toEqual({ jour: 1, total: 0 });
    expect(jours[28]).toEqual({ jour: 29, total: 0 });
  });

  it('place chaque releve sur son jour et laisse les autres a zero', () => {
    const jours = serieJournaliere(2026, 1, [
      { date: '2026-01-15', count: 6 },
      { date: '2026-01-06', count: 3 },
    ]);

    expect(jours).toHaveLength(31);
    expect(jours[5]).toEqual({ jour: 6, total: 3 });
    expect(jours[14]).toEqual({ jour: 15, total: 6 });
    expect(jours[0]).toEqual({ jour: 1, total: 0 });
  });

  it('ignore un jour d’un autre mois plutot que de le compter ici', () => {
    const jours = serieJournaliere(2026, 2, [{ date: '2026-03-01', count: 9 }]);

    expect(jours).toHaveLength(28);
    expect(jours.reduce((sum, point) => sum + point.total, 0)).toBe(0);
  });
});

describe('la serie des douze mois', () => {
  it('complete une annee sans releve par douze zeros', () => {
    const mois = serieMensuelle(2026, []);

    expect(mois).toHaveLength(12);
    expect(mois[0]).toEqual({ mois: 1, label: MOIS_LABELS[0], total: 0 });
    expect(mois[11]).toEqual({ mois: 12, label: MOIS_LABELS[11], total: 0 });
  });

  it('reprend les releves du classeur dans l’ordre des mois', () => {
    const mois = serieMensuelle(2025, [
      { month: '2025-06', count: 143 },
      { month: '2025-01', count: 36 },
    ]);

    expect(mois[0]?.total).toBe(36);
    expect(mois[5]?.total).toBe(143);
    expect(mois[6]?.total).toBe(0);
  });

  it('ignore un mois d’une autre annee', () => {
    expect(serieMensuelle(2026, [{ month: '2025-06', count: 143 }])[5]?.total).toBe(0);
  });
});

describe('l’ecart avec le mois precedent', () => {
  it('rapporte la hausse en pourcentage', () => {
    expect(evolution(50, 40)).toBe(25);
  });

  it('rend une baisse negative', () => {
    expect(evolution(38, 76)).toBe(-50);
  });

  it('ne rend rien quand le mois precedent est a zero, faute de denominateur', () => {
    expect(evolution(50, 0)).toBeNull();
  });
});

describe('la part dans un total', () => {
  it('rend le pourcentage a une decimale', () => {
    expect(partDe(35, 36)).toBe(97.2);
  });

  it('ne rend rien sans denominateur, plutot que zero pour cent', () => {
    expect(partDe(0, 0)).toBeNull();
  });
});

describe('les visites hors repartition', () => {
  const axe = [
    { id: 'e1', code: 'CPI', label: 'CPI', count: 700 },
    { id: 'e2', code: 'SANTARGILE', label: 'SANTARGILE', count: 21 },
  ];

  it('rend l’ecart entre le total et la somme de la repartition', () => {
    expect(nonRenseigne(765, axe)).toBe(44);
  });

  it('rend zero quand la repartition couvre tout le total', () => {
    expect(nonRenseigne(721, axe)).toBe(0);
  });

  it('ne rend jamais un ecart negatif', () => {
    expect(nonRenseigne(10, axe)).toBe(0);
  });
});

describe('l’export de la periode', () => {
  const mars: VisitesStats = {
    from: '2026-03-01',
    to: '2026-03-31',
    total: 41,
    parEntreprise: [
      { id: 'e1', code: 'CPI', label: 'CPI', count: 39 },
      { id: 'e2', code: 'SANTARGILE', label: 'SANTARGILE', count: 2 },
    ],
    parDirection: [{ id: 'd1', code: 'DIR', label: 'DIRECTION; ETAGE', count: 23 }],
    parDestinataire: [{ id: 'p1', code: 'NDOYE', label: 'MME. NDOYE (RESP. COMM.)', count: 20 }],
    parObjet: [{ id: 'o1', code: 'ACHAT', label: 'ACHAT TERRAIN', count: 2 }],
    parMois: [{ month: '2026-03', count: 41 }],
    parJour: [{ date: '2026-03-02', count: 41 }],
    sansDirection: 18,
    sansDestinataire: 0,
  };

  const periode = { annee: 2026, mois: 3 } as const;

  it('reprend les quatre blocs du classeur et le total', () => {
    const csv = visitesCsv(mars, periode);

    expect(csv.split('\r\n')[0]).toBe('Visites de mars 2026');
    expect(csv).toContain('Entreprise;Visites;Part');
    expect(csv).toContain('CPI;39;95,1');
    expect(csv).toContain('Destinataire;Visites;Part');
    expect(csv).toContain('Direction;Visites;Part');
    expect(csv).toContain('Objet de la visite;Visites;Part');
    expect(csv).toContain('Total;41');
  });

  it('avoue les visites sans direction, que la repartition ne compte pas', () => {
    expect(visitesCsv(mars, periode)).toContain('Non renseigné;18');
  });

  it('avoue les visites sans entreprise, que le contrat ne nomme pas', () => {
    const lignes = visitesCsv({ ...mars, total: 45 }, periode).split('\r\n');

    expect(lignes.slice(0, 6).join('\n')).toContain('Non renseigné;4');
  });

  it('protege un libelle contenant le separateur', () => {
    expect(visitesCsv(mars, periode)).toContain('"DIRECTION; ETAGE";23');
  });

  it('ecrit une part vide plutot que zero pour cent quand la periode est vide', () => {
    const csv = visitesCsv(
      { ...vide, parEntreprise: [{ id: 'e1', code: 'CPI', label: 'CPI', count: 0 }] },
      { annee: 2026, mois: 2 },
    );

    expect(csv).toContain('CPI;0;\r\n');
    expect(csv).toContain('Total;0');
  });

  it('nomme le fichier par la periode', () => {
    expect(visitesCsvFileName({ annee: 2026, mois: 3 })).toBe('cpi-visites-2026-03.csv');
    expect(visitesCsvFileName({ annee: 2026, mois: null })).toBe('cpi-visites-2026.csv');
  });
});

describe('la lecture des statistiques de visites', () => {
  it('interroge les bornes du mois demande', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reponse(vide));
    vi.stubGlobal('fetch', fetchMock);

    const stats = await fetchVisitesStats({ annee: 2026, mois: 2 });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/v1/visites/statistiques?from=2026-02-01&to=2026-02-28',
    );
    expect(stats.total).toBe(0);
  });

  it('interroge l’annee entiere pour le cumul', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reponse({ ...vide, from: '2026-01-01' }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchVisitesStats({ annee: 2026, mois: null });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/v1/visites/statistiques?from=2026-01-01&to=2026-12-31',
    );
  });

  it('rejette une reponse en echec au lieu de rendre un tableau de bord vide', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse({ message: 'panne' }, 500)));

    await expect(fetchVisitesStats({ annee: 2026, mois: 3 })).rejects.toBeInstanceOf(ApiError);
  });

  it('rejette une reponse dont la forme n’est pas celle attendue', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse({ total: 'quarante' })));

    await expect(fetchVisitesStats({ annee: 2026, mois: 3 })).rejects.toThrow(/statistiques/u);
  });
});
