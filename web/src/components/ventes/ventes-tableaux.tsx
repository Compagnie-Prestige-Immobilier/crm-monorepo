'use client';

import { ArchiveIcon, EyeIcon, PencilIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { BankRankChart, BankShareChart } from '@/components/bank/bank-charts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InfoPopover } from '@/components/ui/info-popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  formatFcfa,
  libelleCredit,
  totalVerse,
  type SiteVente,
  type Vente,
  type VenteParTeleconseiller,
} from '@/lib/data/ventes';
import { formatDate } from '@/lib/format';

const TABLE_CONTAINER = 'rounded-lg border border-border bg-card shadow-elev-xs';
const TABLE_HEADER = 'bg-secondary/70 hover:bg-secondary/70';
const TABLE_ROW = 'odd:bg-secondary/20 hover:bg-primary/5';
const MONTANT = 'text-right tabular-nums whitespace-nowrap font-[600]';

function paiementLabel(vente: Vente): string {
  return vente.soldee ? 'Soldée' : 'À solder';
}

function modeLabel(vente: Vente): string {
  return vente.modePaiement === 'CREDIT' ? libelleCredit(vente) : 'Comptant';
}

function paiementVariant(vente: Vente): 'success' | 'warning' {
  return vente.soldee ? 'success' : 'warning';
}

export function Chiffres({ ventes }: { ventes: readonly Vente[] }) {
  const chiffre = ventes.reduce((s, v) => s + v.prixTotal, 0);
  const verse = ventes.reduce((s, v) => s + totalVerse(v), 0);
  const tuiles = [
    { label: 'Ventes', valeur: String(ventes.length) },
    { label: 'Chiffre d’affaires', valeur: formatFcfa(chiffre) },
    { label: 'Encaissé', valeur: formatFcfa(verse) },
    { label: 'Reste à encaisser', valeur: formatFcfa(Math.max(0, chiffre - verse)) },
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

function LigneOuvrante({ onOuvrir, children }: { onOuvrir: () => void; children: ReactNode }) {
  return (
    <TableRow
      className={`${TABLE_ROW} cursor-pointer`}
      onClick={(event) => {
        if (event.target instanceof HTMLElement && event.target.closest('button') !== null) return;
        if (window.getSelection()?.isCollapsed === false) return;
        onOuvrir();
      }}
    >
      {children}
    </TableRow>
  );
}

function BoutonOuvrir({ onOuvrir, children }: { onOuvrir: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={onOuvrir}
      className="cursor-pointer rounded-sm text-left font-[600] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {children}
    </button>
  );
}

function CelluleReste({ vente }: { vente: Vente }) {
  const reste = vente.prixTotal - totalVerse(vente);
  return (
    <TableCell className={`${MONTANT} ${reste <= 0 ? 'text-success' : 'text-warning'}`}>
      {reste <= 0 ? 'Soldé' : formatFcfa(reste)}
    </TableCell>
  );
}

function ActionsVente({
  vente,
  onDetail,
  onEdit,
  onArchive,
}: {
  vente: Vente;
  onDetail?: ((vente: Vente) => void) | undefined;
  onEdit?: ((vente: Vente) => void) | undefined;
  onArchive?: ((vente: Vente) => void) | undefined;
}) {
  if (onDetail === undefined && onEdit === undefined && onArchive === undefined) return null;
  return (
    <div className="flex justify-end gap-1">
      {onDetail === undefined ? null : (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Voir le détail de ${vente.client}`}
          onClick={() => onDetail(vente)}
        >
          <EyeIcon aria-hidden="true" />
        </Button>
      )}
      {onEdit === undefined ? null : (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Modifier ${vente.client}`}
          onClick={() => onEdit(vente)}
        >
          <PencilIcon aria-hidden="true" />
        </Button>
      )}
      {onArchive === undefined ? null : (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Archiver ${vente.client}`}
          onClick={() => onArchive(vente)}
        >
          <ArchiveIcon aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

export function TableVentes({
  ventes,
  onDetail,
  onEdit,
  onArchive,
}: {
  ventes: readonly Vente[];
  onDetail?: (vente: Vente) => void;
  onEdit?: (vente: Vente) => void;
  onArchive?: (vente: Vente) => void;
}) {
  return (
    <Table containerClassName={TABLE_CONTAINER}>
      <TableHeader>
        <TableRow className={TABLE_HEADER}>
          <TableHead>Souscription</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Téléconseiller</TableHead>
          <TableHead>Site</TableHead>
          <TableHead>Canal</TableHead>
          <TableHead>Lots</TableHead>
          <TableHead className="text-right">Prix total</TableHead>
          <TableHead className="text-right">Acompte</TableHead>
          <TableHead className="text-right text-foreground">Reste à payer</TableHead>
          <TableHead>Paiement</TableHead>
          <TableHead className="text-right">Part CPI</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {ventes.map((vente) => (
          <LigneVente key={vente.id} vente={vente} onDetail={onDetail}>
            <TableCell className="whitespace-nowrap">
              {vente.dateSouscription === null ? 'Sans date' : formatDate(vente.dateSouscription)}
            </TableCell>
            <TableCell>
              {onDetail === undefined ? (
                <span className="font-[600]">{vente.client}</span>
              ) : (
                <BoutonOuvrir onOuvrir={() => onDetail(vente)}>{vente.client}</BoutonOuvrir>
              )}
              <span className="block text-[0.8125rem] text-muted-foreground">
                {vente.telephone}
              </span>
            </TableCell>
            <TableCell>{vente.teleconseiller ?? '–'}</TableCell>
            <TableCell>{vente.site}</TableCell>
            <TableCell>{vente.canal}</TableCell>
            <TableCell>
              {vente.nombreLots} · n° {vente.numerosLots}
            </TableCell>
            <TableCell className={MONTANT}>{formatFcfa(vente.prixTotal)}</TableCell>
            <TableCell className={MONTANT}>{formatFcfa(vente.acompte)}</TableCell>
            <CelluleReste vente={vente} />
            <TableCell>
              <span className="flex flex-wrap gap-1">
                <Badge variant={vente.modePaiement === 'CREDIT' ? 'info' : 'outline'}>
                  {modeLabel(vente)}
                </Badge>
                <Badge variant={paiementVariant(vente)}>{paiementLabel(vente)}</Badge>
              </span>
            </TableCell>
            <TableCell className={MONTANT}>{formatFcfa(vente.partCpi)}</TableCell>
            <TableCell className="text-right">
              <ActionsVente
                vente={vente}
                onDetail={onDetail}
                onEdit={onEdit}
                onArchive={onArchive}
              />
            </TableCell>
          </LigneVente>
        ))}
      </TableBody>
    </Table>
  );
}

function LigneVente({
  vente,
  onDetail,
  children,
}: {
  vente: Vente;
  onDetail?: ((vente: Vente) => void) | undefined;
  children: ReactNode;
}) {
  if (onDetail === undefined) return <TableRow className={TABLE_ROW}>{children}</TableRow>;
  return <LigneOuvrante onOuvrir={() => onDetail(vente)}>{children}</LigneOuvrante>;
}

export function TableParTeleconseiller({
  lignes,
  onOuvrir,
}: {
  lignes: readonly VenteParTeleconseiller[];
  onOuvrir: (nom: string) => void;
}) {
  return (
    <Table containerClassName={TABLE_CONTAINER}>
      <TableHeader>
        <TableRow className={TABLE_HEADER}>
          <TableHead>Téléconseiller</TableHead>
          <TableHead className="text-right">Ventes</TableHead>
          <TableHead className="text-right">Chiffre d’affaires</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lignes.map((ligne) => (
          <LigneOuvrante key={ligne.nom} onOuvrir={() => onOuvrir(ligne.nom)}>
            <TableCell>
              <BoutonOuvrir onOuvrir={() => onOuvrir(ligne.nom)}>{ligne.nom}</BoutonOuvrir>
            </TableCell>
            <TableCell className={MONTANT}>{ligne.ventes}</TableCell>
            <TableCell className={MONTANT}>{formatFcfa(ligne.prixTotal)}</TableCell>
          </LigneOuvrante>
        ))}
      </TableBody>
    </Table>
  );
}

export function TableEcheances({
  ventes,
  onDetail,
}: {
  ventes: readonly Vente[];
  onDetail: (vente: Vente) => void;
}) {
  const lignes = ventes
    .filter((vente) => vente.modePaiement === 'CREDIT')
    .map((vente) => ({ vente, verse: totalVerse(vente) }))
    .sort((a, b) => b.vente.prixTotal - b.verse - (a.vente.prixTotal - a.verse));
  return (
    <Table containerClassName={TABLE_CONTAINER}>
      <TableHeader>
        <TableRow className={TABLE_HEADER}>
          <TableHead>Client</TableHead>
          <TableHead>Site</TableHead>
          <TableHead>Dernier versement</TableHead>
          <TableHead className="text-right">Prix total</TableHead>
          <TableHead className="text-right">Versé</TableHead>
          <TableHead className="text-right">Reste à payer</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lignes.map(({ vente, verse }) => {
          const dernier = vente.versements.at(-1);
          return (
            <LigneOuvrante key={vente.id} onOuvrir={() => onDetail(vente)}>
              <TableCell>
                <BoutonOuvrir onOuvrir={() => onDetail(vente)}>{vente.client}</BoutonOuvrir>
                <span className="block text-[0.8125rem] text-muted-foreground">
                  {vente.telephone}
                </span>
              </TableCell>
              <TableCell>{vente.site}</TableCell>
              <TableCell className="whitespace-nowrap">
                {dernier === undefined
                  ? 'Acompte seul'
                  : `${formatDate(dernier.date)} · ${vente.versements.length} versement${vente.versements.length > 1 ? 's' : ''}`}
              </TableCell>
              <TableCell className={MONTANT}>{formatFcfa(vente.prixTotal)}</TableCell>
              <TableCell className={MONTANT}>{formatFcfa(verse)}</TableCell>
              <CelluleReste vente={vente} />
            </LigneOuvrante>
          );
        })}
      </TableBody>
    </Table>
  );
}

interface LigneSite {
  site: string;
  ventes: number;
  lots: number;
  chiffre: number;
  verse: number;
}

function parSite(ventes: readonly Vente[], configuration: readonly SiteVente[]): LigneSite[] {
  const sites = new Map<string, LigneSite>();
  for (const config of configuration) {
    sites.set(config.nom, {
      site: config.nom,
      ventes: 0,
      lots: 0,
      chiffre: 0,
      verse: 0,
    });
  }
  for (const vente of ventes) {
    const ligne = sites.get(vente.site) ?? {
      site: vente.site,
      ventes: 0,
      lots: 0,
      chiffre: 0,
      verse: 0,
    };
    ligne.ventes += 1;
    ligne.lots += vente.nombreLots;
    ligne.chiffre += vente.prixTotal;
    ligne.verse += totalVerse(vente);
    sites.set(vente.site, ligne);
  }
  return [...sites.values()].sort((a, b) => b.chiffre - a.chiffre);
}

export function SyntheseSites({
  ventes,
  configuration = [],
}: {
  ventes: readonly Vente[];
  configuration?: readonly SiteVente[];
}) {
  const sites = parSite(ventes, configuration);
  const vendus = sites.filter((ligne) => ligne.ventes > 0);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {vendus.length > 0 ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                Chiffre d’affaires par site
                <InfoPopover
                  label="Chiffre d’affaires par site"
                  description="Montant total des ventes enregistrées, regroupé par site et trié du plus élevé au plus faible."
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <BankRankChart
                label="Chiffre d’affaires par site"
                valueFormat="fcfa"
                items={vendus.map((ligne) => ({ label: ligne.site, value: ligne.chiffre }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                Répartition des ventes par site
                <InfoPopover
                  label="Répartition des ventes par site"
                  description="Nombre de ventes enregistrées pour chaque site. La taille de chaque part suit ce nombre."
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <BankShareChart
                items={vendus.map((ligne) => ({ label: ligne.site, value: ligne.ventes }))}
              />
            </CardContent>
          </Card>
        </>
      ) : null}
      <div className="lg:col-span-2">
        <Table containerClassName={TABLE_CONTAINER}>
          <TableHeader>
            <TableRow className={TABLE_HEADER}>
              <TableHead>Site</TableHead>
              <TableHead className="text-right">Ventes</TableHead>
              <TableHead className="text-right">Lots</TableHead>
              <TableHead className="text-right">Chiffre d’affaires</TableHead>
              <TableHead className="text-right">Encaissé</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sites.map((ligne) => (
              <TableRow key={ligne.site} className={TABLE_ROW}>
                <TableCell className="font-[600]">{ligne.site}</TableCell>
                <TableCell className={MONTANT}>{ligne.ventes}</TableCell>
                <TableCell className={MONTANT}>{ligne.lots}</TableCell>
                <TableCell className={`${MONTANT} text-primary`}>
                  {formatFcfa(ligne.chiffre)}
                </TableCell>
                <TableCell className={MONTANT}>
                  {ligne.chiffre === 0
                    ? '–'
                    : `${Math.round((ligne.verse / ligne.chiffre) * 100)} %`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
