'use client';

import { FileSpreadsheetIcon, LoaderIcon } from 'lucide-react';
import Link from 'next/link';

import { BankFiltersBar } from '@/components/bank/bank-filters-bar';
import { useBankFilters } from '@/components/bank/use-bank-filters';
import { useFileDownload } from '@/components/exports/download-button';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { countActiveBankFilters } from '@/lib/bank-filters';
import { bankExportFileName, buildBankExportUrl } from '@/lib/data/export';

/**
 * Écran d'export dédié.
 *
 * Il ne double PAS le menu d'export de la liste : il porte la même barre de
 * filtre, écrit dans la même URL, et produit le même fichier. Sa raison d'être
 * est qu'un agent qui vient chercher « le classeur du mois » n'a pas à savoir
 * qu'il se cache derrière un menu de la page « Dossiers » : et qu'il puisse
 * régler ses critères en voyant, écrit noir sur blanc, ce que chaque feuille
 * contiendra.
 */
const SHEETS: readonly { name: string; description: string }[] = [
  {
    name: 'Dossiers',
    description: 'Référence, client, banque, étape, montant, agent, dates.',
  },
  {
    name: 'Historique',
    description: 'Transitions des dossiers, corrections d’administrateur comprises.',
  },
  {
    name: 'Synthèse',
    description: 'Agrégats par étape, par banque, motifs de rejet, activité par agent.',
  },
];

export function BankExportView() {
  const { filters } = useBankFilters();
  const { pending, download } = useFileDownload();
  const activeCount = countActiveBankFilters(filters);

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">
        Le classeur reprend les critères réglés ci-dessous.
      </p>

      <BankFiltersBar />

      <Card>
        <CardHeader>
          <CardTitle>Classeur des dossiers bancaires</CardTitle>
          <CardDescription>
            {activeCount === 0
              ? 'Aucun filtre : tous les dossiers.'
              : `${String(activeCount)} filtre${activeCount > 1 ? 's' : ''} appliqué${activeCount > 1 ? 's' : ''}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="flex flex-col gap-3">
            {SHEETS.map((sheet) => (
              <div key={sheet.name} className="rounded-md border border-border p-3">
                <dt className="font-[600]">Feuille « {sheet.name} »</dt>
                <dd className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                  {sheet.description}
                </dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="lg"
              disabled={pending}
              onClick={() => {
                void download({
                  url: buildBankExportUrl(filters),
                  fileName: bankExportFileName(),
                  failureMessage: 'Le classeur n’a pas pu être généré.',
                });
              }}
            >
              {pending ? (
                <>
                  <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                  Génération…
                </>
              ) : (
                <>
                  <FileSpreadsheetIcon aria-hidden="true" />
                  Télécharger le classeur
                </>
              )}
            </Button>
            {/* Un LIEN habillé en bouton : la primitive `Button` de Base UI
                poserait `role="button"` sur le `<a>`. */}
            <Link href="/dossiers" className={buttonVariants({ variant: 'ghost' })}>
              Voir la liste
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
