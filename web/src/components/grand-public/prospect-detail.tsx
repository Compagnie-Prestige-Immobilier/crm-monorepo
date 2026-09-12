'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilIcon, PhoneIcon } from 'lucide-react';
import Link from 'next/link';
import { useId, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { meQueryOptions } from '@/api/auth';
import { DetailBackLink } from '@/components/detail-back-link';
import { Field } from '@/components/forms/field';
import { Absent } from '@/components/grand-public/absence';
import { CanalProvenance } from '@/components/grand-public/canal-provenance';
import { lienRetourListe } from '@/components/grand-public/prospects-view';
import { ChampsAjoutes } from '@/components/prospects/champs-ajoutes';
import { GrandPublicProspectForm } from '@/components/grand-public/prospect-form';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGardeSaisie } from '@/components/ui/confirm-dialog';
import {
  DUREES_MOIS,
  PROSPECT_TYPE_LABELS,
  confirmGrandPublicConversion,
  formatDureeMois,
  updateGrandPublicConsent,
} from '@/lib/data/grand-public';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDate, formatDateTime, formatPhone } from '@/lib/format';
import { formatXof, parseMoneyInput } from '@/lib/money';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import {
  CALL_OUTCOME_LABELS,
  MODE_EPARGNE_LABELS,
  PAYMENT_MODE_LABELS,
  PAYMENT_MODES,
  PROSPECT_STATUT_LABELS,
  SEGMENT_LABELS,
  TYPE_CONTRAT_LABELS,
  type ProspectRow,
  type ProspectStatut,
  type Offer,
  type PaymentMode,
  type Role,
} from '@/lib/types';
import { cn } from '@/lib/utils';

const STATUT_VARIANT: Record<ProspectStatut, 'secondary' | 'info' | 'success' | 'destructive'> = {
  NOUVEAU: 'secondary',
  CONTACTE: 'info',
  CONVERTI: 'success',
  PERDU: 'destructive',
};

function Ligne({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="text-[0.8125rem] font-[600] text-muted-foreground sm:w-56 sm:shrink-0">
        {label}
      </dt>
      <dd className="min-w-0 text-[0.9375rem]">{children}</dd>
    </div>
  );
}

function Texte({ value, absent }: { value: string | null; absent: string }) {
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

function formatAnciennete(mois: number): string {
  if (mois < 12) return `${String(mois)} mois`;
  const ans = Math.floor(mois / 12);
  const reste = mois % 12;
  const debut = `${String(ans)} an${ans > 1 ? 's' : ''}`;
  return reste === 0 ? debut : `${debut} et ${String(reste)} mois`;
}

const libelleMetier = (type: ProspectRow['type']): string =>
  type === 'INFORMEL' ? 'Activité' : 'Profession';

/** Les renseignements propres à la situation : chacun paraît s'il a été noté. */
function LignesSituation({ prospect }: { prospect: ProspectRow }) {
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
function raisonSansSegment(prospect: ProspectRow): string {
  if (prospect.banqueId === null && prospect.syndicatId === null) {
    return 'Ni banque ni syndicat : la fiche n’entre dans aucune base.';
  }
  if (prospect.banqueId === null) return 'La banque manque pour le calculer.';
  return 'Le syndicat manque pour le calculer.';
}

function situationLigne(prospect: ProspectRow): ReactNode {
  if (prospect.type === null) return <Absent>Question non posée</Absent>;
  return PROSPECT_TYPE_LABELS[prospect.type];
}

function paiementLigne(prospect: ProspectRow): ReactNode {
  if (prospect.paymentMode === null) return <Absent>Non renseigné</Absent>;
  return PAYMENT_MODE_LABELS[prospect.paymentMode];
}

function dureeSystemeLigne(prospect: ProspectRow): ReactNode {
  if (prospect.dureeSystemeMois === null) return <Absent>Non renseignée</Absent>;
  return formatDureeMois(prospect.dureeSystemeMois);
}

function segmentLigne(prospect: ProspectRow): ReactNode {
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
  return <Badge variant="outline">{SEGMENT_LABELS[prospect.segment]}</Badge>;
}

/** Le formulaire de saisie, garni de la fiche. Monté à l'ouverture seulement : il repart de la fiche. */
function ModifierLaFiche({
  canEdit,
  prospect,
  onEnregistre,
}: {
  canEdit: boolean;
  prospect: ProspectRow;
  onEnregistre: (prospect: ProspectRow) => void;
}) {
  const [ouverte, setOuverte] = useState(false);
  const garde = useGardeSaisie(() => {
    setOuverte(false);
  });
  if (!canEdit) return null;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setOuverte(true);
        }}
      >
        <PencilIcon aria-hidden="true" />
        Modifier
      </Button>
      <Dialog
        open={ouverte}
        onOpenChange={(ouvrir) => {
          if (ouvrir) setOuverte(true);
          else garde.demanderFermeture();
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Modifier {prospect.prenom} {prospect.nom}
            </DialogTitle>
            <DialogDescription>
              Un champ vidé efface le renseignement. Changer la situation retire ce qu’elle ne
              demande plus.
            </DialogDescription>
          </DialogHeader>
          {ouverte ? (
            <GrandPublicProspectForm
              initial={prospect}
              onModifie={garde.signalerModifie}
              onAnnule={garde.demanderFermeture}
              onSaved={(saved) => {
                garde.signalerModifie(false);
                onEnregistre(saved);
                setOuverte(false);
              }}
            />
          ) : null}
          {garde.confirmation}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ActionsConsentement({
  canEdit,
  statut,
  consentement,
  pending,
  onConsent,
  onConvertir,
}: {
  canEdit: boolean;
  statut: ProspectStatut;
  consentement: string | null;
  pending: boolean;
  onConsent: (value: 'INTERESSE' | 'REFUSE') => void;
  onConvertir: () => void;
}) {
  if (!canEdit || statut === 'CONVERTI') return null;

  return (
    <>
      <Button
        variant={consentement === 'INTERESSE' ? 'default' : 'outline'}
        onClick={() => {
          onConsent('INTERESSE');
        }}
        disabled={pending}
      >
        Intéressé
      </Button>
      <Button
        variant={consentement === 'REFUSE' ? 'destructive' : 'outline'}
        onClick={() => {
          onConsent('REFUSE');
        }}
        disabled={pending}
      >
        Refusé
      </Button>
      {consentement === 'INTERESSE' ? (
        <Button onClick={onConvertir}>Confirmer la conversion</Button>
      ) : null}
    </>
  );
}

const ROLES_APPEL: readonly Role[] = ['ADMIN', 'SUPERVISEUR', 'COMMERCIAL', 'CHARGE_CLIENTELE'];

/** Mêmes rôles que la garde de `/grand-public/appel/$id`. */
function LienAppeler({ prospectId }: { prospectId: string }) {
  const { data: moi } = useQuery(meQueryOptions);
  const role = moi?.role;
  if (role === undefined || !ROLES_APPEL.includes(role)) return null;

  return (
    <Link
      href={`/grand-public/appel/${prospectId}`}
      className={buttonVariants({ variant: 'outline' })}
    >
      <PhoneIcon aria-hidden="true" />
      Appeler
    </Link>
  );
}

function DernierAppel({ prospect }: { prospect: ProspectRow }) {
  if (prospect.lastOutcome === null) return <Absent>Jamais appelé</Absent>;

  return (
    <span className="flex flex-col gap-0.5">
      <span className="font-[600]">{CALL_OUTCOME_LABELS[prospect.lastOutcome]}</span>
      {prospect.lastComment !== null && prospect.lastComment !== '' ? (
        <span className="text-[0.8125rem] text-muted-foreground">{prospect.lastComment}</span>
      ) : null}
      {prospect.lastAttemptAt !== null ? (
        <time
          dateTime={prospect.lastAttemptAt}
          className="text-[0.8125rem] text-muted-foreground tabular-nums"
        >
          {formatDateTime(prospect.lastAttemptAt)}
        </time>
      ) : null}
    </span>
  );
}

export function GrandPublicProspectDetail({
  prospect: initialProspect,
  offers: offersProp,
  canEdit: canEditProp,
}: {
  prospect: ProspectRow;
  offers?: Offer[];
  canEdit?: boolean;
}) {
  const offers = offersProp ?? [];
  const canEdit = Boolean(canEditProp);
  const queryClient = useQueryClient();
  const [prospect, setProspect] = useState(initialProspect);
  const [conversionOpen, setConversionOpen] = useState(false);
  const [retourListe] = useState(lienRetourListe);
  const journey = prospect.journeys?.find((item) => item.projet === 'GRAND_PUBLIC');

  const refresh = (saved: ProspectRow) => {
    setProspect(saved);
    void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardRoot });
  };

  const consent = useMutation({
    mutationFn: (value: 'INTERESSE' | 'REFUSE') => updateGrandPublicConsent(prospect.id, value),
    onSuccess: (saved) => {
      refresh(saved);
      toast.success('Consentement enregistré.');
    },
    onError: (error) => toastApiError(error, 'Le consentement n’a pas pu être enregistré.'),
  });

  if (journey === undefined) {
    return (
      <Card
        role="alert"
        className="animate-rise mx-auto max-w-lg items-center gap-3 px-6 py-16 text-center"
      >
        <h1 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">
          Cette fiche relève du projet CHUES
        </h1>
        <p className="max-w-md text-[0.9375rem] text-muted-foreground">
          Les deux projets ne partagent aucun écran. Elle se consulte depuis le suivi CHUES.
        </p>
        <Link
          href="/chues/prospects"
          className={cn(buttonVariants({ variant: 'outline' }), 'mt-1')}
        >
          Ouvrir le suivi CHUES
        </Link>
      </Card>
    );
  }

  const name = `${prospect.prenom} ${prospect.nom}`.trim();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <DetailBackLink href={retourListe}>Prospects Grand Public</DetailBackLink>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-h2 font-[700] tracking-[-0.02em]">{name}</h1>
          <a
            href={`tel:${prospect.phoneE164}`}
            className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-sm text-[1.0625rem] tabular-nums underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <PhoneIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            {formatPhone(prospect.phoneE164)}
          </a>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge variant={STATUT_VARIANT[journey.statut]} className="text-[0.8125rem]">
            {PROSPECT_STATUT_LABELS[journey.statut]}
          </Badge>
          <LienAppeler prospectId={prospect.id} />
          <ModifierLaFiche canEdit={canEdit} prospect={prospect} onEnregistre={refresh} />
          <ActionsConsentement
            canEdit={canEdit}
            statut={journey.statut}
            consentement={journey.consent}
            pending={consent.isPending}
            onConsent={(value) => {
              consent.mutate(value);
            }}
            onConvertir={() => {
              setConversionOpen(true);
            }}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Le prospect</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <Ligne label="Situation">{situationLigne(prospect)}</Ligne>
            <Ligne label={libelleMetier(prospect.type)}>
              <Texte value={prospect.profession} absent="Non renseignée" />
            </Ligne>
            <Ligne label="Revenu mensuel">
              <Texte value={prospect.incomeBandLabel} absent="Non renseigné" />
            </Ligne>
            <Ligne label="Paiement">{paiementLigne(prospect)}</Ligne>
            <LignesSituation prospect={prospect} />
            <Ligne label="Canal de provenance">
              {prospect.canalProvenanceLabel === null ? (
                <Texte value={null} absent="Non renseigné" />
              ) : (
                <CanalProvenance label={prospect.canalProvenanceLabel} />
              )}
            </Ligne>
            <Ligne label="Durée du système">{dureeSystemeLigne(prospect)}</Ligne>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rattachements</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <Ligne label="Banque de domiciliation">
              <Texte value={prospect.banqueName} absent="Non renseignée" />
            </Ligne>
            <Ligne label="Syndicat">
              <Texte value={prospect.syndicatSigle} absent="Aucun" />
            </Ligne>
            <Ligne label="Représentant">
              <Texte value={prospect.representantName} absent="Sans représentant" />
            </Ligne>
            <Ligne label="Segment">{segmentLigne(prospect)}</Ligne>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suivi</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <Ligne label="Téléconseiller">{prospect.ownedByCommercialName}</Ligne>
            <Ligne label="Saisi le">
              <time dateTime={prospect.clientCreatedAt} className="tabular-nums">
                {formatDate(prospect.clientCreatedAt)}
              </time>
            </Ligne>
            <Ligne label="Dernier appel">
              <DernierAppel prospect={prospect} />
            </Ligne>
          </dl>
        </CardContent>
      </Card>

      <ChampsAjoutes prospect={prospect} />

      <Dialog open={conversionOpen} onOpenChange={setConversionOpen}>
        <DialogContent>
          <FormulaireConversion
            prospectId={prospect.id}
            offers={offers}
            onAnnule={() => {
              setConversionOpen(false);
            }}
            onConverti={(saved) => {
              refresh(saved);
              setConversionOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Démonté à la fermeture de la boîte : une nouvelle ouverture repart vide. */
function FormulaireConversion({
  prospectId,
  offers,
  onAnnule,
  onConverti,
}: {
  prospectId: string;
  offers: readonly Offer[];
  onAnnule: () => void;
  onConverti: (prospect: ProspectRow) => void;
}) {
  const aideId = useId();
  const offresActives = offers.filter((offer) => offer.isActive);
  const [offerId, setOfferId] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode | null>(null);
  const [montant, setMontant] = useState<string | null>(null);
  const [dureeMois, setDureeMois] = useState<string | null>(null);

  const conversion = useMutation({
    mutationFn: () => {
      if (offerId === null) throw new Error('Choisissez une offre.');
      return confirmGrandPublicConversion(prospectId, {
        offerId,
        ...(paymentMode === null ? {} : { paymentMode }),
        ...(montant === null ? {} : { amountXof: Number(montant) }),
        ...(dureeMois === null ? {} : { durationMonths: Number(dureeMois) }),
      });
    },
    onSuccess: (saved) => {
      onConverti(saved);
      toast.success(`Conversion de ${saved.prenom} ${saved.nom} confirmée.`);
    },
    onError: (error) => toastApiError(error, 'La conversion n’a pas pu être confirmée.'),
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Confirmer la conversion</DialogTitle>
        <DialogDescription>Associez l’offre retenue et, si connu, son paiement.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <Field label="Offre" required>
          {(props) => (
            <Select
              items={offresActives.map((offer) => ({ value: offer.id, label: offer.label }))}
              value={offerId}
              onValueChange={setOfferId}
            >
              <SelectTrigger id={props.id}>
                <SelectValue placeholder="Choisir une offre" />
              </SelectTrigger>
              <SelectContent>
                {offresActives.map((offer) => (
                  <SelectItem key={offer.id} value={offer.id}>
                    {offer.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label="Mode de paiement">
          {(props) => (
            <Select
              items={PAYMENT_MODES.map((mode) => ({
                value: mode,
                label: PAYMENT_MODE_LABELS[mode],
              }))}
              value={paymentMode}
              onValueChange={(value) => {
                setPaymentMode(value as PaymentMode);
                if (value !== 'ECHELONNE') setDureeMois(null);
              }}
            >
              <SelectTrigger id={props.id}>
                <SelectValue placeholder="Non renseigné" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {PAYMENT_MODE_LABELS[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChampMontant montant={montant} onChange={setMontant} />
          {paymentMode === 'ECHELONNE' ? (
            <Field label="Durée">
              {(props) => (
                <Select
                  items={DUREES_MOIS.map((mois) => ({
                    value: String(mois),
                    label: formatDureeMois(mois),
                  }))}
                  value={dureeMois}
                  onValueChange={setDureeMois}
                >
                  <SelectTrigger id={props.id}>
                    <SelectValue placeholder="Choisir une durée" />
                  </SelectTrigger>
                  <SelectContent>
                    {DUREES_MOIS.map((mois) => (
                      <SelectItem key={mois} value={String(mois)}>
                        {formatDureeMois(mois)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          ) : null}
        </div>
      </div>
      <DialogFooter>
        {offerId === null ? (
          <p id={aideId} className="text-[0.8125rem] text-muted-foreground sm:self-center">
            Choisissez une offre.
          </p>
        ) : null}
        <Button variant="ghost" onClick={onAnnule}>
          Annuler
        </Button>
        <Button
          onClick={() => conversion.mutate()}
          disabled={offerId === null}
          aria-describedby={offerId === null ? aideId : undefined}
          pending={conversion.isPending}
        >
          Confirmer la conversion
        </Button>
      </DialogFooter>
    </>
  );
}

function ChampMontant({
  montant,
  onChange,
}: {
  montant: string | null;
  onChange: (montant: string | null) => void;
}) {
  return (
    <Field label="Montant (F CFA)">
      {(props) => (
        <>
          <Input
            {...props}
            inputMode="numeric"
            autoComplete="off"
            value={montant ?? ''}
            aria-describedby={`${props.id}-apercu`}
            onChange={(event) => {
              onChange(parseMoneyInput(event.target.value));
            }}
          />
          <p
            id={`${props.id}-apercu`}
            aria-live="polite"
            className="text-[0.9375rem] font-[600] tabular-nums"
          >
            {formatXof(montant, '')}
          </p>
        </>
      )}
    </Field>
  );
}
