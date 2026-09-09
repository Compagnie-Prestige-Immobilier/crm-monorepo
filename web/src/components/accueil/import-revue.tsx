import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useId } from 'react';

import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ChangementRegistre, TravailRegistre } from '@/lib/data/visites-import';
import { differences } from '@/lib/data/visites-import';
import { formatNumber } from '@/lib/format';

export interface Choisies {
  creations: number;
  corrections: number;
}

export function libelleApplication(choisies: Choisies): string {
  if (choisies.creations === 0 && choisies.corrections === 0) return 'Rien à appliquer';
  const morceaux: string[] = [];
  if (choisies.corrections > 0) {
    morceaux.push(
      `${formatNumber(choisies.corrections)} correction${choisies.corrections > 1 ? 's' : ''}`,
    );
  }
  if (choisies.creations > 0) {
    morceaux.push(
      `${formatNumber(choisies.creations)} création${choisies.creations > 1 ? 's' : ''}`,
    );
  }
  return `Appliquer ${morceaux.join(' et ')}`;
}

function LigneChangement({
  changement,
  onBasculer,
}: {
  changement: ChangementRegistre;
  onBasculer: (choisie: boolean) => void;
}) {
  const caseId = useId();

  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <input
        id={caseId}
        type="checkbox"
        className="mt-1 size-4 accent-[var(--primary)]"
        checked={changement.selected}
        onChange={(event) => {
          onBasculer(event.target.checked);
        }}
      />
      <label htmlFor={caseId} className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-2 text-[0.9375rem]">
          <span className="font-[600]">{changement.label}</span>
          <Badge variant={changement.kind === 'CREATE' ? 'success' : 'info'}>
            {changement.kind === 'CREATE' ? 'Création' : 'Correction'}
          </Badge>
          <span className="text-[0.8125rem] text-muted-foreground">
            ligne {changement.rowNumber}
          </span>
        </span>
        {(changement.fields ?? []).map((champ) => (
          <span key={champ.field} className="text-[0.8125rem] text-muted-foreground">
            {champ.label} : « {champ.before} » → « {champ.after} »
          </span>
        ))}
      </label>
    </li>
  );
}

interface MetaRevue {
  page: number;
  pageCount: number;
  total: number;
}

function PaginationRevue({ meta, onPage }: { meta: MetaRevue; onPage: (page: number) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4">
      <p className="text-[0.8125rem] text-muted-foreground" role="status">
        {formatNumber(meta.total)} différence{meta.total > 1 ? 's' : ''}
      </p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Page précédente"
          disabled={meta.page <= 1}
          onClick={() => {
            onPage(meta.page - 1);
          }}
        >
          <ChevronLeftIcon className="size-4" aria-hidden="true" />
        </Button>
        <span className="min-w-20 text-center text-[0.8125rem] tabular-nums">
          {meta.page} / {Math.max(1, meta.pageCount)}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Page suivante"
          disabled={meta.page >= meta.pageCount}
          onClick={() => {
            onPage(meta.page + 1);
          }}
        >
          <ChevronRightIcon className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

export function ImportRevue({
  travail,
  items,
  meta,
  chargement,
  erreur,
  onReessayer,
  onPage,
  onBasculer,
  onToutCocher,
  toutPending,
  choisies,
  peutAppliquer,
  onAppliquer,
}: {
  travail: TravailRegistre;
  items: readonly ChangementRegistre[] | undefined;
  meta: MetaRevue | undefined;
  chargement: boolean;
  erreur: unknown;
  onReessayer: () => void;
  onPage: (page: number) => void;
  onBasculer: (changement: ChangementRegistre, choisie: boolean) => void;
  onToutCocher: (choisie: boolean) => void;
  toutPending: boolean;
  choisies: Choisies;
  peutAppliquer: boolean;
  onAppliquer: () => void;
}) {
  const total = differences(travail);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[1.0625rem]">4. Revue</CardTitle>
        <CardDescription>
          {formatNumber(total)} différence{total > 1 ? 's' : ''},{' '}
          {formatNumber(travail.updatedRows)} correction{travail.updatedRows > 1 ? 's' : ''},{' '}
          {formatNumber(travail.createdRows)} création{travail.createdRows > 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-0">
        <div className="flex flex-wrap items-center gap-2 px-5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={toutPending}
            onClick={() => {
              onToutCocher(true);
            }}
          >
            Tout cocher
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={toutPending}
            onClick={() => {
              onToutCocher(false);
            }}
          >
            Tout décocher
          </Button>
        </div>

        {erreur !== null && erreur !== undefined ? (
          <div className="px-5">
            <QueryErrorState
              error={erreur}
              onRetry={onReessayer}
              fallback="La revue n’a pas pu être chargée."
              className="items-center gap-3 border-destructive/30 px-6 py-12 text-center"
            />
          </div>
        ) : null}

        {chargement && items === undefined ? (
          <div className="flex flex-col gap-2 px-5">
            {[0, 1, 2].map((rang) => (
              <Skeleton key={rang} className="h-16 w-full" />
            ))}
          </div>
        ) : null}

        {items === undefined || meta === undefined ? null : (
          <>
            <ul className="flex flex-col divide-y divide-border">
              {items.map((changement) => (
                <LigneChangement
                  key={changement.id}
                  changement={changement}
                  onBasculer={(choisie) => {
                    onBasculer(changement, choisie);
                  }}
                />
              ))}
            </ul>

            <PaginationRevue meta={meta} onPage={onPage} />
          </>
        )}

        <div className="border-t border-border px-5 py-4">
          <Button type="button" disabled={!peutAppliquer} onClick={onAppliquer}>
            {libelleApplication(choisies)}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
