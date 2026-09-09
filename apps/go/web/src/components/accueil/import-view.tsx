import { useQuery } from '@tanstack/react-query';
import { LoaderIcon, UploadIcon } from 'lucide-react';
import { useId, useState } from 'react';

import { ImportAnalyse } from '@/components/accueil/import-analyse';
import { EXPORT_VIDE, ImportExport, type FiltresExport } from '@/components/accueil/import-export';
import { ImportRevue, libelleApplication } from '@/components/accueil/import-revue';
import { OngletsVisites } from '@/components/accueil/onglets';
import { useImportRegistre } from '@/components/accueil/use-import-registre';
import { QueryErrorInline } from '@/components/query-error-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { fetchReferentielsVisite } from '@/lib/data/visites';
import { peutAppliquer } from '@/lib/data/visites-import';
import { queryKeys } from '@/lib/query-keys';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';

const ACCEPTE = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function ZoneDepot({
  enCours,
  onFichier,
}: {
  enCours: boolean;
  onFichier: (fichier: File | null) => void;
}) {
  const champId = useId();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[1.0625rem]">2. Déposer le classeur corrigé</CardTitle>
        <CardDescription>
          Le fichier est d’abord simulé. Rien n’est écrit tant que vous n’avez pas revu et confirmé
          l’application.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {/* Le champ de fichier natif couvre la zone : il accepte le clavier, le
            clic et le dépôt d'un fichier sans écouteur de glissement. */}
        <div className="relative">
          <label
            htmlFor={champId}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-8 text-center',
              'transition-colors hover:bg-secondary/50',
              'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2',
              'has-[input:focus-visible]:outline-ring',
            )}
          >
            <UploadIcon className="size-7 text-muted-foreground" aria-hidden="true" />
            <span className="text-[0.9375rem] font-[600]">
              Glissez le classeur ici, ou choisissez un fichier
            </span>
            <span className="text-[0.8125rem] text-muted-foreground">
              Format .xlsx, 25 Mo au maximum.
            </span>
            <input
              id={champId}
              type="file"
              accept={ACCEPTE}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              disabled={enCours}
              onChange={(evenement) => {
                onFichier(evenement.target.files?.item(0) ?? null);
                // Vidé pour que redéposer le même fichier corrigé émette bien un
                // nouvel évènement.
                evenement.target.value = '';
              }}
            />
          </label>
        </div>

        {enCours ? (
          <p role="status" className="flex items-center gap-2 text-[0.875rem]">
            <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            Envoi et lecture du classeur…
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ImportView({ role }: { role: Role }) {
  const [filtres, setFiltres] = useState<FiltresExport>(EXPORT_VIDE);
  const [confirmation, setConfirmation] = useState(false);
  const registre = useImportRegistre();
  const travail = registre.travail;

  const referentiels = useQuery({
    queryKey: queryKeys.visiteReferentielsRoot,
    queryFn: () => fetchReferentielsVisite(),
    staleTime: 5 * 60_000,
  });

  const totalChoisies = registre.choisies.creations + registre.choisies.corrections;

  return (
    <div className="flex flex-col gap-6">
      <OngletsVisites role={role} />

      <ImportExport
        filtres={filtres}
        referentiels={referentiels.data}
        onChange={(patch) => {
          setFiltres((courant) => ({ ...courant, ...patch }));
        }}
      />

      <ZoneDepot enCours={registre.deposer.isPending} onFichier={registre.accepter} />

      {registre.travailQuery.isError ? (
        <QueryErrorInline
          error={registre.travailQuery.error}
          onRetry={() => {
            void registre.travailQuery.refetch();
          }}
          fallback="Ce dépôt n’a pas pu être relu."
        />
      ) : null}

      {travail === undefined ? null : (
        <ImportAnalyse travail={travail} onRecommencer={registre.recommencer} />
      )}

      {registre.enRevue && travail !== undefined ? (
        <ImportRevue
          travail={travail}
          items={registre.revueQuery.data?.items}
          meta={registre.revueQuery.data?.meta}
          chargement={registre.revueQuery.isPending}
          erreur={registre.revueQuery.isError ? registre.revueQuery.error : null}
          onReessayer={() => {
            void registre.revueQuery.refetch();
          }}
          onPage={registre.setPage}
          onBasculer={(changement, choisie) => {
            registre.basculer.mutate({ changement, choisie });
          }}
          onToutCocher={(choisie) => {
            registre.toutCocher.mutate(choisie);
          }}
          toutPending={registre.toutCocher.isPending}
          choisies={registre.choisies}
          peutAppliquer={peutAppliquer(travail, totalChoisies)}
          onAppliquer={() => {
            setConfirmation(true);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={confirmation}
        onOpenChange={setConfirmation}
        title={`${libelleApplication(registre.choisies)} ?`}
        description="Cette action écrit les visites cochées dans le registre et ne s’annule pas."
        confirmLabel={libelleApplication(registre.choisies)}
        confirmVariant="default"
        pending={registre.appliquer.isPending}
        onConfirm={() => {
          if (travail === undefined) return;
          registre.appliquer.mutate(travail.id);
          setConfirmation(false);
        }}
      />
    </div>
  );
}
