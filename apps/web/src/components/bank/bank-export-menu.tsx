'use client';

import { ChevronDownIcon, FileSpreadsheetIcon, LoaderIcon } from 'lucide-react';

import { useFileDownload } from '@/components/exports/download-button';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { countActiveBankFilters, type BankCaseFilters } from '@/lib/bank-filters';
import { bankExportFileName, buildBankExportUrl } from '@/lib/data/export';

/**
 * Export des dossiers bancaires : un classeur à TROIS feuilles.
 *
 * Le menu les nomme au lieu de dire « Exporter » tout court. Un agent qui
 * cherche l'historique des transitions doit savoir, avant de télécharger, que
 * la deuxième feuille l'attend : sinon il exporte, n'y trouve pas son compte,
 * et redemande le fichier à quelqu'un d'autre.
 *
 * Le classeur suit EXACTEMENT les filtres de l'écran : c'est la même promesse
 * que du côté prospects, et c'est ce qui permet à un agent de justifier un
 * chiffre qu'il vient de lire.
 */
export function BankExportMenu({ filters }: { filters: BankCaseFilters }) {
  const { pending, download } = useFileDownload();
  const activeCount = countActiveBankFilters(filters);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" disabled={pending} />}>
        {pending ? (
          <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <FileSpreadsheetIcon aria-hidden="true" />
        )}
        Exporter
        <ChevronDownIcon className="size-4 opacity-60" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Export Excel</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="items-start gap-3 py-2.5"
          onSelect={() => {
            void download({
              url: buildBankExportUrl(filters),
              fileName: bankExportFileName(),
              failureMessage: 'Le classeur n’a pas pu être généré.',
            });
          }}
        >
          <FileSpreadsheetIcon className="mt-0.5" aria-hidden="true" />
          <span className="flex min-w-0 flex-col">
            <span className="font-[600]">Classeur des dossiers filtrés</span>
            <span className="text-[0.75rem] text-muted-foreground">
              Trois feuilles : Dossiers, Historique, Synthèse.
              {activeCount > 0
                ? ` ${String(activeCount)} filtre${activeCount > 1 ? 's' : ''} appliqué${activeCount > 1 ? 's' : ''}.`
                : ' Aucun filtre : tous les dossiers.'}
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
