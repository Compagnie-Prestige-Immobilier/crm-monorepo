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

function NomModele({ modele }: { modele: string }) {
  const separateur = modele.indexOf('/');
  if (separateur === -1) {
    return <span className="font-medium text-foreground">{modele}</span>;
  }
  return (
    <>
      <span className="font-medium text-foreground">{modele.slice(separateur + 1)}</span>
      <span className="ml-1.5 text-xs text-muted-foreground">({modele.slice(0, separateur)})</span>
    </>
  );
}

function Comparaison({ recente }: { recente: Recente }) {
  const reecrit = recente.reformulePar !== null;
  return (
    <li className="border-b border-border/60 last:border-0">
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-2.5 transition-colors hover:bg-secondary/40 [&::-webkit-details-marker]:hidden">
          <ChevronRightIcon
            className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
            {recente.description}
          </span>
          <Badge
            variant={reecrit ? 'secondary' : 'outline'}
            className="hidden sm:inline-flex font-mono text-[11px]"
          >
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
        <div className="grid gap-3 bg-secondary/15 p-4 pt-1 sm:grid-cols-2">
          <figure className="flex flex-col gap-1.5">
            <figcaption className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Saisi par le demandeur
            </figcaption>
            <p className="whitespace-pre-wrap rounded-xl border border-border/70 bg-card p-3 text-xs leading-relaxed text-foreground shadow-2xs">
              {recente.description}
            </p>
          </figure>
          <figure className="flex flex-col gap-1.5">
            <figcaption className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Envoyé à GLPI{reecrit ? ` · ${recente.reformulePar ?? ''}` : ''}
            </figcaption>
            <p className="whitespace-pre-wrap rounded-xl border border-border/70 bg-card p-3 text-xs leading-relaxed text-foreground shadow-2xs">
              {recente.descriptionTransmise}
            </p>
          </figure>
        </div>
      </details>
    </li>
  );
}

export function CarteReformulation({ reformulation }: { reformulation: Reformulation }) {
  const { active, fournisseurs, parModele, recentes } = reformulation;
  const total = parModele.reduce((somme, ligne) => somme + ligne.nombre, 0);
  const origine = parModele.find((ligne) => ligne.modele === '')?.nombre ?? 0;

  return (
    <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2.5 font-display text-xl font-bold tracking-tight text-foreground">
            <SparklesIcon className="size-4 text-primary" aria-hidden="true" />
            Reformulation des signalements
            <Badge
              variant={active ? 'success' : 'secondary'}
              className="rounded-md px-2 py-0.5 text-xs font-semibold"
            >
              {active ? 'Active' : 'Désactivée'}
            </Badge>
          </CardTitle>

          {active && fournisseurs.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {fournisseurs.map((nom) => (
                <Badge
                  key={nom}
                  variant="outline"
                  className="font-mono text-[11px] text-muted-foreground"
                >
                  {nom}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        {!active ? (
          <CardDescription className="text-xs text-muted-foreground">
            Les signalements partent tels que saisis. Activez SUPPORT_AI_ENABLED sur Dokploy pour
            les réécrire.
          </CardDescription>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {total === 0 ? (
          <p className="rounded-xl border border-dashed border-border/70 bg-secondary/30 px-4 py-6 text-center text-xs text-muted-foreground">
            Aucun signalement transmis ces 30 derniers jours.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-[minmax(0,14rem)_1fr] md:items-center">
            <div>
              <p className="font-display text-4xl font-bold tracking-tight text-foreground tabular-nums">
                {pourcent(total - origine, total)} %
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                réécrits par l’IA sur {formatNumber(total)} signalements en 30 jours
              </p>
            </div>
            <ul
              className="flex flex-col gap-3"
              aria-label="Signalements par modèle, 30 derniers jours"
            >
              {parModele.map((ligne) => (
                <li key={ligne.modele} className="flex flex-col gap-1.5">
                  <div className="flex justify-between gap-4 text-xs">
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
                        ligne.modele === '' ? 'bg-muted-foreground/30' : 'bg-primary',
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
          <section className="flex flex-col gap-2.5" aria-labelledby="reformulations-recentes">
            <h2
              id="reformulations-recentes"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Derniers signalements
            </h2>
            <ul className="divide-y divide-border/60 rounded-xl border border-border/80 bg-card overflow-hidden">
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
