import { readFileSync } from 'node:fs';

import { expect, request, test } from '@playwright/test';

import { BASE_URL, compteDe, ROLES } from './comptes';
import { CHEMIN_ROLES } from './global-setup';

const UUID_NUL = '00000000-0000-0000-0000-000000000000';

const matrice = JSON.parse(readFileSync(CHEMIN_ROLES, 'utf8')) as Record<string, string[]>;

interface Reponse {
  statut: number;
  message: string;
}

async function appeler(methode: string, chemin: string, etat?: string): Promise<Reponse> {
  const contexte = await request.newContext({
    baseURL: BASE_URL,
    // Sans `Origin`, toute ecriture est refusee par la garde CSRF : le 403
    // serait rendu avant la garde de role, et le parcours passerait a vide.
    extraHTTPHeaders: { Origin: BASE_URL, 'X-Forwarded-For': '198.51.100.40' },
    ...(etat === undefined ? {} : { storageState: etat }),
  });
  try {
    const reponse = await contexte.fetch(chemin, {
      method: methode,
      failOnStatusCode: false,
      ...(methode === 'GET' || methode === 'HEAD' ? {} : { data: {} }),
    });
    const corps = (await reponse.text()).slice(0, 300);
    return { statut: reponse.status(), message: corps };
  } finally {
    await contexte.dispose();
  }
}

test.describe('parcours 16, matrice des roles', () => {
  for (const [cle, autorises] of Object.entries(matrice)) {
    const espace = cle.indexOf(' ');
    const methode = cle.slice(0, espace);
    const chemin = cle.slice(espace + 1).replaceAll(/\{[^}]+\}/g, UUID_NUL);

    if (autorises.includes('PUBLIC')) {
      test(`${cle} reste ouverte sans session`, async () => {
        const { statut } = await appeler(methode, chemin);
        expect(statut, `${cle} exige une session alors qu'elle est publique`).not.toBe(401);
      });
      continue;
    }

    test(`${cle} exige une session`, async () => {
      const { statut } = await appeler(methode, chemin);
      expect(statut).toBe(401);
    });

    const refuses = ROLES.filter((role) => !autorises.includes(role));
    for (const role of refuses) {
      test(`${cle} refuse ${role}`, async () => {
        const { statut, message } = await appeler(methode, chemin, compteDe(role).etat);
        expect(statut, `${cle} accepte ${role} hors matrice`).toBe(403);
        expect(message).toContain('Accès refusé.');
      });
    }
  }
});
