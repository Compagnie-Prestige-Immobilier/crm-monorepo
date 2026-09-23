'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilIcon, PhoneCallIcon } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { Absent } from '@/components/grand-public/absence';
import { CanalProvenance } from '@/components/grand-public/canal-provenance';
import { DetailBackLink } from '@/components/detail-back-link';
import { EtiquettesStatut } from '@/components/prospects/etiquettes-statut';
import { FicheEnTete } from '@/components/fiche-en-tete';
import { chiffresDe } from '@/components/prospects/prospect-detail-view';
import { AffecterFiche } from '@/components/prospects/affecter-fiche';
import { RequalifierFiche } from '@/components/prospects/requalifier-fiche';
import { ChampsAjoutes } from '@/components/prospects/champs-ajoutes';
import { HistoireDeLaFiche } from '@/components/prospects/histoire-fiche';
import { GrandPublicProspectForm } from '@/components/grand-public/prospect-form';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PROSPECT_TYPE_LABELS,
  confirmGrandPublicConversion,
  formatDureeMois,
  updateGrandPublicConsent,
} from '@/lib/data/grand-public';
import { fetchProspect, fetchProspectParrainage } from '@/lib/data/prospects';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDate, formatDateTime, formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import {
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
  VENDU: 'success',
  PERDU: 'destructive',
};

function Ligne({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-3 last:border-b-0 @md:flex-row @md:items-baseline @md:gap-4">
      <dt className="text-[0.8125rem] font-[600] text-muted-foreground @md:w-48 @md:shrink-0">
        {label}
      </dt>
      <dd className="min-w-0 text-[0.9375rem] [overflow-wrap:anywhere]">{children}</dd>
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

/** Un parrainage Grand Public : jamais chargé avec la fiche, une route à part. */
function SectionParrainage({ prospectId }: { prospectId: string }) {
  const { data } = useQuery({
    queryKey: ['prospects', 'parrainage', prospectId],
    queryFn: () => fetchProspectParrainage(prospectId),
  });
  if (data === undefined) return null;
  return (
    <>
      {data.recommandeParId !== null && (
        <Ligne label="Recommandé par">
          <Link href={`/teleconseil/prospects/${data.recommandeParId}`} className="underline">
            {data.recommandeParNom}
          </Link>
        </Ligne>
      )}
      {data.aRecommande.length > 0 && (
        <Ligne label="A recommandé">
          <span className="flex flex-col gap-1">
            {data.aRecommande.map((filleul) => (
              <Link
                key={filleul.id}
                href={`/teleconseil/prospects/${filleul.id}`}
                className="underline"
              >
                {filleul.nom}
              </Link>
            ))}
          </span>
        </Ligne>
      )}
    </>
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
      <Dialog open={ouverte} onOpenChange={setOuverte}>
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
              embedded
              initial={prospect}
              onSaved={(saved) => {
                onEnregistre(saved);
                setOuverte(false);
              }}
            />
          ) : null}
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

function DernierAppel({ prospect }: { prospect: ProspectRow }) {
  if (prospect.lastReasonLabel === null) return <Absent>Jamais appelé</Absent>;

  return (
    <span className="flex flex-col gap-0.5">
      <span className="font-[600]">{prospect.lastReasonLabel}</span>
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
  role,
}: {
  prospect: ProspectRow;
  offers?: Offer[];
  canEdit?: boolean;
  role: Role;
}) {
  const offers = offersProp ?? [];
  const canEdit = Boolean(canEditProp);
  const queryClient = useQueryClient();
  const [prospect, setProspect] = useState(initialProspect);
  const [conversionOpen, setConversionOpen] = useState(false);
  const [offerId, setOfferId] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode | null>(null);
  const [amountXof, setAmountXof] = useState('');
  const [durationMonths, setDurationMonths] = useState('');
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

  const conversion = useMutation({
    mutationFn: () => {
      if (offerId === null) throw new Error('Choisissez une offre.');
      return confirmGrandPublicConversion(prospect.id, {
        offerId,
        ...(paymentMode === null ? {} : { paymentMode }),
        ...(amountXof === '' ? {} : { amountXof: Number(amountXof) }),
        ...(durationMonths === '' ? {} : { durationMonths: Number(durationMonths) }),
      });
    },
    onSuccess: (saved) => {
      refresh(saved);
      setConversionOpen(false);
      toast.success('Conversion confirmée.');
    },
    onError: (error) => toastApiError(error, 'La conversion n’a pas pu être confirmée.'),
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
          href="/teleconseil/prospects"
          className={cn(buttonVariants({ variant: 'outline' }), 'mt-1')}
        >
          Ouvrir le suivi CHUES
        </Link>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <DetailBackLink href="/teleconseil">Prospects Grand Public</DetailBackLink>

      <FicheEnTete
        nom={`${prospect.prenom} ${prospect.nom}`}
        phoneE164={prospect.phoneE164}
        projet="GRAND_PUBLIC"
        badges={
          <>
            <Badge variant={STATUT_VARIANT[journey.statut]}>
              {PROSPECT_STATUT_LABELS[journey.statut]}
            </Badge>
            <EtiquettesStatut prospect={prospect} />
          </>
        }
        actions={
          <>
            {canEdit ? (
              <Link
                href={`/teleconseil/console?fiche=${encodeURIComponent(prospect.id)}`}
                className={buttonVariants({ variant: 'default' })}
              >
                <PhoneCallIcon aria-hidden="true" />
                Consigner un appel
              </Link>
            ) : null}
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
            <RequalifierFiche
              prospect={prospect}
              projet="GRAND_PUBLIC"
              statut={journey.statut}
              onRequalifiee={refresh}
            />
            <AffecterFiche
              cible="prospect"
              id={prospect.id}
              nom={`${prospect.prenom} ${prospect.nom}`}
              titulaireId={prospect.ownedByCommercialId}
              onAffectee={() => {
                void fetchProspect(prospect.id).then(refresh);
              }}
            />
          </>
        }
        chiffres={chiffresDe(prospect)}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <HistoireDeLaFiche prospect={prospect} role={role} />

        <div className="@container flex min-w-0 flex-col gap-6">
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
                <SectionParrainage prospectId={prospect.id} />
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
                <LigneSi label="Note du classeur" value={prospect.remarqueImport ?? null} />
              </dl>
            </CardContent>
          </Card>

          <ChampsAjoutes prospect={prospect} />
        </div>
      </div>

      <Dialog open={conversionOpen} onOpenChange={setConversionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la conversion</DialogTitle>
            <DialogDescription>
              Associez l’offre retenue et, si connu, son paiement.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="gp-conversion-offer">Offre</Label>
              <Select value={offerId} onValueChange={setOfferId}>
                <SelectTrigger id="gp-conversion-offer">
                  <SelectValue placeholder="Choisir une offre" />
                </SelectTrigger>
                <SelectContent>
                  {offers
                    .filter((offer) => offer.isActive)
                    .map((offer) => (
                      <SelectItem key={offer.id} value={offer.id}>
                        {offer.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="gp-conversion-payment">Mode de paiement</Label>
              <Select
                value={paymentMode}
                onValueChange={(value) => setPaymentMode(value as PaymentMode)}
              >
                <SelectTrigger id="gp-conversion-payment">
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
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="gp-conversion-amount">Montant (F CFA)</Label>
                <Input
                  id="gp-conversion-amount"
                  type="number"
                  min="0"
                  value={amountXof}
                  onChange={(event) => setAmountXof(event.target.value)}
                />
              </div>
              {paymentMode === 'ECHELONNE' ? (
                <div className="grid gap-2">
                  <Label htmlFor="gp-conversion-duration">Durée (mois)</Label>
                  <Input
                    id="gp-conversion-duration"
                    type="number"
                    min="1"
                    max="300"
                    value={durationMonths}
                    onChange={(event) => setDurationMonths(event.target.value)}
                  />
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConversionOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => conversion.mutate()}
              disabled={offerId === null || conversion.isPending}
            >
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
