'use client';

import { useQuery } from '@tanstack/react-query';
import { DownloadIcon, FileSpreadsheetIcon } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/empty-state';
import { useFileDownload } from '@/components/exports/download-button';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DepotClasseur } from '@/components/ventes/depot-classeur';
import {
  SyntheseSites,
  TableEcheances,
  TableParTeleconseiller,
  TableVentes,
} from '@/components/ventes/ventes-tableaux';
import {
  CLASSEUR_VENTES_URL,
  fetchVentes,
  formatFcfa,
  totalVerse,
  type Vente,
} from '@/lib/data/ventes';
import { formatDate, formatDateTime } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

const TOUS = 'TOUS';

interface Filtres {
  recherche: string;
  site: string;
  canal: string;
  du: string;
  au: string;
}

const FILTRES_VIDES: Filtres = { recherche: '', site: TOUS, canal: TOUS, du: '', au: '' };

function filtrer(ventes: readonly Vente[], f: Filtres): Vente[] {
  const cherche = f.recherche.trim().toLowerCase();
  const garde: ((vente: Vente) => boolean)[] = [];
  if (cherche !== '')
    garde.push((v) => `${v.client} ${v.telephone}`.toLowerCase().includes(cherche));
  if (f.site !== TOUS) garde.push((v) => v.site === f.site);
  if (f.canal !== TOUS) garde.push((v) => v.canal === f.canal);
  if (f.du !== '') garde.push((v) => v.dateSouscription !== null && v.dateSouscription >= f.du);
  if (f.au !== '') garde.push((v) => v.dateSouscription !== null && v.dateSouscription <= f.au);
  return ventes.filter((vente) => garde.every((retenir) => retenir(vente)));
}

const valeursDe = (ventes: readonly Vente[], cle: 'site' | 'canal'): string[] =>
  [...new Set(ventes.map((vente) => vente[cle]).filter((valeur) => valeur !== ''))].sort();

function ChoixListe(props: {
  id: string;
  label: string;
  tous: string;
  valeurs: readonly string[];
  value: string;
  onChange: (valeur: string) => void;
}) {
  const items = [
    { value: TOUS, label: props.tous },
    ...props.valeurs.map((v) => ({ value: v, label: v })),
  ];
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Select items={items} value={props.value} onValueChange={(v) => props.onChange(v ?? TOUS)}>
        <SelectTrigger id={props.id} className="min-w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Chiffres({ ventes }: { ventes: readonly Vente[] }) {
  const chiffre = ventes.reduce((s, v) => s + v.prixTotal, 0);
  const verse = ventes.reduce((s, v) => s + totalVerse(v), 0);
  const tuiles = [
    { label: 'Ventes', valeur: String(ventes.length) },
    { label: 'Chiffre d’affaires', valeur: formatFcfa(chiffre) },
    { label: 'Encaissé', valeur: formatFcfa(verse) },
    { label: 'À recouvrer', valeur: formatFcfa(Math.max(0, chiffre - verse)) },
    { label: 'Part CPI', valeur: formatFcfa(ventes.reduce((s, v) => s + v.partCpi, 0)) },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {tuiles.map((tuile) => (
        <Card key={tuile.label} className="gap-1 p-4">
          <span className="text-[0.8125rem] text-muted-foreground">{tuile.label}</span>
          <strong className="font-display text-[1.25rem] font-[700] tabular-nums">
            {tuile.valeur}
          </strong>
        </Card>
      ))}
    </div>
  );
}

export function VentesView() {
  const [filtres, setFiltres] = useState<Filtres>(FILTRES_VIDES);
  const telechargement = useFileDownload();
  const query = useQuery({ queryKey: queryKeys.ventes, queryFn: () => fetchVentes() });

  if (query.isPending) return <Skeleton className="h-96 w-full rounded-lg" />;
  if (query.isError)
    return <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const { classeur, ventes, parTeleconseiller } = query.data;
  if (classeur === null) {
    return (
      <EmptyState
        icon={FileSpreadsheetIcon}
        title="Aucun tableau des ventes"
        description="Importez le classeur Excel des ventes pour suivre les encaissements par site et par client."
        action={<DepotClasseur premier />}
      />
    );
  }

  const visibles = filtrer(ventes, filtres);
  const changer = (patch: Partial<Filtres>) => setFiltres((f) => ({ ...f, ...patch }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-[0.875rem] text-muted-foreground">
          {classeur.nomFichier}, importé le {formatDateTime(classeur.importeLe)} par{' '}
          {classeur.importePar}
          {classeur.depuis === null ? '' : `, ventes depuis le ${formatDate(classeur.depuis)}`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={telechargement.pending}
            onClick={() =>
              void telechargement.download({
                url: CLASSEUR_VENTES_URL,
                fileName: classeur.nomFichier,
                failureMessage: 'Le classeur n’a pas pu être téléchargé.',
              })
            }
          >
            <DownloadIcon aria-hidden="true" />
            Télécharger le classeur
          </Button>
          <DepotClasseur premier={false} />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <Label htmlFor="ventes-recherche">Client</Label>
          <Input
            id="ventes-recherche"
            placeholder="Nom ou téléphone"
            value={filtres.recherche}
            onChange={(e) => changer({ recherche: e.target.value })}
          />
        </div>
        <ChoixListe
          id="ventes-site"
          label="Site"
          tous="Tous les sites"
          valeurs={valeursDe(ventes, 'site')}
          value={filtres.site}
          onChange={(site) => changer({ site })}
        />
        <ChoixListe
          id="ventes-canal"
          label="Canal"
          tous="Tous les canaux"
          valeurs={valeursDe(ventes, 'canal')}
          value={filtres.canal}
          onChange={(canal) => changer({ canal })}
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ventes-du">Du</Label>
          <Input
            id="ventes-du"
            type="date"
            value={filtres.du}
            onChange={(e) => changer({ du: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ventes-au">Au</Label>
          <Input
            id="ventes-au"
            type="date"
            value={filtres.au}
            onChange={(e) => changer({ au: e.target.value })}
          />
        </div>
      </div>

      <Chiffres ventes={visibles} />

      <Tabs defaultValue="ventes">
        <TabsList>
          <TabsTrigger value="ventes">Ventes</TabsTrigger>
          <TabsTrigger value="echeances">Échéances</TabsTrigger>
          <TabsTrigger value="sites">Sites</TabsTrigger>
          <TabsTrigger value="teleconseillers">Téléconseillers</TabsTrigger>
        </TabsList>
        <TabsContent value="ventes">
          <TableVentes ventes={visibles} />
        </TabsContent>
        <TabsContent value="echeances">
          <TableEcheances ventes={visibles} />
        </TabsContent>
        <TabsContent value="sites">
          <SyntheseSites ventes={visibles} />
        </TabsContent>
        <TabsContent value="teleconseillers">
          <TableParTeleconseiller lignes={parTeleconseiller} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
