'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import Link from 'next/link';

import { QueryErrorState } from '@/components/query-error-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchInscriptionDetail, type InscriptionDetail, type Projet } from '@/lib/data/enrolement';
import { formatDateTime, formatNumber, formatPhone } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

const ABSENT = 'Non renseigné';

function texte(valeur: string | null, format?: (v: string) => string): string {
  if (valeur === null || valeur === '') return ABSENT;
  return format === undefined ? valeur : format(valeur);
}

function ficheProspect(projet: Projet, id: string): string {
  return projet === 'GRAND_PUBLIC' ? `/grand-public/${id}` : `/chues/prospects/${id}`;
}

function Ligne({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-1.5 text-[0.875rem] last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right">{children}</span>
    </div>
  );
}

function Normalise({
  detail,
  libelles,
}: {
  detail: InscriptionDetail;
  libelles: Map<string, string>;
}) {
  return (
    <div className="flex flex-col">
      <Ligne label="Identifiant dans le CRM">{detail.id}</Ligne>
      <Ligne label="Projet">{detail.projet}</Ligne>
      <Ligne label="Identifiant sur la plateforme">{detail.identifiantDistant}</Ligne>
      <Ligne label="Nom">{texte(detail.nom)}</Ligne>
      <Ligne label="Prénom">{texte(detail.prenom)}</Ligne>
      <Ligne label="Téléphone">
        {detail.phoneE164 === null ? ABSENT : formatPhone(detail.phoneE164)}
      </Ligne>
      <Ligne label="Courriel">{texte(detail.email)}</Ligne>
      <Ligne label="Statut">{libelles.get(detail.statutDistant) ?? detail.statutDistant}</Ligne>
      <Ligne label="Étape">{detail.etapeDistante ?? ABSENT}</Ligne>
      <Ligne label="Inscription">{texte(detail.inscriteLe, formatDateTime)}</Ligne>
      <Ligne label="Dossier soumis">{texte(detail.soumiseLe, formatDateTime)}</Ligne>
      <Ligne label="Décision">{texte(detail.decideeLe, formatDateTime)}</Ligne>
      <Ligne label="Dernier tirage">{formatDateTime(detail.dernierTirageAt)}</Ligne>
      <Ligne label="Prospect du CRM">
        {detail.prospectId === null ? (
          'Non rapproché'
        ) : (
          <Link
            href={ficheProspect(detail.projet, detail.prospectId)}
            className="underline underline-offset-4"
          >
            Ouvrir la fiche
          </Link>
        )}
      </Ligne>
      <Ligne label="Retirée de la plateforme">{texte(detail.disparueLe, formatDateTime)}</Ligne>
    </div>
  );
}

function scalaire(valeur: unknown): string | null {
  if (valeur === null) return ABSENT;
  if (typeof valeur === 'string') return valeur === '' ? ABSENT : valeur;
  if (typeof valeur === 'number') return String(valeur);
  if (typeof valeur === 'boolean') return valeur ? 'Oui' : 'Non';
  return null;
}

/** Une adresse signée fait sept cents caractères : la ligne reste lisible, la valeur reste entière. */
function Adresse({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title={url}
      className="block truncate underline underline-offset-4"
    >
      {url}
    </a>
  );
}

function Champ({ cle, valeur }: { cle: string; valeur: unknown }) {
  const texte = scalaire(valeur);
  if (texte === null) return <Bloc titre={cle} valeur={valeur} />;
  return (
    <Ligne label={cle}>
      {typeof valeur === 'string' && valeur.startsWith('http') ? <Adresse url={valeur} /> : texte}
    </Ligne>
  );
}

/**
 * La plateforme Grand Public ne décrit pas sa réponse : aucun champ n'est
 * renommé, écarté ni reformulé ici, seule la disposition change.
 */
function Bloc({ titre, valeur }: { titre: string; valeur: unknown }) {
  const elements = Array.isArray(valeur) ? valeur : null;

  return (
    <section className="rounded-md border border-border/60 p-3">
      <p className="text-[0.75rem] font-[600] uppercase tracking-wide text-muted-foreground">
        {titre}
        {elements === null ? null : (
          <span className="ml-2 font-[400] tabular-nums">{formatNumber(elements.length)}</span>
        )}
      </p>

      {elements === null ? (
        <div className="mt-1 flex flex-col">
          {Object.entries(valeur as Record<string, unknown>).map(([cle, sous]) => (
            <Champ key={cle} cle={cle} valeur={sous} />
          ))}
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          {elements.map((element, rang) => (
            <div
              key={rang}
              className="rounded-md bg-secondary/40 p-3 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-border/60"
            >
              {typeof element === 'object' && element !== null ? (
                Object.entries(element as Record<string, unknown>).map(([cle, sous]) => (
                  <Champ key={cle} cle={cle} valeur={sous} />
                ))
              ) : (
                <Ligne label={`#${String(rang + 1)}`}>{scalaire(element) ?? ''}</Ligne>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ChargeUtile({ charge }: { charge: unknown }) {
  if (typeof charge !== 'object' || charge === null) return null;
  const entrees = Object.entries(charge as Record<string, unknown>);
  const scalaires = entrees.filter(([, valeur]) => scalaire(valeur) !== null);
  const composes = entrees.filter(([, valeur]) => scalaire(valeur) === null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col">
        {scalaires.map(([cle, valeur]) => (
          <Champ key={cle} cle={cle} valeur={valeur} />
        ))}
      </div>
      {composes.map(([cle, valeur]) => (
        <Bloc key={cle} titre={cle} valeur={valeur} />
      ))}
    </div>
  );
}

function Corps({
  etat,
  libelles,
}: {
  etat: UseQueryResult<InscriptionDetail>;
  libelles: Map<string, string>;
}) {
  if (etat.isError) {
    return (
      <QueryErrorState
        error={etat.error}
        onRetry={() => void etat.refetch()}
        fallback="Le détail de cette inscription n’a pas pu être chargé."
      />
    );
  }
  if (etat.data === undefined) return <Skeleton className="h-64 w-full rounded-md" />;

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <div className="flex flex-col gap-2">
        <p className="text-[0.75rem] font-[600] uppercase tracking-wide text-muted-foreground">
          Ce que le CRM a retenu
        </p>
        <Normalise detail={etat.data} libelles={libelles} />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-[0.75rem] font-[600] uppercase tracking-wide text-muted-foreground">
          Ce que la plateforme envoie
        </p>
        <ChargeUtile charge={etat.data.chargeUtile} />
      </div>
    </div>
  );
}

export function DetailInscription({
  projet,
  id,
  libelles,
  onClose,
}: {
  projet: Projet;
  id: string | null;
  libelles: Map<string, string>;
  onClose: () => void;
}) {
  const detail = useQuery({
    queryKey: queryKeys.enrolementInscription(projet, id ?? ''),
    queryFn: () => fetchInscriptionDetail(projet, id ?? ''),
    enabled: id !== null,
  });

  return (
    <Dialog
      open={id !== null}
      onOpenChange={(ouvert) => {
        if (!ouvert) onClose();
      }}
    >
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {detail.data === undefined
              ? 'Inscription'
              : `${detail.data.prenom} ${detail.data.nom}`.trim()}
          </DialogTitle>
          <DialogDescription>
            Lecture seule. Rien de ce qui est affiché ici n’est écrit sur la plateforme.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          <Corps etat={detail} libelles={libelles} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
