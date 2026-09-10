'use client';

import { ListIcon, SquareKanbanIcon } from 'lucide-react';
import { useState } from 'react';

import { BankCasesView } from '@/components/bank/bank-cases-view';
import { BankKanban } from '@/components/bank/bank-kanban';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Projet } from '@/lib/types';

type Vue = 'kanban' | 'liste';
const CLE = 'banque.vue';

function vueMemorisee(): Vue {
  try {
    return localStorage.getItem(CLE) === 'liste' ? 'liste' : 'kanban';
  } catch {
    return 'kanban';
  }
}

/** Kanban sur ordinateur, liste sur téléphone : le glisser-déposer n'a pas de sens au pouce. */
export function BankDossiers({ projet }: { projet: Projet }) {
  const [vue, setVue] = useState<Vue>(vueMemorisee);

  function choisir(suivante: string): void {
    const valeur: Vue = suivante === 'liste' ? 'liste' : 'kanban';
    setVue(valeur);
    try {
      localStorage.setItem(CLE, valeur);
    } catch {
      // Sans stockage, le choix ne survit pas à la page : acceptable.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="hidden lg:block">
        <Tabs value={vue} onValueChange={choisir}>
          <TabsList aria-label="Présentation des dossiers">
            <TabsTrigger value="kanban">
              <SquareKanbanIcon className="size-4" aria-hidden="true" />
              Tableau
            </TabsTrigger>
            <TabsTrigger value="liste">
              <ListIcon className="size-4" aria-hidden="true" />
              Liste
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {vue === 'kanban' ? (
        <div className="hidden lg:block">
          <BankKanban projet={projet} />
        </div>
      ) : null}
      <div className={vue === 'kanban' ? 'lg:hidden' : ''}>
        <BankCasesView projet={projet} />
      </div>
    </div>
  );
}
