'use client';

import { ChevronDownIcon, SlidersHorizontalIcon, XIcon } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { advancedOpenFrom } from '@/lib/filters';
import { cn } from '@/lib/utils';

/**
 * Le panneau « Filtres avancés », générique.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Un critère replié n'est jamais un critère caché.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le dispositif a été écrit pour les prospects (treize champs empilés
 * poussaient les indicateurs sous la ligne de flottaison), puis les dossiers,
 * les représentants et les campagnes ont eu le même besoin. Recopier le
 * mécanisme quatre fois aurait garanti qu'une copie oublie le compte, ou les
 * puces, ou le démontage du panneau : ce sont précisément les trois détails qui
 * empêchent un filtre invisible de restreindre une population en silence.
 *
 * Trois garanties, tenues ici et pas dans les appelants :
 *
 * 1. **Un COMPTE sur le bouton** et **une PUCE par critère** quand le panneau
 *    est replié. Sans elles, l'écran affiche un chiffre partiel qui se lit
 *    comme un total, et personne ne vérifie un nombre qui a l'air normal.
 * 2. **Le panneau est DÉMONTÉ** quand il est replié, pas masqué en CSS : dix
 *    listes déroulantes cachées resteraient atteignables au clavier, et la
 *    tabulation traverserait un formulaire invisible.
 * 3. **L'URL l'emporte sur la préférence enregistrée** (`advancedOpenFrom`) :
 *    un lien filtré ouvre le panneau chez son destinataire, quelle que soit la
 *    préférence qu'il avait posée la veille.
 *
 * L'appelant fournit les puces et les champs ; il reste maître de SES critères
 * et de leur libellé. Le composant ne connaît aucun nom de filtre.
 */

export interface AdvancedChipItem<K extends string> {
  key: K;
  /** Nom du critère : « Banque », « Segment BDD ». */
  field: string;
  /** Valeur lisible : « CBAO », « BDD1 : CHUES / CBAO ». */
  value: string;
}

/**
 * Préférence d'ouverture, PAR ÉCRAN.
 *
 * `localStorage` et non un cookie : la préférence n'a aucune raison de repartir
 * vers le serveur à chaque requête. La clé porte le nom du module car les
 * écrans n'ont ni le même nombre de critères repliés ni le même usage : replier
 * le panneau des dossiers ne dit rien de ce qu'on veut voir sur les prospects.
 * (L'ancienne clé globale `cpi.filtres-avances` est abandonnée : c'est une
 * préférence d'affichage, sa perte ne coûte qu'un clic.)
 *
 * Les accès sont protégés : un navigateur en navigation privée stricte fait
 * lever `localStorage`, et une barre de filtre ne doit pas disparaître pour
 * autant.
 */
function storageKey(module: string): string {
  return `cpi.filtres-avances.${module}`;
}

function readStoredOpen(module: string): boolean | null {
  try {
    const raw = window.localStorage.getItem(storageKey(module));
    return raw === null ? null : raw === '1';
  } catch {
    return null;
  }
}

function writeStoredOpen(module: string, open: boolean): void {
  try {
    window.localStorage.setItem(storageKey(module), open ? '1' : '0');
  } catch {
    // Préférence perdue, écran intact. Il n'y a rien à signaler à l'utilisateur.
  }
}

export function AdvancedPanel<K extends string>({
  module,
  chips,
  onRemove,
  onClearAll,
  actions,
  children,
}: {
  /** Suffixe de la clé de préférence : `prospects`, `dossiers`, `representants`… */
  module: string;
  /**
   * Les critères repliés RÉELLEMENT renseignés, dans l'ordre des champs du
   * panneau. Leur nombre est le compte porté par le bouton : deux sources
   * séparées finiraient par diverger, et c'est le compte qui serait faux.
   */
  chips: readonly AdvancedChipItem<K>[];
  onRemove: (key: K) => void;
  onClearAll: () => void;
  /** Commandes de l'appelant posées à côté du bouton (« Tout effacer »). */
  actions?: ReactNode | undefined;
  children: ReactNode;
}) {
  const panelId = useId();
  const count = chips.length;

  /**
   * L'état initial se déduit de l'URL SEULE, identiquement sur le serveur et au
   * premier rendu client : lire `localStorage` dans le `useState` produirait
   * deux arbres différents et une erreur d'hydratation. La préférence est
   * appliquée juste après, une seule fois : la relire à chaque rendu
   * refermerait le panneau sous les doigts de l'utilisateur au moment où il
   * retire son dernier critère avancé.
   */
  const [open, setOpen] = useState(() => count > 0);
  const preferenceApplied = useRef(false);

  useEffect(() => {
    if (preferenceApplied.current) return;
    preferenceApplied.current = true;
    setOpen(advancedOpenFrom(count > 0, readStoredOpen(module)));
  }, [count, module]);

  const toggle = useCallback(() => {
    setOpen((current) => {
      writeStoredOpen(module, !current);
      return !current;
    });
  }, [module]);

  return (
    <>
      {/* ─── Commandes ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={panelId}
        >
          <SlidersHorizontalIcon aria-hidden="true" />
          Filtres avancés
          {/* Le compte porte sur les critères REPLIÉS, et sur eux seuls : ce
              sont les seuls qu'on ne voit pas. Compter aussi la recherche et la
              période mettrait un « 5 » sur un bouton qui n'en cache que trois. */}
          {count > 0 ? (
            <Badge variant="default" className="ml-1 tabular-nums">
              {count}
              <span className="sr-only">
                {' '}
                critère{count > 1 ? 's' : ''} replié{count > 1 ? 's' : ''}
              </span>
            </Badge>
          ) : null}
          <ChevronDownIcon
            aria-hidden="true"
            className={cn(
              'transition-transform duration-(--dur-1) ease-(--ease-out-cpi)',
              open && 'rotate-180',
            )}
          />
        </Button>

        {actions}
      </div>

      {/* ─── Rappel des critères repliés ────────────────────────────────────
          Affiché UNIQUEMENT panneau fermé : ouvert, chaque champ porte déjà sa
          valeur, et doubler l'information ferait relire deux fois la même
          chose. */}
      {!open && count > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="text-[0.75rem] text-muted-foreground">Filtres avancés actifs</span>
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => {
                onRemove(chip.key);
              }}
              aria-label={`Retirer le filtre ${chip.field} : ${chip.value}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-secondary py-1 pr-1.5 pl-2.5 text-[0.75rem] text-secondary-foreground transition-colors duration-(--dur-1) ease-(--ease-out-cpi) hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="truncate">
                <span className="text-muted-foreground">{chip.field} : </span>
                <span className="font-[600]">{chip.value}</span>
              </span>
              <XIcon className="size-3.5 shrink-0" aria-hidden="true" />
            </button>
          ))}
          <Button variant="ghost" size="sm" onClick={onClearAll}>
            Tout retirer
          </Button>
        </div>
      ) : null}

      {/* ─── Champs repliés ─────────────────────────────────────────────────
          Retirés du DOM quand le panneau est fermé plutôt que masqués en CSS :
          voir la garantie 2 du bloc d'en-tête. */}
      <div id={panelId} hidden={!open}>
        {open ? children : null}
      </div>
    </>
  );
}
