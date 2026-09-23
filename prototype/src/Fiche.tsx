import { ArrowLeft, BookOpen, Copy, MoreHorizontal, Save, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  Link,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
} from 'react-aria-components';
import { toast } from 'sonner';
import { useLocation } from 'wouter';

import {
  blankFiche,
  CLASSES,
  computeScore,
  type Fiche,
  ficheText,
  missingFields,
  type Residence,
  type Sector,
  SECTOR_DESCRIPTIONS,
  SECTOR_LABELS,
} from './bant';
import { Bilan, Guide } from './Dialogs';
import { phaseOf, PHASES, phaseProgress, withoutHiddenValues } from './fields';
import { PhaseForm, type Update } from './Form';
import { Notation } from './Notation';
import { ScorePanel } from './ScorePanel';
import {
  duplicateMessage,
  fiches,
  findDuplicate,
  savedMessage,
  upsertFiche,
  withExchange,
} from './store';
import { Button, buttonClass, ClassStamp } from './ui';

const SECTORS = Object.keys(SECTOR_LABELS) as Sector[];

const segment =
  'focus-ring min-h-11 flex-1 cursor-pointer whitespace-nowrap rounded-lg px-3 text-sm font-semibold text-muted transition data-[hovered]:text-ink data-[selected]:bg-paper data-[selected]:text-brand data-[selected]:shadow-sm';

export function FicheScreen({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const saved = fiches.use().find((x) => x.id === id);
  const [initial] = useState<Fiche>(() => saved ?? blankFiche());
  const [fiche, setFiche] = useState<Fiche>(initial);
  const [tab, setTab] = useState<string>('1');
  const [showErrors, setShowErrors] = useState(false);
  const [bilanOpen, setBilanOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const update: Update = (change) => setFiche(change);

  const score = computeScore(fiche);
  const missing = missingFields(fiche);
  const invalid = new Set(showErrors ? missing.map((m) => m.id) : []);
  const dirty = JSON.stringify(fiche) !== JSON.stringify(saved ?? initial);
  const name = fiche.values['prospect-name'] || fiche.values.company || 'Nouvelle fiche';

  const setSector = (sector: Sector) =>
    update((f) =>
      withoutHiddenValues({
        ...f,
        sector,
        residence: sector === 'formal' ? 'local' : f.residence,
        scores: blankFiche().scores,
      }),
    );
  const setResidence = (residence: Residence) =>
    update((f) => withoutHiddenValues({ ...f, residence, scores: blankFiche().scores }));

  function save() {
    if (missing.length) {
      setShowErrors(true);
      setTab(String(phaseOf(missing[0]?.id ?? '')));
      toast.error(`Il manque : ${missing.map((m) => m.label).join(', ')}.`);
      return;
    }
    const duplicate = findDuplicate(fiche);
    if (duplicate) {
      toast.warning(duplicateMessage(duplicate), {
        action: { label: 'Ouvrir', onClick: () => navigate(`/fiche/${duplicate.id}`) },
      });
      return;
    }
    const next = withExchange(fiche);
    upsertFiche(next);
    setFiche(next);
    setShowErrors(false);
    toast.success(savedMessage(fiche, next));
    if (!fiche.id) navigate(`/fiche/${next.id}`, { replace: true });
  }

  function remove() {
    const list = fiches.get();
    fiches.set(list.filter((x) => x.id !== fiche.id));
    navigate('/');
    toast(`Fiche de ${name} supprimée.`, {
      action: { label: 'Annuler', onClick: () => fiches.set(list) },
    });
  }

  const copy = (text: string, done: string) =>
    navigator.clipboard.writeText(text).then(
      () => toast.success(done),
      () => toast.error('Copie impossible : sélectionnez le texte à la main.'),
    );

  return (
    <div className="pb-28">
      <header className="flex flex-wrap items-center gap-3">
        <Link
          href="/"
          aria-label="Retour aux prospects"
          className={`${buttonClass('ghost')} size-11 !px-0`}
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-bold sm:text-3xl">{name}</h1>
          <p className="text-sm text-muted">{SECTOR_DESCRIPTIONS[fiche.sector]}</p>
        </div>
        <span className="lg:hidden">
          <ClassStamp classe={score.classe} />
        </span>
        <MenuTrigger>
          <Button variant="ghost" aria-label="Plus d'actions" className="size-11 !px-0">
            <MoreHorizontal size={20} />
          </Button>
          <Popover
            placement="bottom end"
            className="min-w-60 rounded-xl border border-line bg-paper p-1 shadow-xl shadow-ink/10"
          >
            <Menu className="outline-none">
              <MenuItem
                onAction={() =>
                  copy(ficheText(fiche), 'Fiche interne copiée. Ne pas l’envoyer au prospect.')
                }
                className={menuItem}
              >
                <Copy size={16} />
                Copier la fiche interne
              </MenuItem>
              <MenuItem onAction={() => setGuideOpen(true)} className={menuItem}>
                <BookOpen size={16} />
                Guide de qualification
              </MenuItem>
              {fiche.id && (
                <MenuItem onAction={remove} className={`${menuItem} text-ko`}>
                  <Trash2 size={16} />
                  Supprimer la fiche
                </MenuItem>
              )}
            </Menu>
          </Popover>
        </MenuTrigger>
      </header>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
        <ToggleButtonGroup
          aria-label="Type de prospect"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[fiche.sector]}
          onSelectionChange={(k) => setSector([...k][0] as Sector)}
          className="flex gap-1 overflow-x-auto rounded-xl bg-brand-soft/60 p-1"
        >
          {SECTORS.map((s) => (
            <ToggleButton key={s} id={s} className={segment}>
              {SECTOR_LABELS[s]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {fiche.sector !== 'formal' && (
          <ToggleButtonGroup
            aria-label="Lieu de résidence"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[fiche.residence]}
            onSelectionChange={(k) => setResidence([...k][0] as Residence)}
            className="flex gap-1 rounded-xl bg-brand-soft/60 p-1"
          >
            <ToggleButton id="local" className={segment}>
              Au Sénégal
            </ToggleButton>
            <ToggleButton id="diaspora" className={segment}>
              Diaspora
            </ToggleButton>
          </ToggleButtonGroup>
        )}
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
          <TabList
            aria-label="Étapes de la qualification"
            className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0"
          >
            {PHASES.map((p) => {
              const { done, total } = phaseProgress(fiche, p.n);
              const errors = missing.filter((m) => phaseOf(m.id) === p.n).length;
              return (
                <Tab key={p.n} id={String(p.n)} className={tabClass}>
                  <span className="font-display text-base">
                    {p.n}. {p.title}
                  </span>
                  <span className="text-xs font-medium text-muted tabular-nums">
                    {done}/{total}
                    {showErrors && errors > 0 && (
                      <span
                        className="ml-1.5 inline-block size-2 rounded-full bg-ko"
                        aria-label={`${errors} champ(s) obligatoire(s)`}
                      />
                    )}
                  </span>
                </Tab>
              );
            })}
            <Tab id="bant" className={tabClass}>
              <span className="font-display text-base">Notation BANT</span>
              <span className="text-xs font-medium text-muted">{4 - score.manquants}/4</span>
            </Tab>
          </TabList>
          {PHASES.map((p) => (
            <TabPanel key={p.n} id={String(p.n)} className="pt-5 outline-none">
              <p className="mb-4 text-sm text-muted">{p.intro}</p>
              <PhaseForm fiche={fiche} phase={p.n} update={update} invalid={invalid} />
            </TabPanel>
          ))}
          <TabPanel id="bant" className="pt-5 outline-none">
            <Notation fiche={fiche} update={update} cap={score.cap} />
          </TabPanel>
        </Tabs>
        <aside className="lg:sticky lg:top-20">
          <ScorePanel fiche={fiche} />
        </aside>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/90 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <p className="mr-auto min-w-0 text-sm">
            <span className="font-display text-lg font-bold tabular-nums">{score.total}</span>
            <span className="text-muted"> · {CLASSES[score.classe].label}</span>
            <span
              className={`ml-2 hidden text-xs font-semibold sm:inline ${dirty ? 'text-gold-text' : 'text-ok'}`}
            >
              {dirty ? 'Modifications non enregistrées' : 'Enregistrée'}
            </span>
          </p>
          <Button onPress={() => setBilanOpen(true)}>
            <Send size={16} />
            <span className="hidden sm:inline">Bilan prospect</span>
            <span className="sm:hidden">Bilan</span>
          </Button>
          <Button variant="primary" onPress={save}>
            <Save size={16} />
            Enregistrer
          </Button>
        </div>
      </footer>

      {bilanOpen && <Bilan fiche={fiche} onClose={() => setBilanOpen(false)} copy={copy} />}
      <Guide isOpen={guideOpen} onOpenChange={setGuideOpen} />
    </div>
  );
}

const menuItem =
  'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm outline-none data-[focused]:bg-brand-soft';
const tabClass =
  'focus-ring -mb-px flex min-h-14 shrink-0 cursor-pointer flex-col justify-center border-b-2 border-transparent px-3 text-left text-muted outline-none transition data-[hovered]:text-ink data-[selected]:border-brand data-[selected]:text-ink';
