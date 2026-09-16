'use client';

import { BankRankChart } from '@/components/bank/bank-charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatFcfa, totalVerse, type Vente } from '@/lib/data/ventes';
import { formatDate } from '@/lib/format';

const MONTANT = 'text-right tabular-nums whitespace-nowrap';

export function TableVentes({ ventes }: { ventes: readonly Vente[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Souscription</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Site</TableHead>
          <TableHead>Canal</TableHead>
          <TableHead>Lots</TableHead>
          <TableHead className="text-right">Prix total</TableHead>
          <TableHead className="text-right">Acompte</TableHead>
          <TableHead className="text-right">Part CPI</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ventes.map((vente) => (
          <TableRow key={vente.numero}>
            <TableCell className="whitespace-nowrap">
              {vente.dateSouscription === null ? 'Sans date' : formatDate(vente.dateSouscription)}
            </TableCell>
            <TableCell>
              <span className="font-[600]">{vente.client}</span>
              <span className="block text-[0.8125rem] text-muted-foreground">
                {vente.telephone}
              </span>
            </TableCell>
            <TableCell>{vente.site}</TableCell>
            <TableCell>{vente.canal}</TableCell>
            <TableCell>
              {vente.nombreLots} · n° {vente.numerosLots}
            </TableCell>
            <TableCell className={MONTANT}>{formatFcfa(vente.prixTotal)}</TableCell>
            <TableCell className={MONTANT}>{formatFcfa(vente.acompte)}</TableCell>
            <TableCell className={MONTANT}>{formatFcfa(vente.partCpi)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function TableEcheances({ ventes }: { ventes: readonly Vente[] }) {
  const lignes = ventes
    .map((vente) => ({ vente, verse: totalVerse(vente) }))
    .sort((a, b) => b.vente.prixTotal - b.verse - (a.vente.prixTotal - a.verse));
  return (
    <Table>
      <TableHeader>
        <TableRow>
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
          const reste = vente.prixTotal - verse;
          return (
            <TableRow key={vente.numero}>
              <TableCell>
                <span className="font-[600]">{vente.client}</span>
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
              <TableCell className={`${MONTANT} font-[600]`}>
                {reste <= 0 ? 'Soldé' : formatFcfa(reste)}
              </TableCell>
            </TableRow>
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

function parSite(ventes: readonly Vente[]): LigneSite[] {
  const sites = new Map<string, LigneSite>();
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

export function SyntheseSites({ ventes }: { ventes: readonly Vente[] }) {
  const sites = parSite(ventes);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Chiffre d’affaires par site</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <BankRankChart
            label="Chiffre d’affaires par site"
            items={sites.map((ligne) => ({ label: ligne.site, value: ligne.chiffre }))}
          />
        </CardContent>
      </Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Site</TableHead>
            <TableHead className="text-right">Ventes</TableHead>
            <TableHead className="text-right">Lots</TableHead>
            <TableHead className="text-right">Chiffre d’affaires</TableHead>
            <TableHead className="text-right">Encaissé</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sites.map((ligne) => (
            <TableRow key={ligne.site}>
              <TableCell className="font-[600]">{ligne.site}</TableCell>
              <TableCell className={MONTANT}>{ligne.ventes}</TableCell>
              <TableCell className={MONTANT}>{ligne.lots}</TableCell>
              <TableCell className={MONTANT}>{formatFcfa(ligne.chiffre)}</TableCell>
              <TableCell className={MONTANT}>
                {ligne.chiffre === 0 ? '–' : `${Math.round((ligne.verse / ligne.chiffre) * 100)} %`}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
