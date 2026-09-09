import { expect, test as installer } from '@playwright/test';

import { BASE_URL, MOT_DE_PASSE, ROLES, TOUS_LES_COMPTES } from './comptes';

// Une session par compte et par jeu, ouverte par l'API : l'écran de connexion
// a son propre parcours (parite-acces), l'installation n'a pas à le rejouer.
for (const role of ROLES) {
  installer(`sessions ${role}`, async ({ playwright }) => {
    for (const compte of TOUS_LES_COMPTES.filter((candidat) => candidat.role === role)) {
      const api = await playwright.request.newContext({
        baseURL: BASE_URL,
        // Toute écriture exige une origine : l'API refuse sinon (garde CSRF).
        extraHTTPHeaders: { 'X-Forwarded-For': compte.adresse, Origin: BASE_URL },
      });
      const reponse = await api.post('/api/v1/auth/login', {
        data: { identifier: compte.email, password: MOT_DE_PASSE },
      });
      expect(reponse.status(), `connexion de ${compte.email}`).toBe(200);
      await api.storageState({ path: compte.etat });
      await api.dispose();
    }
  });
}
