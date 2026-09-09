import type { UseQueryResult } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronRightIcon } from 'lucide-react';

import { Champ } from '@/components/historique/historique';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PROSPECT_STATUT_LABELS, type PageProspects } from '@/lib/data/grand-public';
import { libelleWhatsapp, type Representant } from '@/lib/data/representants';
import { formatDate, formatPhone } from '@/lib/format';
import { lien } from '@/lib/nav';
import type { Projet } from '@/lib/types';

const SANS_VALEUR = '–';

function ouiNon(valeur: boolean | null): string {
  if (valeur === null) return SANS_VALEUR;
  return valeur ? 'Oui' : 'Non';
}

function ouVide(valeur: string | null, repli: string = SANS_VALEUR): string {
  return valeur === null || valeur === '' ? repli : valeur;
}

export function CarteFiche({ representant }: { representant: Representant }) {
  const notes = representant.notes ?? '';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fiche</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 text-[0.875rem]">
        <section className="flex flex-col gap-2">
          <p className="eyebrow text-muted-foreground">Où il travaille</p>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Champ label="Département">{representant.departementName}</Champ>
            <Champ label="IEF">{ouVide(representant.iefName)}</Champ>
            <Champ label="Établissement">{ouVide(representant.etablissement)}</Champ>
            <Champ label="Syndicat">{ouVide(representant.syndicat)}</Champ>
            <Champ label="Profession">{ouVide(representant.profession, 'Non demandée')}</Champ>
            <Champ label="WhatsApp">{libelleWhatsapp(representant)}</Champ>
          </dl>
        </section>
        <section className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="eyebrow text-muted-foreground">Ce qu’il a dit</p>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Champ label="Déjà contacté">{ouiNon(representant.contacte)}</Champ>
            <Champ label="Connaît l’UES">{ouiNon(representant.connaitUES)}</Champ>
          </dl>
        </section>
        <section className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="eyebrow text-muted-foreground">Saisie</p>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Champ label="Saisi par">{representant.createdByName}</Champ>
            <Champ label="Première saisie">{formatDate(representant.clientCreatedAt)}</Champ>
          </dl>
        </section>
        {notes === '' ? null : (
          <section className="flex flex-col gap-1 border-t border-border pt-4">
            <p className="eyebrow text-muted-foreground">Note de la fiche</p>
            <p className="whitespace-pre-wrap">{notes}</p>
          </section>
        )}
      </CardContent>
    </Card>
  );
}

export function ProspectsApportes({
  projet,
  prospects,
}: {
  projet: Projet;
  prospects: UseQueryResult<PageProspects>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Prospects apportés</CardTitle>
      </CardHeader>
      <CardContent>
        {prospects.isPending ? <Skeleton className="h-24 w-full" /> : null}
        {prospects.isError ? (
          <QueryErrorState
            error={prospects.error}
            onRetry={() => {
              void prospects.refetch();
            }}
            fallback="Les prospects de ce représentant n’ont pas pu être chargés."
          />
        ) : null}
        {prospects.isSuccess && prospects.data.items.length === 0 ? (
          <p className="text-[0.875rem] text-muted-foreground">
            Aucune fiche remise pour l’instant. La dizaine de prospects attendue reste à recueillir.
          </p>
        ) : null}
        {prospects.isSuccess && prospects.data.items.length > 0 ? (
          <ul className="-mx-2 flex flex-col">
            {prospects.data.items.map((prospect) => (
              <li key={prospect.id}>
                <Link
                  {...lien(`/${projet}/prospects/${prospect.id}`)}
                  className="flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="min-w-0 grow">
                    <span className="block truncate text-[0.875rem] font-[600]">
                      {prospect.prenom} {prospect.nom}
                    </span>
                    <span className="block truncate text-[0.75rem] text-muted-foreground tabular-nums">
                      {formatPhone(prospect.phoneE164)}
                    </span>
                  </span>
                  <Badge variant="outline">{PROSPECT_STATUT_LABELS[prospect.statut]}</Badge>
                  <ChevronRightIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
