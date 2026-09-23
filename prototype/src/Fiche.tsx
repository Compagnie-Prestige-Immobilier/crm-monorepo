import {
  ArrowLeft,
  BookOpen,
  Copy,
  MessageCircle,
  MoreHorizontal,
  RefreshCw,
  Save,
  Send,
  Trash2,
} from 'lucide-react';
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
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from 'react-aria-components';
import { toast } from 'sonner';
import { useLocation } from 'wouter';

import {
  blankFiche,
  buildBilan,
  CLASSES,
  computeScore,
  type Fiche,
  ficheText,
  missingFields,
  normTel,
  type Residence,
  type Sector,
  SECTOR_DESCRIPTIONS,
  SECTOR_LABELS,
  telKey,
} from './bant';
import { phaseOf, PHASES, phaseProgress, selText, withoutHiddenValues } from './fields';
import { Notation, PhaseForm, type Update } from './Form';
import { ScorePanel } from './ScorePanel';
import { fiches, lots, upsertFiche } from './store';
import { Button, buttonClass, ClassStamp, Sheet } from './ui';

const SECTORS = Object.keys(SECTOR_LABELS) as Sector[];
const segment =
  'focus-ring min-h-11 flex-1 cursor-pointer rounded-lg px-3 text-sm font-semibold text-muted transition data-[hovered]:text-ink data-[selected]:bg-paper data-[selected]:text-brand data-[selected]:shadow-sm';

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
    const key = telKey(fiche.values.telephone ?? '');
    const duplicate = fiches
      .get()
      .find((x) => x.id !== fiche.id && key && telKey(x.values.telephone ?? '') === key);
    if (duplicate) {
      const owner = duplicate.values.commercial
        ? `, suivie par ${duplicate.values.commercial}`
        : '';
      toast.warning(
        `Ce numéro existe déjà : ${duplicate.values['prospect-name'] ?? duplicate.values.company}${owner}.`,
        {
          action: { label: 'Ouvrir', onClick: () => navigate(`/fiche/${duplicate.id}`) },
        },
      );
      return;
    }
    const now = new Date().toISOString();
    const note = (fiche.values['compte-rendu'] ?? '').trim();
    const values = { ...fiche.values };
    delete values['compte-rendu'];
    const entry = {
      date: now,
      etape: selText(fiche, 'etape'),
      action: selText(fiche, 'prochaine-action'),
      commercial: fiche.values.commercial ?? '',
      note,
    };
    const next: Fiche = {
      ...fiche,
      id: fiche.id || `F${Date.now()}`,
      maj: now,
      values,
      history: note ? [...fiche.history, entry] : fiche.history,
    };
    upsertFiche(next);
    setFiche(next);
    setShowErrors(false);
    const noConsent =
      ['revenu', 'mensualites', 'apport'].some((k) => values[k]) && !values['consent-date'];
    toast.success(
      `Fiche enregistrée${note ? ', compte-rendu ajouté' : ''}.${noConsent ? ' Consentement non recueilli.' : ''}`,
    );
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
        <ClassStamp classe={score.classe} />
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
      <Sheet isOpen={guideOpen} onOpenChange={setGuideOpen} title="Guide de qualification">
        <Guide />
      </Sheet>
    </div>
  );
}

const menuItem =
  'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm outline-none data-[focused]:bg-brand-soft';
const tabClass =
  'focus-ring -mb-px flex min-h-14 shrink-0 cursor-pointer flex-col justify-center border-b-2 border-transparent px-3 text-left text-muted outline-none transition data-[hovered]:text-ink data-[selected]:border-brand data-[selected]:text-ink';

function Bilan({
  fiche,
  onClose,
  copy,
}: {
  fiche: Fiche;
  onClose: () => void;
  copy: (text: string, done: string) => void;
}) {
  const catalogue = lots.use();
  const [text, setText] = useState(() => buildBilan(fiche, catalogue));
  const tel = normTel(fiche.values.telephone ?? '');
  const wrongCountry =
    fiche.residence === 'diaspora' && tel.startsWith('221') && !!fiche.values.pays;
  return (
    <Sheet isOpen onOpenChange={(open) => !open && onClose()} title="Bilan pour le prospect">
      <p className="mb-3 text-sm text-muted">
        Ni score, ni freins, ni conformité. Relisez et modifiez avant l'envoi.
      </p>
      <TextField aria-label="Message au prospect" value={text} onChange={setText}>
        <TextArea className="field-box min-h-80 py-3 leading-relaxed" />
      </TextField>
      {!fiche.values.commercial && (
        <p className="mt-2 text-xs text-gold-text">
          Renseignez « Conseiller en charge » (Closing) pour signer le message.
        </p>
      )}
      {wrongCountry && (
        <p className="mt-2 text-xs text-ko">
          Vérifiez le numéro : pour la diaspora, saisir l'indicatif du pays.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`https://wa.me/${tel}?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
          className={buttonClass('whatsapp')}
        >
          <MessageCircle size={16} />
          Ouvrir dans WhatsApp
        </Link>
        <Button onPress={() => copy(text, 'Bilan copié.')}>
          <Copy size={16} />
          Copier
        </Button>
        <Button variant="ghost" onPress={() => setText(buildBilan(fiche, catalogue))}>
          <RefreshCw size={16} />
          Régénérer
        </Button>
      </div>
    </Sheet>
  );
}

function Guide() {
  return (
    <div className="space-y-5 text-sm leading-relaxed">
      <p>
        La fiche est remplie par le conseiller, jamais par le prospect. Elle se complète au fil des
        échanges. Chaque échange apporte quelque chose au prospect : plan, simulation, visite,
        bilan.
      </p>
      <div>
        <h3 className="mb-2 font-display text-base font-semibold">Deux indicateurs distincts</h3>
        <p>
          <b>Score prospect (sur 100)</b> : maturité du prospect, pour prioriser les relances.{' '}
          <b>Adéquation de l'offre</b> : le lot proposé correspond-il à ce qu'il cherche ? Elle
          n'entre pas dans le score.
        </p>
      </div>
      <table className="w-full text-left">
        <caption className="mb-2 text-left font-display text-base font-semibold">Barème</caption>
        <tbody className="divide-y divide-line">
          <tr>
            <th className="py-2 pr-3">Budget</th>
            <td className="pr-3 tabular-nums">30</td>
            <td className="text-muted">
              Note × 6, plafonnée à 24 si capacité limite, 12 si insuffisante
            </td>
          </tr>
          <tr>
            <th className="py-2 pr-3">Autorité</th>
            <td className="tabular-nums">20</td>
            <td className="text-muted">Note × 4</td>
          </tr>
          <tr>
            <th className="py-2 pr-3">Besoin</th>
            <td className="tabular-nums">20</td>
            <td className="text-muted">Note × 4</td>
          </tr>
          <tr>
            <th className="py-2 pr-3">Calendrier</th>
            <td className="tabular-nums">15</td>
            <td className="text-muted">Note × 3</td>
          </tr>
          <tr>
            <th className="py-2 pr-3">Engagement</th>
            <td className="tabular-nums">15</td>
            <td className="text-muted">Automatique : étape, visites, client existant</td>
          </tr>
        </tbody>
      </table>
      <div>
        <h3 className="mb-2 font-display text-base font-semibold">Classes</h3>
        <p>
          <b>A</b> À conclure (75+) · <b>B</b> À pousser (55 à 74) · <b>C</b> À faire mûrir (35 à
          54) · <b>D</b> À éduquer (moins de 35).
        </p>
        <p className="mt-1 text-muted">
          Budget noté 1, capacité insuffisante ou autorité notée 1 : classe C au mieux. Prospect
          perdu : classe D.
        </p>
      </div>
      <div>
        <h3 className="mb-2 font-display text-base font-semibold">Questions sensibles</h3>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>Revenu : proposer une fourchette (« plutôt 300 000, 500 000, un million ? »).</li>
          <li>
            Crédits : « Vous avez déjà des prélèvements chaque mois ? Un prêt Tabaski, une avance,
            une tontine ? »
          </li>
          <li>
            Conformité : « La loi nous oblige à vérifier l'origine des fonds. C'est aussi ce qui
            garantit que personne ne pourra contester votre terrain. »
          </li>
          <li>Toujours recueillir le consentement avant les questions d'argent.</li>
        </ul>
      </div>
    </div>
  );
}
