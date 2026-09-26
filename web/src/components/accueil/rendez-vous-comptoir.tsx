'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckIcon, DownloadIcon, PlusIcon, XIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { VisiteForm } from '@/components/accueil/visite-form';
import { DatePicker } from '@/components/filters/date-picker';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TablePaginationLocale } from '@/components/ui/table-pagination';
import { suivreRendezVous } from '@/lib/data/prospects';
import {
  CLE_RENDEZ_VOUS,
  lienExportRendezVous,
  lireRendezVous,
  type RendezVousObtenu,
} from '@/lib/data/rendez-vous';
import {
  VISITE_REFERENTIELS_QUERY_KEY,
  dakarNow,
  fetchVisiteReferentiels,
} from '@/lib/data/visites';
import { formatDateTime, formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';

const SUIVIS: Record<string, { libelle: string; variante: 'success' | 'destructive' | 'warning' }> =
  {
    HONORE: { libelle: 'Venu', variante: 'success' },
    NON_HONORE: { libelle: 'Pas venu', variante: 'destructive' },
    REPORTE: { libelle: 'Reporté', variante: 'warning' },
  };

function Suivi({
  fiche,
  peutNoter,
  onEnregistrerVisite,
}: {
  fiche: RendezVousObtenu;
  peutNoter: boolean;
  onEnregistrerVisite: ((fiche: RendezVousObtenu) => void) | null;
}) {
  const client = useQueryClient();
  const noter = useMutation({
    mutationFn: (issue: 'HONORE' | 'NON_HONORE') => suivreRendezVous(fiche.id, { issue }),
    onSuccess: (_, issue) => {
      void client.invalidateQueries({ queryKey: CLE_RENDEZ_VOUS });
      toast.success(issue === 'HONORE' ? 'Venue confirmée.' : 'Absence notée.');
    },
    onError: (error) => toastApiError(error, 'Le suivi n’a pas été enregistré.'),
  });

  const connu = SUIVIS[fiche.issue];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {connu === undefined ? null : <Badge variant={connu.variante}>{connu.libelle}</Badge>}
      {fiche.issue === 'HONORE' && onEnregistrerVisite !== null ? (
        <Button
          size="sm"
          onClick={() => {
            onEnregistrerVisite(fiche);
          }}
          className="gap-1.5"
        >
          <PlusIcon className="size-3.5" aria-hidden="true" />
          Enregistrer la visite
        </Button>
      ) : null}
      {peutNoter ? (
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={noter.isPending}
            aria-label={`Confirmer la venue de ${fiche.prenom} ${fiche.nom}`}
            onClick={() => {
              noter.mutate('HONORE');
            }}
            className="gap-1.5"
          >
            <CheckIcon className="size-3.5" aria-hidden="true" />
            Venu
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={noter.isPending}
            aria-label={`Noter l’absence de ${fiche.prenom} ${fiche.nom}`}
            onClick={() => {
              noter.mutate('NON_HONORE');
            }}
            className="gap-1.5"
          >
            <XIcon className="size-3.5" aria-hidden="true" />
            Pas venu
          </Button>
        </>
      ) : null}
    </div>
  );
}

function PeriodeRendezVous({
  today,
  du,
  au,
  onChange,
}: {
  today: string;
  du: string;
  au: string;
  onChange: (du: string, au: string) => void;
}) {
  const duId = useId();
  const auId = useId();
  const aujourdhui = du === today && au === today;
  const toutes = du === '' && au === '';
  return (
    <>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={aujourdhui ? 'default' : 'outline'}
          aria-pressed={aujourdhui}
          onClick={() => {
            onChange(today, today);
          }}
        >
          Aujourd’hui
        </Button>
        <Button
          size="sm"
          variant={toutes ? 'default' : 'outline'}
          aria-pressed={toutes}
          onClick={() => {
            onChange('', '');
          }}
        >
          Toutes les dates
        </Button>
      </div>
      <div className="flex items-end gap-2">
        <DatePicker
          id={duId}
          label="Du"
          value={du || null}
          max={au || null}
          onChange={(valeur) => {
            onChange(valeur ?? '', au);
          }}
        />
        <DatePicker
          id={auId}
          label="Au"
          value={au || null}
          min={du || null}
          onChange={(valeur) => {
            onChange(du, valeur ?? '');
          }}
        />
      </div>
    </>
  );
}

// Le registre n'a pas d'objet « rendez-vous » : l'accueil le choisit, le commentaire garde la trace.
function VisiteDuRendezVous({
  rendezVous,
  onClose,
}: {
  rendezVous: RendezVousObtenu | null;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const referentiels = useQuery({
    queryKey: VISITE_REFERENTIELS_QUERY_KEY,
    queryFn: () => fetchVisiteReferentiels(),
    staleTime: 5 * 60_000,
    enabled: rendezVous !== null,
  });
  if (rendezVous === null) return null;
  const telephone = rendezVous.phoneE164 === null ? '' : formatPhone(rendezVous.phoneE164);
  return (
    <Dialog
      open
      onOpenChange={(ouvert) => {
        if (!ouvert) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Enregistrer une visite</DialogTitle>
        </DialogHeader>
        <VisiteForm
          referentiels={referentiels.data}
          preremplie={{
            visitorName: `${rendezVous.prenom} ${rendezVous.nom}`.trim(),
            phone: telephone,
            comment: `Rendez-vous ${rendezVous.type} pris par ${rendezVous.prisPar}`,
          }}
          onSaved={() => {
            onClose();
            void client.invalidateQueries({ queryKey: ['visites'] });
          }}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Le comptoir confirme depuis la liste : ouvrir chaque fiche pour un seul clic
 * ferait perdre la file d'attente.
 */
const VENUES: readonly { value: string; label: string }[] = [
  { value: 'tous', label: 'Toutes les venues' },
  { value: 'SANS', label: 'À confirmer' },
  { value: 'HONORE', label: 'Venus' },
  { value: 'NON_HONORE', label: 'Pas venus' },
  { value: 'REPORTE', label: 'Reportés' },
];

export function RendezVousComptoir({
  type,
  peutNoter,
  peutExporter,
  peutEnregistrerVisite,
}: {
  type: string | null;
  peutNoter: boolean;
  peutExporter: boolean;
  peutEnregistrerVisite: boolean;
}) {
  const [today] = useState(() => dakarNow().date);
  const [search, setSearch] = useState('');
  const [issue, setIssue] = useState('');
  const [du, setDu] = useState(today);
  const [au, setAu] = useState(today);
  const [visiteDe, setVisiteDe] = useState<RendezVousObtenu | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const filtres = { type, search, issue, du, au, page, pageSize };
  const liste = useQuery({
    queryKey: [...CLE_RENDEZ_VOUS, filtres],
    queryFn: () => lireRendezVous(filtres),
  });
  function choisirPeriode(debut: string, fin: string): void {
    setDu(debut);
    setAu(fin);
    setPage(1);
  }

  if (liste.isError) {
    return <QueryErrorState error={liste.error} onRetry={() => void liste.refetch()} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <Input
          type="search"
          value={search}
          placeholder="Nom ou numéro"
          aria-label="Rechercher un rendez-vous"
          className="max-w-xs"
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <PeriodeRendezVous today={today} du={du} au={au} onChange={choisirPeriode} />
        <Select
          items={VENUES}
          value={issue === '' ? 'tous' : issue}
          onValueChange={(valeur) => {
            setIssue(valeur === 'tous' || valeur === null ? '' : valeur);
            setPage(1);
          }}
        >
          <SelectTrigger aria-label="Venue" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VENUES.map((venue) => (
              <SelectItem key={venue.value} value={venue.value}>
                {venue.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-3">
          {liste.data === undefined ? null : (
            <p className="text-sm text-muted-foreground">{liste.data.total} rendez-vous</p>
          )}
          {peutExporter ? (
            <a
              href={lienExportRendezVous(filtres)}
              className={buttonVariants({ variant: 'outline', size: 'sm', className: 'gap-1.5' })}
            >
              <DownloadIcon className="size-3.5" aria-hidden="true" />
              Exporter
            </a>
          ) : null}
        </div>
      </div>

      {liste.isPending ? <Skeleton className="h-64 w-full rounded-lg" /> : null}

      {liste.data !== undefined && liste.data.items.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Aucun rendez-vous ici. Choisissez « Toutes les dates », changez d’onglet ou videz la
          recherche.
        </p>
      ) : null}

      {liste.data !== undefined && liste.data.items.length > 0 ? (
        <>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rendez-vous le</TableHead>
                  <TableHead>Prospect</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Pris le</TableHead>
                  <TableHead>Par</TableHead>
                  <TableHead>Venue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liste.data.items.map((fiche) => (
                  <TableRow key={fiche.id}>
                    <TableCell className="whitespace-nowrap">
                      {fiche.quand === null ? '' : formatDateTime(fiche.quand)}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">
                        {fiche.prenom} {fiche.nom}
                      </p>
                      {fiche.phoneE164 === null ? null : (
                        <a
                          href={`tel:${fiche.phoneE164}`}
                          className="font-mono text-xs text-primary"
                        >
                          {formatPhone(fiche.phoneE164)}
                        </a>
                      )}
                    </TableCell>
                    <TableCell>
                      {fiche.type}
                      {fiche.site === '' ? null : (
                        <p className="text-[0.8125rem] text-muted-foreground">
                          {fiche.site} · {fiche.pointRencontre}
                          {fiche.pointRencontreCommentaire === ''
                            ? null
                            : `, ${fiche.pointRencontreCommentaire}`}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {fiche.prisLe === null ? '' : formatDateTime(fiche.prisLe)}
                    </TableCell>
                    <TableCell>{fiche.prisPar}</TableCell>
                    <TableCell>
                      <Suivi
                        fiche={fiche}
                        peutNoter={peutNoter}
                        onEnregistrerVisite={peutEnregistrerVisite ? setVisiteDe : null}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <TablePaginationLocale
            page={liste.data.page}
            pageCount={liste.data.pageCount}
            pageSize={liste.data.pageSize}
            setPage={setPage}
            setPageSize={(taille) => {
              setPageSize(taille);
              setPage(1);
            }}
          />
        </>
      ) : null}

      <VisiteDuRendezVous
        rendezVous={visiteDe}
        onClose={() => {
          setVisiteDe(null);
        }}
      />
    </div>
  );
}
