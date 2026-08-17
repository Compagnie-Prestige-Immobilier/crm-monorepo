import { EnrollmentMethod } from '@crm/database';

import type { ImportColumn } from './import-adapter.js';

export const PROSPECT_IMPORT_HEADERS = {
  nom: 'Nom',
  prenom: 'Prénom',
  phone: 'Téléphone',
  representantPhone: 'Téléphone du représentant',
  banque: 'Banque',
  syndicat: 'Syndicat',
  enrollmentMethod: 'Méthode d’enrôlement',
} as const;

export const ENROLLMENT_METHOD_TOKENS: readonly EnrollmentMethod[] = [
  EnrollmentMethod.PLATFORM,
  EnrollmentMethod.PHYSICAL,
  EnrollmentMethod.VOICE_OR_ELECTRONIC_MESSAGING,
];

export const PROSPECTS_IMPORT_COLUMNS: readonly ImportColumn[] = [
  {
    header: PROSPECT_IMPORT_HEADERS.nom,
    width: 24,
    required: true,
    help: 'Nom de famille SEUL. Ne mettez pas le nom et le prénom dans la même cellule : le serveur ne les découpe pas.',
    sample: 'Ndiaye',
  },
  {
    header: PROSPECT_IMPORT_HEADERS.prenom,
    width: 24,
    required: true,
    help: 'Prénom SEUL, prénoms composés compris. Colonne distincte du nom, volontairement.',
    sample: 'Aminata',
  },
  {
    header: PROSPECT_IMPORT_HEADERS.phone,
    width: 20,
    required: true,
    help: 'Toutes les présentations sont admises : 77 123 45 67, +221 77 123 45 67, 00221771234567. Le serveur normalise. C’est ce numéro qui sert à repérer les doublons.',
    sample: '77 123 45 67',
  },
  {
    header: PROSPECT_IMPORT_HEADERS.representantPhone,
    width: 26,
    required: true,
    help: 'Numéro du représentant qui a apporté le prospect. Le représentant doit DÉJÀ exister : importez d’abord les représentants, ce fichier n’en crée aucun.',
    sample: '76 987 65 43',
  },
  {
    header: PROSPECT_IMPORT_HEADERS.banque,
    width: 18,
    required: true,
    help: 'Nom court de la banque, repris EXACTEMENT du référentiel (liste déroulante). Seuls la casse et les espaces autour sont tolérés.',
    sample: 'CBAO',
  },
  {
    header: PROSPECT_IMPORT_HEADERS.syndicat,
    width: 18,
    required: true,
    help: 'Sigle du syndicat, repris EXACTEMENT du référentiel (liste déroulante). Seuls la casse et les espaces autour sont tolérés.',
    sample: 'CHUES',
  },
  {
    header: PROSPECT_IMPORT_HEADERS.enrollmentMethod,
    width: 32,
    required: false,
    help: 'Facultative. À remplir uniquement si l’enrôlement a DÉJÀ eu lieu : PLATFORM, PHYSICAL ou VOICE_OR_ELECTRONIC_MESSAGING. Laissée vide, la fiche part en attente d’appel.',
    sample: 'PLATFORM',
  },
];

export const PROSPECTS_IMPORT_SHEET_NAME = 'Prospects';
