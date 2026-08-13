'use client';

import { ChevronDownIcon, FileSpreadsheetIcon, LayersIcon, LoaderIcon } from 'lucide-react';

import { useFileDownload } from '@/components/exports/download-button';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { buildExportUrl, exportFileName } from '@/lib/data/export';
import { countActiveFilters } from '@/lib/filters';
import type { ProspectFilters } from '@/lib/types';

/**
 * Menu d'export des prospects. Deux fichiers, deux usages, et la différence
 * est écrite dans le menu plutôt que devinée.
 *
 * — « Exporter la vue filtrée » suit EXACTEMENT les critères de l'écran. C'est
 *   ce qu'un administrateur envoie pour justifier un chiffre qu'il vient de
 *   lire.
 * — « Classeur consolidé BDD1–BDD4 » produit toujours les cinq mêmes feuilles.
 *   C'est le document de référence mensuel : sa forme ne doit pas dépendre de
 *   ce qui était filtré à l'écran, sinon deux exports du même mois ne se
 *   comparent plus. Le critère de segment y est donc retiré, et le menu le dit.
 *
 * Un seul bouton qui aurait fait « l'un ou l'autre selon le contexte » aurait
 * produit, un jour, un classeur consolidé amputé de trois feuilles.
 */
export function ProspectExportMenu({ filters }: { filters: ProspectFilters }) {
  const { pending, download } = useFileDownload();
  const activeCount = countActiveFilters(filters);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={pending}>
          {pending ? (
            <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileSpreadsheetIcon aria-hidden="true" />
          )}
          Exporter
          <ChevronDownIcon className="size-4 opacity-60" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Export Excel</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="items-start gap-3 py-2.5"
          onSelect={() => {
            void download({
              url: buildExportUrl(filters, 'filtered'),
              fileName: exportFileName(new Date(), 'filtered'),
              failureMessage: "L'export a échoué.",
            });
          }}
        >
          <FileSpreadsheetIcon className="mt-0.5" aria-hidden="true" />
          <span className="flex min-w-0 flex-col">
            <span className="font-[600]">Exporter la vue filtrée</span>
            <span className="text-[0.75rem] text-muted-foreground">
              {activeCount === 0
                ? 'Aucun filtre actif'
                : `${String(activeCount)} filtre${activeCount > 1 ? 's' : ''} appliqué${activeCount > 1 ? 's' : ''}`}
            </span>
          </span>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="items-start gap-3 py-2.5"
          onSelect={() => {
            void download({
              url: buildExportUrl(filters, 'consolidated'),
              fileName: exportFileName(new Date(), 'consolidated'),
              failureMessage: 'Le classeur consolidé n’a pas pu être généré.',
            });
          }}
        >
          <LayersIcon className="mt-0.5" aria-hidden="true" />
          <span className="flex min-w-0 flex-col">
            <span className="font-[600]">Classeur consolidé BDD1–BDD4</span>
            <span className="text-[0.75rem] text-muted-foreground">
              Cinq feuilles fixes. Le filtre de segment est ignoré.
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
