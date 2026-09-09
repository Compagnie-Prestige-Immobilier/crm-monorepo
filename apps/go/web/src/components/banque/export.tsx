import { Link } from '@tanstack/react-router';

import { BarreFiltres } from '@/components/banque/barre-filtres';
import { ADAPTATEUR_DOSSIERS, compterFiltres, urlClasseur } from '@/components/banque/filtres';
import { LienTelechargement } from '@/components/exports/liens';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFiltresUrl } from '@/lib/filtres-url';
import { PROJET_API, type Projet } from '@/lib/types';

const FEUILLES: readonly { nom: string; contenu: string }[] = [
  { nom: 'Dossiers', contenu: 'Référence, client, banque, étape, montant, agent, dates.' },
  {
    nom: 'Historique',
    contenu: 'Transitions des dossiers, corrections d’administrateur comprises.',
  },
  {
    nom: 'Synthèse',
    contenu: 'Agrégats par étape, par banque, motifs de rejet, activité par agent.',
  },
];

function resume(actifs: number): string {
  if (actifs === 0) return 'Aucun filtre : tous les dossiers.';
  return `${String(actifs)} filtre${actifs > 1 ? 's' : ''} appliqué${actifs > 1 ? 's' : ''}.`;
}

export function ExportDossiers({ projet }: { projet: Projet }) {
  const { filtres, setFiltres, reinitialiser } = useFiltresUrl(ADAPTATEUR_DOSSIERS);

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">
        Le classeur reprend les critères réglés ci-dessous.
      </p>

      <BarreFiltres filtres={filtres} setFiltres={setFiltres} reinitialiser={reinitialiser} />

      <Card>
        <CardHeader>
          <CardTitle>Classeur des dossiers bancaires</CardTitle>
          <CardDescription>{resume(compterFiltres(filtres))}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="flex flex-col gap-3">
            {FEUILLES.map((feuille) => (
              <div key={feuille.nom} className="rounded-md border border-border p-3">
                <dt className="font-[600]">Feuille « {feuille.nom} »</dt>
                <dd className="mt-0.5 text-[0.8125rem] text-muted-foreground">{feuille.contenu}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap items-center gap-3">
            <LienTelechargement
              href={urlClasseur(filtres, PROJET_API[projet])}
              label="Télécharger le classeur des dossiers bancaires"
              variant="default"
            >
              Télécharger le classeur
            </LienTelechargement>
            <Link
              to="/$projet/dossiers"
              params={{ projet }}
              className={buttonVariants({ variant: 'ghost' })}
            >
              Voir la liste
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
