import { AlarmClock, Download, Plane, Plus, Search, X } from 'lucide-react';
import { useState } from 'react';
import {
  GridList,
  GridListItem,
  Input,
  Link,
  SearchField,
  ToggleButton,
  ToggleButtonGroup,
  Button as AriaButton,
} from 'react-aria-components';

import {
  type Classe,
  computeScore,
  exportCsv,
  type Fiche,
  frDate,
  SECTOR_LABELS,
  today,
} from './bant';
import { selText } from './fields';
import { Pilotage } from './Pilotage';
import { fiches } from './store';
import { Button, buttonClass, ClassStamp } from './ui';

const LIMITE_LISTE = 100;
type Filtre = 'tous' | Classe | 'retard';
const FILTRE_LABELS: Record<Filtre, string> = {
  tous: 'Toutes',
  A: 'Classe A',
  B: 'Classe B',
  C: 'Classe C',
  D: 'Classe D',
  retard: 'Relances en retard',
};

const actif = (f: Fiche) => !['perdu', 'reservation'].includes(f.values.etape ?? '');
const enRetard = (f: Fiche) => actif(f) && (f.values['date-relance'] ?? '9999') < today();

export function Radar() {
  const list = fiches.use();
  const [filtre, setFiltre] = useState<Filtre>('tous');
  const [query, setQuery] = useState('');
  const rows = list
    .map((f) => ({ f, s: computeScore(f) }))
    .sort((a, b) =>
      (a.f.values['date-relance'] ?? '9999').localeCompare(b.f.values['date-relance'] ?? '9999'),
    );

  const counts: Record<Filtre, number> = {
    tous: rows.length,
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    retard: rows.filter((r) => enRetard(r.f)).length,
  };
  rows.forEach((r) => counts[r.s.classe]++);
  const q = query.trim().toLowerCase();
  const matches = rows.filter((r) => {
    if (filtre === 'retard' ? !enRetard(r.f) : filtre !== 'tous' && r.s.classe !== filtre)
      return false;
    return (
      !q ||
      [
        r.f.values['prospect-name'],
        r.f.values.company,
        r.f.values.telephone,
        r.f.values.commercial,
      ].some((x) => x?.toLowerCase().includes(q))
    );
  });
  const shown = matches.slice(0, LIMITE_LISTE);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Prospects</h1>
          <p className="mt-1 text-sm text-muted">
            {counts.tous} fiches · {list.filter((f) => f.values.etape === 'reservation').length}{' '}
            réservations · {list.filter((f) => f.residence === 'diaspora').length} diaspora
          </p>
        </div>
        <div className="flex gap-2">
          <Button onPress={() => exportCsv(list)} isDisabled={!list.length}>
            <Download size={16} />
            Excel
          </Button>
          <Link href="/fiche/nouvelle" className={buttonClass('primary')}>
            <Plus size={16} />
            Nouvelle fiche
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <ToggleButtonGroup
          aria-label="Filtrer par classe"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[filtre]}
          onSelectionChange={(k) => setFiltre([...k][0] as Filtre)}
          className="flex gap-1.5 overflow-x-auto pb-1 md:pb-0"
        >
          {(['tous', 'A', 'B', 'C', 'D', 'retard'] as const).map((k) => (
            <ToggleButton
              key={k}
              id={k}
              className={`focus-ring flex min-h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition data-[selected]:border-ink data-[selected]:bg-ink data-[selected]:text-white ${k === 'retard' && counts.retard ? 'border-ko/30 text-ko' : 'border-line text-muted'}`}
            >
              {k === 'retard' && <AlarmClock size={15} />}
              {FILTRE_LABELS[k]}
              <span className="tabular-nums opacity-70">{counts[k]}</span>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <SearchField
          aria-label="Rechercher"
          value={query}
          onChange={setQuery}
          className="group relative md:ml-auto md:w-72"
        >
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          />
          <Input
            placeholder="Nom, téléphone, conseiller"
            className="field-box pl-9 [&::-webkit-search-cancel-button]:hidden"
          />
          <AriaButton className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-muted group-data-[empty]:hidden">
            <X size={16} />
          </AriaButton>
        </SearchField>
      </div>

      <GridList
        aria-label="Fiches prospects"
        items={shown}
        className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper"
        renderEmptyState={() => (
          <div className="px-6 py-14 text-center">
            <p className="font-display text-lg font-semibold">Aucune fiche ne correspond.</p>
            <p className="mt-1 text-sm text-muted">
              Changez de filtre ou créez une nouvelle fiche.
            </p>
          </div>
        )}
      >
        {({ f, s }) => <Row key={f.id} f={f} classe={s.classe} total={s.total} />}
      </GridList>
      {matches.length > LIMITE_LISTE && (
        <p className="text-sm text-muted">
          {LIMITE_LISTE} premières fiches sur {matches.length}. Affinez la recherche pour voir les
          autres.
        </p>
      )}

      <Pilotage list={list} />
    </div>
  );
}

function Row({ f, classe, total }: { f: Fiche; classe: Classe; total: number }) {
  const name = f.values['prospect-name'] || f.values.company || 'Sans nom';
  const late = enRetard(f);
  return (
    <GridListItem
      id={f.id}
      href={`/fiche/${f.id}`}
      textValue={name}
      className={`focus-ring grid cursor-pointer grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 px-4 py-3.5 outline-none transition data-[hovered]:bg-brand-soft/40 md:grid-cols-[auto_minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_11rem] ${late ? 'bg-ko-soft/40' : ''}`}
    >
      <ClassStamp classe={classe} size="sm" />
      <div className="min-w-0">
        <p className="truncate font-semibold">{name}</p>
        <p className="truncate text-sm text-muted">
          {f.values.company && f.values['prospect-name'] ? `${f.values.company} · ` : ''}
          {f.values.telephone}
        </p>
      </div>
      <p className="col-start-2 flex items-center gap-1.5 text-sm text-muted md:col-start-auto">
        {selText(f, 'etape') || 'Étape à préciser'}
        <span className="text-line-strong">·</span>
        {SECTOR_LABELS[f.sector]}
        {f.residence === 'diaspora' && <Plane size={14} aria-label="Diaspora" />}
      </p>
      <Relance f={f} late={late} />
      <p className="col-start-2 text-sm text-muted md:col-start-auto md:text-right">
        <span className="font-display font-bold text-ink tabular-nums">{total}</span>/100 ·{' '}
        {f.values.commercial || 'Non attribuée'}
      </p>
    </GridListItem>
  );
}

function Relance({ f, late }: { f: Fiche; late: boolean }) {
  const relance = f.values['date-relance'];
  return (
    <p
      className={`col-start-2 flex items-center gap-1.5 text-sm md:col-start-auto ${late ? 'font-semibold text-ko' : ''}`}
    >
      {late && <AlarmClock size={14} aria-label="En retard" />}
      {selText(f, 'prochaine-action') || 'Pas d’action prévue'}
      {relance && <span className={late ? '' : 'text-muted'}>· {frDate(relance)}</span>}
    </p>
  );
}
