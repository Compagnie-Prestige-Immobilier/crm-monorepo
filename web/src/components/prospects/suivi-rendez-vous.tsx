'use client';

import { unwrap } from '@crm/api-client/query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheckIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { meQueryOptions } from '@/api/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { getApiClient } from '@/lib/api/browser';
import { suivreRendezVous } from '@/lib/data/prospects';
import { dakarLocalToIso, formatDateTime } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { etatRendezVousFiche, peut, type ProspectRow } from '@/lib/types';

type Issue = NonNullable<ProspectRow['rendezVousIssue']> | 'REPORTE';
type Suite = NonNullable<ProspectRow['suiteRencontre']>;

export const ISSUES: Record<Issue, string> = {
  HONORE: 'Présent',
  NON_HONORE: 'Absent',
  REPORTE: 'Reporté',
};

export const SUITES: Record<Suite, string> = {
  TRES_CHAUD: 'Très chaud',
  CHAUD: 'Chaud',
  A_SUIVRE: 'À suivre',
};

/** Le résultat noté, lisible par tous ceux qui voient la fiche. */
export function SuiviRendezVousBadges({ prospect }: { prospect: ProspectRow }) {
  if (prospect.phase2Status !== 'APPOINTMENT' && prospect.rendezVousIssue === null) return null;
  const report =
    prospect.rendezVousReporteAt === null
      ? ''
      : ` · reporté au ${formatDateTime(prospect.rendezVousReporteAt)}`;
  return (
    <>
      <Badge variant="outline">
        RV {etatRendezVousFiche(prospect).toLowerCase()}
        {report}
      </Badge>
      {prospect.suiteRencontre === null ? null : (
        <Badge variant="outline">{SUITES[prospect.suiteRencontre]}</Badge>
      )}
    </>
  );
}

const AU_TELEPHONE: Partial<Record<Issue, string>> = { HONORE: 'Joint', NON_HONORE: 'Non joint' };

const ongletsDe = (telephonique: boolean): [string, string][] =>
  Object.entries(telephonique ? AU_TELEPHONE : ISSUES);

// Non joint au téléphone, le rendez-vous se reporte.
const issueEnvoyee = (telephonique: boolean, issue: Issue): Issue =>
  telephonique && issue === 'NON_HONORE' ? 'REPORTE' : issue;

const suiviOuvert = (prospect: ProspectRow): boolean =>
  prospect.phase2Status === 'APPOINTMENT' && prospect.rendezVousConfirmation !== 'ANNULE';

async function typeDuRendezVous(id: string): Promise<string> {
  const body = unwrap(
    await getApiClient().GET('/api/v1/prospects/{id}/rendez-vous', { params: { path: { id } } }),
  );
  return body.rendezVous?.typeCode ?? '';
}

export function SuiviRendezVous({ prospect }: { prospect: ProspectRow }) {
  const { data: user } = useQuery(meQueryOptions);
  const { data: typeCode } = useQuery({
    queryKey: ['prospects', prospect.id, 'rendez-vous', 'type'],
    queryFn: () => typeDuRendezVous(prospect.id),
    enabled: prospect.phase2Status === 'APPOINTMENT',
  });
  const telephonique = typeCode === 'RDV_TELEPHONIQUE';
  const queryClient = useQueryClient();
  const [ouverte, setOuverte] = useState(false);
  const [issue, setIssue] = useState<Issue>(prospect.rendezVousIssue ?? 'HONORE');
  const [suite, setSuite] = useState<Suite | null>(prospect.suiteRencontre);
  const [report, setReport] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const envoyee = issueEnvoyee(telephonique, issue);
  const reporteAt = envoyee === 'REPORTE' ? dakarLocalToIso(report) : null;
  const pret = envoyee !== 'REPORTE' || reporteAt !== null;

  const suivi = useMutation({
    mutationFn: () =>
      suivreRendezVous(prospect.id, {
        issue: envoyee,
        ...(reporteAt === null ? {} : { reporteAt }),
        ...(issue === 'HONORE' && suite !== null ? { suiteRencontre: suite } : {}),
        ...(envoyee === 'REPORTE' && commentaire.trim() !== ''
          ? { commentaire: commentaire.trim() }
          : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      setOuverte(false);
      toast.success('Suivi du rendez-vous enregistré.');
    },
    onError: (error) => toastApiError(error, "Le suivi n'a pas pu être enregistré."),
  });

  if (!peut(user, 'rendez_vous.suivre') || !suiviOuvert(prospect)) return null;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setOuverte(true);
        }}
      >
        <CalendarCheckIcon aria-hidden="true" />
        Suivi du rendez-vous
      </Button>
      <Dialog open={ouverte} onOpenChange={setOuverte}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Rendez-vous de {prospect.prenom} {prospect.nom}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <Tabs
              value={issue}
              onValueChange={(value) => {
                setIssue(value as Issue);
              }}
            >
              <TabsList className="w-full">
                {ongletsDe(telephonique).map(([value, label]) => (
                  <TabsTrigger key={value} value={value} className="flex-1">
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            {envoyee === 'REPORTE' ? (
              <div className="grid gap-2">
                <Label htmlFor="rendez-vous-report">Nouvelle date (heure de Dakar)</Label>
                <Input
                  id="rendez-vous-report"
                  type="datetime-local"
                  value={report}
                  onChange={(event) => {
                    setReport(event.target.value);
                  }}
                />
              </div>
            ) : null}
            {issue === 'HONORE' ? (
              <div className="grid gap-2">
                <p id="rendez-vous-suite" className="text-[0.9375rem] font-[600] leading-none">
                  Suite après rencontre
                </p>
                <Tabs
                  value={suite ?? ''}
                  onValueChange={(value) => {
                    setSuite(value as Suite);
                  }}
                >
                  <TabsList aria-labelledby="rendez-vous-suite" className="w-full">
                    {Object.entries(SUITES).map(([value, label]) => (
                      <TabsTrigger key={value} value={value} className="flex-1">
                        {label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="rendez-vous-commentaire">Commentaire</Label>
              <Textarea
                id="rendez-vous-commentaire"
                placeholder="Ajouter un commentaire..."
                value={commentaire}
                onChange={(event) => {
                  setCommentaire(event.target.value);
                }}
                className="resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOuverte(false);
              }}
            >
              Annuler
            </Button>
            <Button
              disabled={!pret || suivi.isPending}
              onClick={() => {
                suivi.mutate();
              }}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
