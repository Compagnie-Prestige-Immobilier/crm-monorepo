import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeftIcon, PhoneIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ConversionDialogue } from '@/components/grand-public/conversion-dialogue';
import { FicheActions } from '@/components/grand-public/fiche-actions';
import {
  ChampsAjoutes,
  DernierAppel,
  Ligne,
  LignesSituation,
  Texte,
  ligneDureeSysteme,
  lignePaiement,
  ligneSegment,
  ligneSituation,
} from '@/components/grand-public/fiche-lignes';
import { ProspectFormulaire } from '@/components/grand-public/prospect-formulaire';
import { QueryErrorState } from '@/components/query-error-state';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchChampsConversion } from '@/lib/data/champs-conversion';
import { fetchProspect, type Prospect } from '@/lib/data/console';
import { majConsentement, type Consentement } from '@/lib/data/grand-public';
import { REFERENTIELS_STALE_MS, fetchReferentiels } from '@/lib/data/referentiels';
import { formatDate, formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';

const PEUT_MODIFIER: readonly Role[] = ['ADMIN', 'COMMERCIAL'];

export function ProspectFiche({ id, role }: { id: string; role: Role }) {
  const queryClient = useQueryClient();
  const [modification, setModification] = useState(false);
  const [conversion, setConversion] = useState(false);

  const fiche = useQuery({
    queryKey: queryKeys.prospect(id),
    queryFn: () => fetchProspect(id),
  });

  const referentiels = useQuery({
    queryKey: queryKeys.referentielsRoot,
    queryFn: () => fetchReferentiels(),
    staleTime: REFERENTIELS_STALE_MS,
  });

  const formulaire = useQuery({
    queryKey: queryKeys.champsConversion('grand-public'),
    queryFn: () => fetchChampsConversion('GRAND_PUBLIC'),
    staleTime: REFERENTIELS_STALE_MS,
  });

  const rafraichir = (enregistre: Prospect): void => {
    queryClient.setQueryData(queryKeys.prospect(id), enregistre);
    void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
  };

  const consentement = useMutation({
    mutationFn: (valeur: Consentement) => majConsentement(id, valeur),
    onSuccess: (enregistre) => {
      rafraichir(enregistre);
      toast.success('Consentement enregistré.');
    },
    onError: (error) => {
      toastApiError(error, 'Le consentement n’a pas pu être enregistré.');
    },
  });

  if (fiche.isPending) return <Skeleton className="h-96 w-full" />;

  if (fiche.isError) {
    return (
      <QueryErrorState
        error={fiche.error}
        onRetry={() => {
          void fiche.refetch();
        }}
        fallback="Cette fiche n’a pas pu être chargée."
      />
    );
  }

  const prospect = fiche.data;
  const parcours = prospect.journeys?.find((item) => item.projet === 'GRAND_PUBLIC');

  if (parcours === undefined) {
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
          to="/$projet/prospects"
          params={{ projet: 'chues' }}
          className={cn(buttonVariants({ variant: 'outline' }), 'mt-1')}
        >
          Ouvrir le suivi CHUES
        </Link>
      </Card>
    );
  }

  const peutModifier = PEUT_MODIFIER.includes(role);
  const libres = (formulaire.data?.libres ?? []).filter(
    (champ) => (prospect.champsLibres[champ.id] ?? '') !== '',
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Link
        to="/$projet"
        params={{ projet: 'grand-public' }}
        className={cn(buttonVariants({ variant: 'ghost' }), '-ml-2 w-fit')}
      >
        <ArrowLeftIcon aria-hidden="true" />
        Prospects Grand Public
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-h2 font-[700] tracking-[-0.02em]">
            {`${prospect.prenom} ${prospect.nom}`.trim()}
          </h1>
          <a
            href={`tel:${prospect.phoneE164}`}
            className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-sm text-[1.0625rem] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <PhoneIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            {formatPhone(prospect.phoneE164)}
          </a>
        </div>
        <FicheActions
          parcours={parcours}
          peutModifier={peutModifier}
          enCours={consentement.isPending}
          onModifier={() => {
            setModification(true);
          }}
          onConsentement={(valeur) => {
            consentement.mutate(valeur);
          }}
          onConvertir={() => {
            setConversion(true);
          }}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Le prospect</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <Ligne label="Situation">{ligneSituation(prospect)}</Ligne>
            <Ligne label={prospect.type === 'INFORMEL' ? 'Activité' : 'Profession'}>
              <Texte value={prospect.profession} absent="Non renseignée" />
            </Ligne>
            <Ligne label="Revenu mensuel">
              <Texte value={prospect.incomeBandLabel} absent="Non renseigné" />
            </Ligne>
            <Ligne label="Paiement">{lignePaiement(prospect)}</Ligne>
            <LignesSituation prospect={prospect} />
            <Ligne label="Canal de provenance">
              <Texte value={prospect.canalProvenanceLabel} absent="Non renseigné" />
            </Ligne>
            <Ligne label="Durée du système">{ligneDureeSysteme(prospect)}</Ligne>
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
            <Ligne label="Segment">{ligneSegment(prospect)}</Ligne>
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
              <time dateTime={prospect.clientCreatedAt}>
                {formatDate(prospect.clientCreatedAt)}
              </time>
            </Ligne>
            <Ligne label="Dernier appel">
              <DernierAppel prospect={prospect} />
            </Ligne>
          </dl>
        </CardContent>
      </Card>

      <ChampsAjoutes champs={libres} reponses={prospect.champsLibres} />

      <Dialog open={modification} onOpenChange={setModification}>
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
          {modification ? (
            <ProspectFormulaire
              embarque
              initial={prospect}
              onEnregistre={(enregistre) => {
                rafraichir(enregistre);
                setModification(false);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ConversionDialogue
        prospectId={prospect.id}
        offres={referentiels.data?.offers}
        ouverte={conversion}
        onOuverte={setConversion}
        onConvertie={rafraichir}
      />
    </div>
  );
}
