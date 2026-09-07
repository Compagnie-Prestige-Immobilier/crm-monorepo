'use client';

import { FileSpreadsheetIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { telechargerTableauDeBord, type ClasseurTableauDeBord } from '@/lib/tableau-de-bord-xlsx';

/**
 * Le classeur pèse une seconde de calcul et un mégaoctet de code chargé à la
 * demande : il se prépare au clic, jamais au rendu.
 */
export function BoutonExportExcel({
  preparer,
  disabled = false,
}: {
  preparer: () => ClasseurTableauDeBord;
  disabled?: boolean;
}) {
  const [enCours, setEnCours] = useState(false);

  async function exporter(): Promise<void> {
    setEnCours(true);
    try {
      await telechargerTableauDeBord(preparer());
    } catch {
      toast.error('Le classeur n’a pas pu être produit. Réessayez.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled || enCours}
      onClick={() => {
        void exporter();
      }}
    >
      <FileSpreadsheetIcon aria-hidden="true" />
      {enCours ? 'Préparation…' : 'Exporter en Excel'}
    </Button>
  );
}
