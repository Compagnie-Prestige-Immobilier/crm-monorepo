export interface CanalProvenanceSeed {
  code: string;
  label: string;
  position: number;
}

/**
 * Par ou un prospect Grand Public arrive.
 *
 * Le `code` est IMMUABLE : les fiches deja saisies le designent, et le renommer
 * les detacherait de leur origine. Seul le `label` se corrige. Cette liste est
 * un point de depart, pas une cloture : un canal s'ajoute par l'administration
 * des referentiels, sans migration.
 */
export const CANAUX_PROVENANCE: readonly CanalProvenanceSeed[] = [
  { code: 'TIKTOK', label: 'TikTok', position: 10 },
  { code: 'FACEBOOK', label: 'Facebook', position: 20 },
  { code: 'INSTAGRAM', label: 'Instagram', position: 30 },
  { code: 'LINKEDIN', label: 'LinkedIn', position: 40 },
  { code: 'WHATSAPP', label: 'WhatsApp', position: 50 },
  { code: 'SITE_WEB', label: 'Site web', position: 60 },
  { code: 'PARRAINAGE', label: 'Parrainage', position: 70 },
  { code: 'BOUCHE_A_OREILLE', label: 'Bouche à oreille', position: 80 },
  { code: 'SALON', label: 'Salon ou foire', position: 90 },
  { code: 'AFFICHAGE', label: 'Affichage et panneaux', position: 100 },
  { code: 'RADIO_TV', label: 'Radio ou télévision', position: 110 },
  { code: 'APPEL_ENTRANT', label: 'Appel entrant', position: 120 },
  { code: 'VISITE_AGENCE', label: 'Visite en agence', position: 130 },
  { code: 'DIASPORA', label: 'Relais diaspora', position: 140 },
];
