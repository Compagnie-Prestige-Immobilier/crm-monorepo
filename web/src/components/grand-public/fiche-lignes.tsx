import type { ReactNode } from 'react';

import { Absent } from '@/components/grand-public/absence';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChampLibre } from '@/lib/data/champs-conversion';
import type { Prospect } from '@/lib/data/console';
import { CALL_OUTCOME_LABELS } from '@/lib/data/console';
import {
  MODE_EPARGNE_LABELS,
  PAYMENT_MODE_LABELS,
  PROSPECT_TYPE_LABELS,
  TYPE_CONTRAT_LABELS,
  formatAnciennete,
  formatDureeMois,
} from '@/lib/data/grand-public';
import { formatDateTime, formatPhone } from '@/lib/format';

export function Ligne({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="text-[0.8125rem] font-[600] text-muted-foreground sm:w-56 sm:shrink-0">
        {label}
      </dt>
      <dd className="min-w-0 text-[0.9375rem]">{children}</dd>
    </div>
  );
}

export function Texte({ value, absent }: { value: string | null; absent: string }) {
  if (value === null || value === '') return <Absent>{absent}</Absent>;
  return <span>{value}</span>;
}

/**
 * Un renseignement propre à une situation. Absent, la ligne DISPARAÎT : une
 * fiche d'informel n'a pas à porter « Type de contrat : non renseigné ».
 */
function LigneSi({ label, value }: { label: string; value: string | null }) {
  if (value === null || value === '') return null;
  return (
    <Ligne label={label}>
      <span>{value}</span>
    </Ligne>
  );
}

export function LignesSituation({ prospect }: { prospect: Prospect }) {
  const contrat = prospect.typeContrat;
  const epargne = prospect.modeEpargne;
  const anciennete = prospect.ancienneteMois;
  const whatsapp = prospect.whatsappE164;
  const relais = prospect.relaisPhoneE164;

  return (
    <>
      <LigneSi label="Employeur" value={prospect.employeur} />
      <LigneSi
        label="Type de contrat"
        value={contrat === null ? null : TYPE_CONTRAT_LABELS[contrat]}
      />
      <LigneSi
        label="Ancienneté"
        value={anciennete === null ? null : formatAnciennete(anciennete)}
      />
      <LigneSi label="Lieu d’activité" value={prospect.lieuActivite} />
      <LigneSi
        label="Mode d’épargne"
        value={epargne === null ? null : MODE_EPARGNE_LABELS[epargne]}
      />
      <LigneSi label="Pays de résidence" value={prospect.paysResidenceLabel} />
      <LigneSi label="Ville de résidence" value={prospect.villeResidence} />
      <LigneSi label="WhatsApp" value={whatsapp === null ? null : formatPhone(whatsapp)} />
      <LigneSi label="Personne relais" value={prospect.relaisNom} />
      <LigneSi label="Téléphone du relais" value={relais === null ? null : formatPhone(relais)} />
    </>
  );
}

/**
 * Le segment se calcule par croisement syndicat × banque. Nommer ce qui manque
 * dit quoi aller chercher ; « BDD4 » aurait affirmé un croisement qui n'a pas eu lieu.
 */
function raisonSansSegment(prospect: Prospect): string {
  if (prospect.banqueId === null && prospect.syndicatId === null) {
    return 'Ni banque ni syndicat : la fiche n’entre dans aucune base.';
  }
  if (prospect.banqueId === null) return 'La banque manque pour le calculer.';
  return 'Le syndicat manque pour le calculer.';
}

export function ligneSituation(prospect: Prospect): ReactNode {
  if (prospect.type === null) return <Absent>Question non posée</Absent>;
  return PROSPECT_TYPE_LABELS[prospect.type];
}

export function lignePaiement(prospect: Prospect): ReactNode {
  if (prospect.paymentMode === null) return <Absent>Non renseigné</Absent>;
  return PAYMENT_MODE_LABELS[prospect.paymentMode];
}

export function ligneDureeSysteme(prospect: Prospect): ReactNode {
  if (prospect.dureeSystemeMois === null) return <Absent>Non renseignée</Absent>;
  return formatDureeMois(prospect.dureeSystemeMois);
}

export function ligneSegment(prospect: Prospect): ReactNode {
  if (prospect.segment === null) {
    return (
      <span className="flex flex-col gap-0.5">
        <Absent>Aucun</Absent>
        <span className="text-[0.8125rem] text-muted-foreground">
          {raisonSansSegment(prospect)}
        </span>
      </span>
    );
  }
  return <Badge variant="outline">{prospect.segment}</Badge>;
}

/**
 * Les réponses aux champs que l'administrateur a ajoutés. Sans réponse, pas de
 * carte : une carte vide ferait croire à une donnée manquante.
 */
export function ChampsAjoutes({
  champs,
  reponses,
}: {
  champs: readonly ChampLibre[];
  reponses: Readonly<Record<string, string>>;
}) {
  if (champs.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Champs ajoutés</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 text-[0.8125rem] sm:grid-cols-4">
          {champs.map((champ) => (
            <div key={champ.id} className="min-w-0">
              <dt className="text-muted-foreground">{champ.libelle}</dt>
              <dd className="truncate font-[600]">{reponses[champ.id]}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

export function DernierAppel({ prospect }: { prospect: Prospect }) {
  const issue = prospect.lastOutcome;
  if (issue === null) return <Absent>Jamais appelé</Absent>;

  return (
    <span className="flex flex-col gap-0.5">
      <span className="font-[600]">
        {issue in CALL_OUTCOME_LABELS
          ? CALL_OUTCOME_LABELS[issue as keyof typeof CALL_OUTCOME_LABELS]
          : issue}
      </span>
      {prospect.lastComment !== null && prospect.lastComment !== '' ? (
        <span className="text-[0.8125rem] text-muted-foreground">{prospect.lastComment}</span>
      ) : null}
      {prospect.lastAttemptAt !== null ? (
        <time dateTime={prospect.lastAttemptAt} className="text-[0.8125rem] text-muted-foreground">
          {formatDateTime(prospect.lastAttemptAt)}
        </time>
      ) : null}
    </span>
  );
}
