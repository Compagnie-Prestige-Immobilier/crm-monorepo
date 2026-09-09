import { z } from '@/lib/zod';

import { ApiError, apiClient, unwrap } from '@/api/client';
import type { components } from '@/api/schema';
import type { Etape, FormulairePublic, Saisie } from '@/lib/data/formulaire-public-champs';

type FormulaireCorps = components['schemas']['FormulaireCorps'];

export const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

export async function fetchFormulairePublic(): Promise<FormulairePublic> {
  return unwrap(await apiClient.GET('/api/v1/formulaire-public/formulaire'));
}

const corpsSchema = z.object({
  nom: z.string(),
  prenom: z.string(),
  phone: z.string(),
  email: z.string().optional(),
  whatsappStatus: z.enum(['NON_DEMANDE', 'MEME_NUMERO', 'AUTRE_NUMERO', 'AUCUN']).optional(),
  whatsappE164: z.string().optional(),
  professionId: z.string().optional(),
  profession: z.string().optional(),
  etablissement: z.string().optional(),
  dureeEtablissementMois: z.number().int().optional(),
  fonctionnaire: z.boolean().optional(),
  type: z.enum(['FONCTIONNAIRE', 'SECTEUR_PRIVE', 'INFORMEL', 'DIASPORA']).optional(),
  syndicatId: z.string().optional(),
  banqueId: z.string().optional(),
  engagementEnCours: z.boolean().optional(),
  incomeBandId: z.string().optional(),
  paymentMode: z.enum(['COMPTANT', 'ECHELONNE']).optional(),
  dureeSystemeMois: z.number().int().optional(),
  champsLibres: z.record(z.string(), z.string()).optional(),
  message: z.string().optional(),
  turnstileToken: z.string().optional(),
  site: z.string().optional(),
});

/**
 * Les champs rendus viennent d'un réglage d'administrateur : leur assemblage
 * est dynamique, et seul ce passage prouve qu'il correspond au contrat.
 */
export async function envoyerDemande(jeton: string, brut: Record<string, unknown>): Promise<void> {
  // zod n'écrit pas les clés absentes : le type les porte en `undefined`, pas l'objet.
  const corps = corpsSchema.parse(brut) as FormulaireCorps;
  unwrap(
    await apiClient.POST('/api/v1/formulaire-public/{jeton}', {
      params: { path: { jeton } },
      body: corps,
    }),
  );
}

export const CAPTCHA_INDISPONIBLE =
  'La vérification anti-robot est indisponible. Réessayez dans un instant.';

const LIEN_MORT = 'Ce lien ne fonctionne plus. Demandez-en un nouveau à votre conseiller CPI.';

const TROP_D_ENVOIS = 'Trop d’envois depuis cette connexion. Patientez une minute.';

const REFUS_PAR_CODE: Readonly<Record<string, string>> = {
  CAPTCHA_REFUSE: 'La vérification anti-robot n’a pas abouti. Rechargez la page et recommencez.',
  CAPTCHA_INDISPONIBLE: CAPTCHA_INDISPONIBLE,
  LIEN_INVALIDE: LIEN_MORT,
  RATE_LIMITED: TROP_D_ENVOIS,
};

const REFUS_PAR_STATUT: Readonly<Record<number, string>> = {
  400: 'Vérifiez les champs signalés.',
  404: LIEN_MORT,
  429: TROP_D_ENVOIS,
  503: CAPTCHA_INDISPONIBLE,
};

/**
 * Un 400 anti-robot n'est pas une saisie fautive : sans son code, le visiteur
 * relirait ses champs sans jamais trouver ce qui cloche.
 */
export function messageDeRefus(error: unknown): string {
  if (error instanceof z.ZodError) return 'Vérifiez les champs signalés.';
  if (!(error instanceof ApiError)) {
    return 'Le serveur est injoignable. Vérifiez votre connexion.';
  }
  const payload = error.payload;
  const code =
    typeof payload === 'object' && payload !== null
      ? (payload as { code?: unknown }).code
      : undefined;
  if (typeof code === 'string' && code in REFUS_PAR_CODE) {
    return REFUS_PAR_CODE[code] ?? '';
  }
  return REFUS_PAR_STATUT[error.status] ?? 'Votre demande n’a pas pu être envoyée.';
}

export interface Brouillon {
  readonly saisie: Saisie;
  readonly etape: Etape;
}

const cleBrouillon = (jeton: string): string => `cpi:demande:${jeton}`;

const brouillonSchema = z.object({
  saisie: z.record(z.string(), z.string()),
  etape: z.enum(['coordonnees', 'complement']),
});

/**
 * Le formulaire se remplit sur un téléphone ou un poste partagé : le brouillon
 * meurt avec l'onglet. Le jeton anti-robot et le champ piège vivent dans le
 * DOM, hors de `saisie` : ils ne peuvent pas s'y glisser.
 */
export function lireBrouillon(jeton: string): Brouillon | null {
  try {
    const brut = globalThis.sessionStorage.getItem(cleBrouillon(jeton));
    if (brut === null) return null;
    const lu = brouillonSchema.safeParse(JSON.parse(brut));
    return lu.success ? lu.data : null;
  } catch {
    return null;
  }
}

export function ecrireBrouillon(jeton: string, brouillon: Brouillon): void {
  try {
    globalThis.sessionStorage.setItem(cleBrouillon(jeton), JSON.stringify(brouillon));
  } catch {
    // Navigation privée ou stockage refusé : la page marche sans brouillon.
  }
}

export function effacerBrouillon(jeton: string): void {
  try {
    globalThis.sessionStorage.removeItem(cleBrouillon(jeton));
  } catch {
    // Idem : rien à rattraper, le brouillon n'a jamais été écrit.
  }
}
