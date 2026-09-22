import { ChevronRightIcon, SparklesIcon } from 'lucide-react';

import { type components } from '@/api/compat/serveur';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ilYA } from '@/lib/data/kairo';
import { formatDateTime, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

type Reformulation = components['schemas']['ReformulationIA'];
type Recente = components['schemas']['ReformulationRecente'];

function pourcent(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

export function CarteReformulation({ reformulation }: { reformulation: Reformulation }) {
  const { active, fournisseurs, parModele, recentes } = reformulation;
  const total = parModele.reduce((somme, ligne) => somme + ligne.nombre, 0);
  const origine = parModele.find((ligne) => ligne.modele === '')?.nombre ?? 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <SparklesIcon className="size-5 text-primary" aria-hidden="true" />
          Reformulation des signalements
          <Badge variant={active ? 'success' : 'secondary'}>
            {active ? 'Active' : 'Désactivée'}
          </Badge>
        </CardTitle>
        {active ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {fournisseurs.length === 0 ? (
              <Badge variant="destructive">Aucune clé de fournisseur</Badge>
            ) : (
              fournisseurs.map((nom) => (
                <Badge key={nom} variant="outline">
                  {nom}
                </Badge>
              ))
            )}
          </div>
        ) : (
          <CardDescription>
            Les signalements partent tels que saisis. Activez SUPPORT_AI_ENABLED sur Dokploy pour
            les réécrire.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-8">
        {total === 0 ? (
          <p className="rounded-md bg-secondary px-4 py-6 text-center text-sm text-muted-foreground">
            Aucun signalement transmis ces 30 derniers jours.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-[minmax(0,14rem)_1fr] md:items-center">
            <div>
              <p className="font-display text-[2.5rem] font-[800] leading-none tracking-[-0.02em] tabular-nums">
                {pourcent(total - origine, total)} %
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                réécrits par l’IA sur {formatNumber(total)} signalements en 30 jours
              </p>
            </div>
            <ul
              className="flex flex-col gap-3"
              aria-label="Signalements par modèle, 30 derniers jours"
            >
              {parModele.map((ligne) => (
                <li key={ligne.modele} className="flex flex-col gap-1">
                  <div className="flex justify-between gap-4 text-sm">
                    <span
                      className={cn('truncate', ligne.modele === '' && 'text-muted-foreground')}
                    >
                      {ligne.modele === '' ? (
                        'Texte d’origine, sans IA'
                      ) : (
                        <NomModele modele={ligne.modele} />
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatNumber(ligne.nombre)} · {pourcent(ligne.nombre, total)} %
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        ligne.modele === '' ? 'bg-muted-foreground/40' : 'bg-primary',
                      )}
                      style={{ width: `${String(Math.max(pourcent(ligne.nombre, total), 2))}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {recentes.length > 0 ? (
          <section className="flex flex-col gap-2" aria-labelledby="reformulations-recentes">
            <h3 id="reformulations-recentes" className="text-sm font-[600]">
              Derniers signalements
            </h3>
            <ul className="divide-y rounded-md border">
              {recentes.map((recente) => (
                <Comparaison key={recente.id} recente={recente} />
              ))}
            </ul>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}

function NomModele({ modele }: { modele: string }) {
  const separateur = modele.indexOf('/');
  return (
    <>
      {modele.slice(separateur + 1)}
      <span className="ml-2 text-muted-foreground">{modele.slice(0, separateur)}</span>
    </>
  );
}

function Comparaison({ recente }: { recente: Recente }) {
  const reecrit = recente.reformulePar !== null;
  return (
    <li>
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-2 hover:bg-secondary/60 [&::-webkit-details-marker]:hidden">
          <ChevronRightIcon
            className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate text-sm">{recente.description}</span>
          <Badge variant={reecrit ? 'info' : 'secondary'} className="hidden sm:inline-flex">
            {recente.reformulePar ?? 'Texte d’origine'}
          </Badge>
          <time
            dateTime={recente.creeLe}
            title={formatDateTime(recente.creeLe)}
            className="shrink-0 text-xs text-muted-foreground tabular-nums"
          >
            {ilYA(recente.creeLe)}
          </time>
        </summary>
        <div className="grid gap-4 px-4 pb-4 pt-1 md:grid-cols-2">
          <figure className="flex flex-col gap-1.5">
            <figcaption className="text-xs font-[600] uppercase tracking-wide text-muted-foreground">
              Saisi par le demandeur
            </figcaption>
            <p className="whitespace-pre-wrap rounded-md bg-secondary p-3 text-sm">
              {recente.description}
            </p>
          </figure>
          <figure className="flex flex-col gap-1.5">
            <figcaption className="text-xs font-[600] uppercase tracking-wide text-muted-foreground">
              Envoyé à GLPI{reecrit ? ` · ${recente.reformulePar ?? ''}` : ''}
            </figcaption>
            <p
              className={cn(
                'whitespace-pre-wrap rounded-md p-3 text-sm',
                reecrit ? 'border border-info/30 bg-info-surface' : 'bg-secondary',
              )}
            >
              {recente.descriptionTransmise}
            </p>
          </figure>
        </div>
      </details>
    </li>
  );
}
