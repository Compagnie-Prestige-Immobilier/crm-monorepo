import type { ApiClient } from '@crm/api-client';
import { describe, expect, it, vi } from 'vitest';

import { saveDisposition, serializeDisposition } from '@/lib/data/visites-dashboard';

describe('serializeDisposition', () => {
  it('ne porte que les champs acceptés par la liste blanche du serveur', () => {
    const body = serializeDisposition(
      [
        {
          id: 'client-only-key',
          source: 'total-visites',
          marque: 'tuile',
          taille: 'demi',
          presentation: { palette: 'serie', tri: 'valeur-desc' },
        },
      ],
      'essentiel',
    );

    expect(body).toEqual({
      preset: 'essentiel',
      widgets: [
        {
          source: 'total-visites',
          marque: 'tuile',
          taille: 'demi',
          presentation: { palette: 'serie', tri: 'valeur-desc' },
        },
      ],
    });
    const [premier] = body.widgets;
    expect(premier === undefined ? false : 'id' in premier).toBe(false);
  });

  it('omet les champs facultatifs non renseignés plutôt que de les envoyer nuls', () => {
    const body = serializeDisposition([{ id: 'x', source: 'par-entreprise' }]);
    expect(body).toEqual({ widgets: [{ source: 'par-entreprise' }] });
    expect(Object.keys(body.widgets[0] ?? {})).toEqual(['source']);
  });
});

describe('saveDisposition', () => {
  it('envoie le corps sérialisé au client typé', async () => {
    const PUT = vi.fn().mockResolvedValue({
      data: { widgets: [], preset: 'essentiel', source: 'utilisateur', updatedAt: null },
    });
    const client = { PUT } as unknown as ApiClient;

    await saveDisposition(
      'visites',
      [{ id: 'x', source: 'total-visites', marque: 'tuile' }],
      'essentiel',
      client,
    );

    expect(PUT).toHaveBeenCalledWith('/api/v1/tableaux-de-bord/{ecran}/disposition', {
      params: { path: { ecran: 'visites' } },
      body: { preset: 'essentiel', widgets: [{ source: 'total-visites', marque: 'tuile' }] },
    });
  });
});
