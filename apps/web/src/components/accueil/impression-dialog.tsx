'use client';

import { PrinterIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  IMPRESSION_COLONNES,
  IMPRESSION_COLONNES_VERROUILLEES,
  VISITE_COLONNES,
  dakarNow,
  fetchVisites,
  impressionColonneVisible,
  toggleImpressionColonne,
  type ImpressionColonne,
  type Visite,
  type VisiteFilters,
} from '@/lib/data/visites';
import { formatDate, formatNumber } from '@/lib/format';

/** L'API plafonne `pageSize` à 200 : au-delà, il faut plusieurs requêtes. */
const TAILLE_PAGE_IMPRESSION = 200;
/** Estimation pour l'affichage seulement, la mise en page réelle dépend du navigateur. */
const LIGNES_PAR_PAGE_PAPIER = 45;
const PLAFOND_IMPRESSION_TOTALE = 3000;

function pagesEnviron(lignes: number): number {
  return Math.max(1, Math.ceil(lignes / LIGNES_PAR_PAGE_PAPIER));
}

function periodeTexte(filters: VisiteFilters, today: string): string {
  if (filters.dateFrom !== null && filters.dateTo !== null) {
    return `Du ${formatDate(filters.dateFrom)} au ${formatDate(filters.dateTo)}`;
  }
  if (filters.dateFrom !== null) return `À partir du ${formatDate(filters.dateFrom)}`;
  if (filters.dateTo !== null) return `Jusqu’au ${formatDate(filters.dateTo)}`;
  if (filters.toutePeriode) return 'Tout le registre';
  return `Le ${formatDate(today)}`;
}

export function ImpressionDialog({
  open,
  onOpenChange,
  orientation,
  onOrientationChange,
  colonnesImprimees,
  onColonnesImpriméesChange,
  filters,
  today,
  total,
  pageItemsCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orientation: 'landscape' | 'portrait';
  onOrientationChange: (value: 'landscape' | 'portrait') => void;
  colonnesImprimees: ReadonlySet<ImpressionColonne>;
  onColonnesImpriméesChange: (next: ReadonlySet<ImpressionColonne>) => void;
  filters: VisiteFilters;
  today: string;
  total: number;
  pageItemsCount: number;
}) {
  const [portee, setPortee] = useState<'page' | 'tout'>('page');
  const [chargement, setChargement] = useState<{ chargees: number; pages: number } | null>(null);
  const [toutesLesVisites, setToutesLesVisites] = useState<Visite[] | null>(null);
  const annulerRef = useRef(false);

  const depasseLePlafond = total > PLAFOND_IMPRESSION_TOTALE;

  // `window.print()` photographie le DOM tel qu'il est déjà peint : appelé
  // avant que React n'ait commité le tableau complet, il n'imprime que ce qui
  // était affiché avant, sans erreur ni indice.
  useEffect(() => {
    if (toutesLesVisites === null) return;
    const frame = requestAnimationFrame(() => {
      window.print();
    });
    const surApresImpression = (): void => {
      setToutesLesVisites(null);
    };
    window.addEventListener('afterprint', surApresImpression);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', surApresImpression);
    };
  }, [toutesLesVisites]);

  async function chargerToutEtImprimer(): Promise<void> {
    annulerRef.current = false;
    // Lu via une fonction : `.current` mute pendant les `await` qui suivent,
    // ce qu'une lecture directe empêcherait TypeScript de voir.
    const estAnnule = (): boolean => annulerRef.current;
    const pages = Math.max(1, Math.ceil(total / TAILLE_PAGE_IMPRESSION));
    setChargement({ chargees: 0, pages });

    const toutes: Visite[] = [];
    for (let page = 1; page <= pages; page += 1) {
      if (estAnnule()) {
        setChargement(null);
        return;
      }
      const reponse = await fetchVisites(
        { ...filters, page, pageSize: TAILLE_PAGE_IMPRESSION },
        today,
      );
      toutes.push(...reponse.items);
      setChargement({ chargees: page, pages });
    }

    if (estAnnule()) {
      setChargement(null);
      return;
    }
    setChargement(null);
    onOpenChange(false);
    setToutesLesVisites(toutes);
  }

  function ouvrir(): void {
    if (portee === 'tout') {
      void chargerToutEtImprimer();
      return;
    }
    onOpenChange(false);
    window.print();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Préparer l’impression</DialogTitle>
            <DialogDescription>
              Les filtres et la période affichés seront conservés.
            </DialogDescription>
          </DialogHeader>

          {chargement !== null ? (
            <div className="flex flex-col gap-3">
              <p className="text-[0.875rem]">
                Chargement des visites… page {chargement.chargees} sur {chargement.pages}
              </p>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={chargement.pages}
                aria-valuenow={chargement.chargees}
                className="h-2 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full bg-primary transition-[width] duration-(--dur-1)"
                  style={{ width: `${String((chargement.chargees / chargement.pages) * 100)}%` }}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  annulerRef.current = true;
                }}
              >
                Annuler
              </Button>
            </div>
          ) : (
            <>
              <fieldset className="flex flex-col gap-2">
                <legend className="pb-1 text-[0.8125rem] font-[600]">Quoi imprimer</legend>
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${
                    portee === 'page' ? 'border-primary bg-secondary' : 'border-border'
                  }`}
                >
                  <input
                    type="radio"
                    name="portee-impression"
                    checked={portee === 'page'}
                    className="mt-0.5 size-4 accent-[var(--primary)]"
                    onChange={() => {
                      setPortee('page');
                    }}
                  />
                  <span>
                    <span className="block text-[0.875rem] font-[600]">La page affichée</span>
                    <span className="block text-[0.75rem] text-muted-foreground">
                      {formatNumber(pageItemsCount)} visites, environ{' '}
                      {formatNumber(pagesEnviron(pageItemsCount))} pages
                    </span>
                  </span>
                </label>
                <label
                  className={`flex items-start gap-3 rounded-md border p-3 ${
                    depasseLePlafond
                      ? 'cursor-not-allowed opacity-50'
                      : 'cursor-pointer' +
                        (portee === 'tout' ? ' border-primary bg-secondary' : ' border-border')
                  }`}
                >
                  <input
                    type="radio"
                    name="portee-impression"
                    disabled={depasseLePlafond}
                    checked={portee === 'tout'}
                    className="mt-0.5 size-4 accent-[var(--primary)]"
                    onChange={() => {
                      setPortee('tout');
                    }}
                  />
                  <span>
                    <span className="block text-[0.875rem] font-[600]">
                      Tout le résultat filtré
                    </span>
                    <span className="block text-[0.75rem] text-muted-foreground">
                      {formatNumber(total)} visites, environ {formatNumber(pagesEnviron(total))}{' '}
                      pages
                    </span>
                  </span>
                </label>
                {depasseLePlafond ? (
                  <p role="alert" className="text-[0.8125rem] text-destructive">
                    {formatNumber(total)} visites : trop pour une impression. Réduisez la période,
                    ou exportez en Excel.
                  </p>
                ) : null}
              </fieldset>

              <fieldset className="flex flex-col gap-2">
                <legend className="pb-1 text-[0.8125rem] font-[600]">Orientation</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      ['landscape', 'Paysage', 'Recommandé pour toutes les colonnes'],
                      ['portrait', 'Portrait', 'Pour une liste plus étroite'],
                    ] as const
                  ).map(([value, label, description]) => (
                    <label
                      key={value}
                      className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${
                        orientation === value ? 'border-primary bg-secondary' : 'border-border'
                      }`}
                    >
                      <input
                        type="radio"
                        name="orientation-impression"
                        value={value}
                        checked={orientation === value}
                        className="mt-0.5 size-4 accent-[var(--primary)]"
                        onChange={() => {
                          onOrientationChange(value);
                        }}
                      />
                      <span>
                        <span className="block text-[0.875rem] font-[600]">{label}</span>
                        <span className="block text-[0.75rem] text-muted-foreground">
                          {description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="flex flex-col gap-2">
                <legend className="pb-1 text-[0.8125rem] font-[600]">Colonnes</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {IMPRESSION_COLONNES.map((colonne) => {
                    const verrouillee = IMPRESSION_COLONNES_VERROUILLEES.includes(colonne);
                    return (
                      <label
                        key={colonne}
                        className="flex min-h-11 items-center gap-3 rounded-md border border-border p-3 text-[0.8125rem]"
                      >
                        <input
                          type="checkbox"
                          checked={colonnesImprimees.has(colonne)}
                          disabled={verrouillee}
                          className="size-4 accent-[var(--primary)] disabled:opacity-40"
                          onChange={() => {
                            onColonnesImpriméesChange(
                              toggleImpressionColonne(colonnesImprimees, colonne),
                            );
                          }}
                        />
                        {colonne}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                  }}
                >
                  Annuler
                </Button>
                <Button type="button" onClick={ouvrir}>
                  <PrinterIcon aria-hidden="true" />
                  Ouvrir l’impression
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Hors du dialogue : fermer le dialogue avant d'imprimer démonterait ce
          tableau avec lui. Masqué à l'écran, visible seulement à l'impression. */}
      {toutesLesVisites === null ? null : (
        <div className="hidden print:block">
          <p className="mb-1 font-[700]">Registre des visites : {periodeTexte(filters, today)}</p>
          <p className="mb-3 text-[0.75rem]">
            {formatNumber(toutesLesVisites.length)} visites · imprimé le{' '}
            {formatDate(dakarNow().date)}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                {IMPRESSION_COLONNES.map((colonne) =>
                  impressionColonneVisible(colonne, colonnesImprimees) ? (
                    <TableHead key={colonne}>{colonne}</TableHead>
                  ) : null,
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {toutesLesVisites.map((visite) => (
                <TableRow key={visite.id}>
                  {impressionColonneVisible('N° REGISTRE', colonnesImprimees) ? (
                    <TableCell className="font-[600] whitespace-nowrap">
                      {visite.reference}
                    </TableCell>
                  ) : null}
                  {impressionColonneVisible(VISITE_COLONNES.date, colonnesImprimees) ? (
                    <TableCell className="whitespace-nowrap">{formatDate(visite.date)}</TableCell>
                  ) : null}
                  {impressionColonneVisible(VISITE_COLONNES.time, colonnesImprimees) ? (
                    <TableCell className="whitespace-nowrap">{visite.time ?? ''}</TableCell>
                  ) : null}
                  {impressionColonneVisible(VISITE_COLONNES.visitorName, colonnesImprimees) ? (
                    <TableCell className="font-[600]">{visite.visitorName}</TableCell>
                  ) : null}
                  {impressionColonneVisible(VISITE_COLONNES.phone, colonnesImprimees) ? (
                    <TableCell className="whitespace-nowrap">{visite.phone ?? ''}</TableCell>
                  ) : null}
                  {impressionColonneVisible(VISITE_COLONNES.entreprise, colonnesImprimees) ? (
                    <TableCell>{visite.entreprise.label}</TableCell>
                  ) : null}
                  {impressionColonneVisible(VISITE_COLONNES.direction, colonnesImprimees) ? (
                    <TableCell>{visite.direction?.label ?? ''}</TableCell>
                  ) : null}
                  {impressionColonneVisible(VISITE_COLONNES.destinataire, colonnesImprimees) ? (
                    <TableCell>{visite.destinataire?.label ?? ''}</TableCell>
                  ) : null}
                  {impressionColonneVisible(VISITE_COLONNES.objet, colonnesImprimees) ? (
                    <TableCell>{visite.objet.label}</TableCell>
                  ) : null}
                  {impressionColonneVisible(VISITE_COLONNES.comment, colonnesImprimees) ? (
                    <TableCell className="max-w-[20rem]">{visite.comment ?? ''}</TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
