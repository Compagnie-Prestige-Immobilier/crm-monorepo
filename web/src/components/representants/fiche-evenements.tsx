import { Trash2Icon } from 'lucide-react';

import type { EvenementHistorique } from '@/components/historique/evenement';
import { Champ } from '@/components/historique/historique';
import { LIBELLES_RELATION, type RelationRepresentant } from '@/components/representants/filtres';
import { VARIANTES_RELATION } from '@/components/representants/pastille-relation';
import { Button } from '@/components/ui/button';
import {
  LIBELLES_ISSUE_APPEL,
  LIBELLES_WHATSAPP,
  type AppelRepresentant,
  type BasculeRelation,
  type CommentaireRepresentant,
  type Representant,
  type VersionFiche,
} from '@/lib/data/representants';
import { formatDateTime, formatDuree, formatNumber, formatPhone } from '@/lib/format';

const SANS_VALEUR = '–';

const SOURCES_BASCULE = { WEB: 'Panneau', MOBILE: 'Mobile' } as const;

const SOURCES_FICHE: Record<VersionFiche['source'], string> = {
  WEB: 'Panneau',
  MOBILE: 'Mobile',
  APPEL: 'Appel de qualification',
  IMPORT: 'Import Excel',
};

const CHAMPS: Record<string, string> = {
  fullName: 'Nom complet',
  prenom: 'Prénom',
  phoneE164: 'Téléphone',
  etablissement: 'Établissement',
  notes: 'Note de la fiche',
  departementId: 'Département',
  iefId: 'IEF',
  whatsappStatus: 'WhatsApp',
  whatsappE164: 'Numéro WhatsApp',
  profession: 'Profession',
  syndicat: 'Syndicat',
  connaitUES: 'Connaît l’UES',
  contacte: 'Déjà contacté',
};

function ouiNon(valeur: boolean | null): string {
  if (valeur === null) return SANS_VALEUR;
  return valeur ? 'Oui' : 'Non';
}

function ouVide(valeur: string | null, repli: string = SANS_VALEUR): string {
  return valeur === null || valeur === '' ? repli : valeur;
}

export function evenementCreation(representant: Representant): EvenementHistorique {
  const ief = representant.iefName === null ? '' : ` · ${representant.iefName}`;
  return {
    id: `creation-${representant.id}`,
    categorie: 'fiche',
    at: representant.clientCreatedAt,
    titre: 'Fiche créée',
    resume: `${representant.departementName}${ief}`,
    acteur: representant.createdByName,
    detail: (
      <dl className="grid gap-3 sm:grid-cols-2">
        <Champ label="Département">{representant.departementName}</Champ>
        <Champ label="IEF">{ouVide(representant.iefName)}</Champ>
        <Champ label="Saisi par">{representant.createdByName}</Champ>
        <Champ label="Le">{formatDateTime(representant.clientCreatedAt)}</Champ>
      </dl>
    ),
  };
}

function resumeAppel(appel: AppelRepresentant): string {
  if (appel.comment !== null && appel.comment !== '') return appel.comment;
  if (appel.promisedProspects !== null) {
    const pluriel = appel.promisedProspects === 1 ? '' : 's';
    return `${formatNumber(appel.promisedProspects)} prospect${pluriel} promis`;
  }
  if (appel.callbackAt !== null) return `Rappel le ${formatDateTime(appel.callbackAt)}`;
  return '';
}

function DetailAppel({ appel }: { appel: AppelRepresentant }) {
  const commentaire = appel.comment ?? '';
  return (
    <>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Champ label="Issue">{LIBELLES_ISSUE_APPEL[appel.outcome]}</Champ>
        <Champ label="Statut de qualification">
          {ouVide(appel.statutQualificationLabel, 'Aucun')}
        </Champ>
        <Champ label="Temps de traitement">
          {appel.dureeTraitementSecondes === null
            ? SANS_VALEUR
            : formatDuree(appel.dureeTraitementSecondes)}
        </Champ>
        <Champ label="Rappel promis">
          {appel.callbackAt === null ? 'Non' : formatDateTime(appel.callbackAt)}
        </Champ>
        <Champ label="Prospects promis">
          {appel.promisedProspects === null ? SANS_VALEUR : formatNumber(appel.promisedProspects)}
        </Champ>
      </dl>
      <section className="flex flex-col gap-2">
        <p className="eyebrow text-muted-foreground">Réponses du script</p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Champ label="Numéro confirmé">{ouiNon(appel.numeroConfirme)}</Champ>
          <Champ label="Établissement confirmé">{ouiNon(appel.etablissementConfirme)}</Champ>
          <Champ label="Déjà contacté">{ouiNon(appel.contacte)}</Champ>
          <Champ label="Connaît l’UES">{ouiNon(appel.connaitUES)}</Champ>
          <Champ label="Syndicat">{ouVide(appel.syndicat)}</Champ>
        </dl>
      </section>
      {appel.suggestedPhoneE164 === null ? null : (
        <section className="flex flex-col gap-2">
          <p className="eyebrow text-muted-foreground">Personne proposée</p>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Champ label="Nom">{ouVide(appel.suggestedName, 'Sans nom')}</Champ>
            <Champ label="Téléphone">{formatPhone(appel.suggestedPhoneE164)}</Champ>
            <Champ label="Note">{ouVide(appel.suggestedNote)}</Champ>
          </dl>
        </section>
      )}
      {commentaire === '' ? null : (
        <section className="flex flex-col gap-1">
          <p className="eyebrow text-muted-foreground">
            {appel.statutQualificationRequiresComment ? 'Motif' : 'Commentaire'}
          </p>
          <p className="whitespace-pre-wrap">{commentaire}</p>
        </section>
      )}
    </>
  );
}

export function evenementAppel(appel: AppelRepresentant): EvenementHistorique {
  return {
    id: appel.id,
    categorie: 'appel',
    at: appel.clientCreatedAt,
    titre: appel.statutQualificationLabel ?? LIBELLES_ISSUE_APPEL[appel.outcome],
    resume: resumeAppel(appel),
    acteur: appel.performedByName,
    detail: <DetailAppel appel={appel} />,
  };
}

export function evenementBascule(bascule: BasculeRelation): EvenementHistorique {
  const avant = LIBELLES_RELATION[bascule.fromStatus as RelationRepresentant];
  const apres = LIBELLES_RELATION[bascule.toStatus as RelationRepresentant];
  return {
    id: bascule.id,
    categorie: 'statut',
    at: bascule.changedAt,
    titre: `${avant} → ${apres}`,
    variant: VARIANTES_RELATION[bascule.toStatus as RelationRepresentant],
    resume: bascule.reason,
    acteur: bascule.changedByName,
    source: SOURCES_BASCULE[bascule.source],
    detail: (
      <dl className="grid gap-3 sm:grid-cols-2">
        <Champ label="Avant">{avant}</Champ>
        <Champ label="Après">{apres}</Champ>
        <Champ label="Motif">{ouVide(bascule.reason, 'Aucun')}</Champ>
        <Champ label="Depuis">{SOURCES_BASCULE[bascule.source]}</Champ>
      </dl>
    ),
  };
}

function valeurDeChamp(champ: string, valeur: string | null): string {
  if (valeur === null || valeur === '') return 'Vide';
  if (valeur === 'true') return 'Oui';
  if (valeur === 'false') return 'Non';
  if (champ === 'whatsappStatus') {
    return LIBELLES_WHATSAPP[valeur as keyof typeof LIBELLES_WHATSAPP] ?? valeur;
  }
  if (champ === 'phoneE164' || champ === 'whatsappE164') return formatPhone(valeur);
  return valeur;
}

export function evenementVersion(version: VersionFiche): EvenementHistorique {
  const champs = version.champs ?? [];
  return {
    id: version.id,
    categorie: 'fiche',
    at: version.changedAt,
    titre: champs.every((c) => c.avant === null) ? 'Formulaire rempli' : 'Formulaire modifié',
    variant: 'secondary',
    resume: champs.map((c) => CHAMPS[c.champ] ?? c.champ).join(', '),
    acteur: version.changedByName,
    source: SOURCES_FICHE[version.source],
    detail: (
      <table className="w-full border-collapse text-[0.8125rem]">
        <thead>
          <tr className="text-left text-[0.75rem] text-muted-foreground">
            <th className="pb-2 font-[500]">Champ</th>
            <th className="pb-2 font-[500]">Avant</th>
            <th className="pb-2 font-[500]">Après</th>
          </tr>
        </thead>
        <tbody>
          {champs.map((c) => (
            <tr key={c.champ} className="border-t border-border align-top">
              <td className="py-2 pr-2 text-muted-foreground">{CHAMPS[c.champ] ?? c.champ}</td>
              <td className="py-2 pr-2 break-words line-through decoration-muted-foreground/60">
                {valeurDeChamp(c.champ, c.avant)}
              </td>
              <td className="py-2 font-[600] break-words">{valeurDeChamp(c.champ, c.apres)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
  };
}

export function evenementCommentaire(
  commentaire: CommentaireRepresentant,
  onSupprimer: (() => void) | null,
): EvenementHistorique {
  return {
    id: commentaire.id,
    categorie: 'fil',
    at: commentaire.clientCreatedAt,
    titre: 'Commentaire',
    variant: 'secondary',
    resume: commentaire.body,
    acteur: commentaire.authorName,
    detail: <p className="whitespace-pre-wrap">{commentaire.body}</p>,
    action:
      onSupprimer === null ? undefined : (
        <Button type="button" size="sm" variant="outline" onClick={onSupprimer}>
          <Trash2Icon aria-hidden="true" />
          Supprimer
        </Button>
      ),
  };
}
