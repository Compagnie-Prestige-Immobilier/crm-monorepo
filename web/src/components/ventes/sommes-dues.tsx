'use client';

import { DownloadIcon, LoaderIcon } from 'lucide-react';
import { useId, useState } from 'react';

import { useFileDownload } from '@/components/exports/download-button';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { lienSommesDues, type SiteVente } from '@/lib/data/ventes';

const CLASSE_SELECT = 'h-11 rounded-md border border-input bg-background px-3 text-[0.875rem]';

export function SommesDues({ sites }: { sites: readonly SiteVente[] }) {
  const id = useId();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [ouvert, setOuvert] = useState(false);
  const [du, setDu] = useState(`${aujourdhui.slice(0, 7)}-01`);
  const [au, setAu] = useState(aujourdhui);
  const [site, setSite] = useState('');
  const telechargement = useFileDownload();

  return (
    <Dialog open={ouvert} onOpenChange={setOuvert}>
      <Button size="lg" variant="outline" onClick={() => setOuvert(true)}>
        <DownloadIcon aria-hidden="true" /> Sommes dues
      </Button>
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void telechargement.download({
              url: lienSommesDues(du, au, site),
              fileName: `sommes-dues-cpi-${du}-${au}.xlsx`,
              failureMessage: 'Le classeur des sommes dues n’a pas pu être généré.',
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Sommes dues</DialogTitle>
            <DialogDescription>
              Parts, encaissé et reliquat des ventes souscrites sur la période, par site.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-du`}>Du</Label>
              <Input
                id={`${id}-du`}
                type="date"
                required
                max={au}
                value={du}
                onChange={(event) => setDu(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-au`}>Au</Label>
              <Input
                id={`${id}-au`}
                type="date"
                required
                min={du}
                value={au}
                onChange={(event) => setAu(event.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-site`}>Site</Label>
            <select
              id={`${id}-site`}
              className={CLASSE_SELECT}
              value={site}
              onChange={(event) => setSite(event.target.value)}
            >
              <option value="">Tous les sites</option>
              {sites.map((choix) => (
                <option key={choix.id} value={choix.nom}>
                  {choix.nom}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={telechargement.pending}>
              {telechargement.pending ? (
                <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <DownloadIcon aria-hidden="true" />
              )}
              Télécharger
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
