'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon, PencilIcon, PlusIcon, XIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createCanalVente,
  createSiteVente,
  formatFcfa,
  setCanalVenteActive,
  setSiteVenteActive,
  updateSiteVente,
  type CanalVente,
  type SiteVente,
  type SiteVenteInput,
  type SuperficieSite,
} from '@/lib/data/ventes';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

const MODES = [
  { value: 'AUCUNE', label: 'Pas d’apporteur' },
  { value: 'POURCENTAGE_PROPRIETAIRE', label: 'Un pourcentage de la part propriétaire' },
  { value: 'MONTANT_PAR_LOT', label: 'Un montant fixe par lot' },
  { value: 'MONTANT_TOTAL', label: 'Un montant fixe par vente' },
];

const entier = (brut: string) => Number(brut.replace(/\D/g, '')) || 0;

const siteInput = (site: SiteVente | null, ordre: number): SiteVenteInput =>
  site === null
    ? {
        nom: '',
        ordre,
        superficieDefaut: '',
        prixUnitaireDefaut: 0,
        partProprietaireParLot: 0,
        partApporteurMode: 'AUCUNE',
        partApporteurValeur: 0,
        superficies: [],
      }
    : {
        nom: site.nom,
        ordre: site.ordre,
        ...(site.totalLots === null ? {} : { totalLots: site.totalLots }),
        superficieDefaut: site.superficieDefaut,
        prixUnitaireDefaut: site.prixUnitaireDefaut,
        partProprietaireParLot: site.partProprietaireParLot,
        partApporteurMode: site.partApporteurMode,
        partApporteurValeur: site.partApporteurValeur,
        superficies: site.superficies,
      };

export function PageReglages({
  sites,
  canaux,
}: {
  sites: readonly SiteVente[];
  canaux: readonly CanalVente[];
}) {
  const queryClient = useQueryClient();
  const [edition, setEdition] = useState<SiteVente | null | 'nouveau'>(null);
  const rafraichir = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.ventesConfiguration });
  const activerSite = useMutation({
    mutationFn: (site: SiteVente) => setSiteVenteActive(site.id, !site.actif),
    onSuccess: () => void rafraichir(),
    onError: (error) => toastApiError(error, 'Le site n’a pas pu être modifié.'),
  });
  return (
    <div className="flex flex-col gap-8">
      <Section
        titre="Les sites"
        aide="Le prix et les parts sont proposés à chaque nouvelle vente sur ce site."
        action={
          <Button onClick={() => setEdition('nouveau')}>
            <PlusIcon aria-hidden="true" /> Ajouter un site
          </Button>
        }
      >
        {sites.map((site) => (
          <li key={site.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <strong
              className={
                site.actif
                  ? 'min-w-40 flex-1'
                  : 'min-w-40 flex-1 text-muted-foreground line-through'
              }
            >
              {site.nom}
            </strong>
            <Button variant="outline" size="sm" onClick={() => setEdition(site)}>
              <PencilIcon aria-hidden="true" /> Modifier
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={activerSite.isPending}
              onClick={() => activerSite.mutate(site)}
            >
              {site.actif ? 'Retirer' : 'Remettre'}
            </Button>
          </li>
        ))}
      </Section>
      <Canaux canaux={canaux} onChange={() => void rafraichir()} />
      {edition === null ? null : (
        <SiteDialog
          site={edition === 'nouveau' ? null : edition}
          ordre={sites.length + 1}
          onFermer={() => setEdition(null)}
          onEnregistre={() => {
            void rafraichir();
            setEdition(null);
          }}
        />
      )}
    </div>
  );
}

function Section({
  titre,
  aide,
  action,
  children,
}: {
  titre: string;
  aide: string;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[1.125rem] font-[700]">{titre}</h2>
          <p className="text-[0.875rem] text-muted-foreground">{aide}</p>
        </div>
        {action}
      </div>
      <Card className="gap-0 p-0">
        <ul className="divide-y divide-border">{children}</ul>
      </Card>
    </section>
  );
}

function Canaux({ canaux, onChange }: { canaux: readonly CanalVente[]; onChange: () => void }) {
  const [nouveau, setNouveau] = useState('');
  const ajouter = useMutation({
    mutationFn: () => createCanalVente({ libelle: nouveau.trim(), ordre: canaux.length + 1 }),
    onSuccess: (canal) => {
      onChange();
      setNouveau('');
      toast.success(`Canal ${canal.libelle} ajouté.`);
    },
    onError: (error) => toastApiError(error, 'Le canal n’a pas pu être ajouté.'),
  });
  const activer = useMutation({
    mutationFn: (canal: CanalVente) => setCanalVenteActive(canal.id, !canal.actif),
    onSuccess: onChange,
    onError: (error) => toastApiError(error, 'Le canal n’a pas pu être modifié.'),
  });
  return (
    <Section
      titre="Les canaux"
      aide="D'où vient le client. Un canal retiré n'est plus proposé, les anciennes ventes le gardent."
      action={
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (nouveau.trim() !== '') ajouter.mutate();
          }}
        >
          <Input
            aria-label="Nouveau canal"
            placeholder="Nouveau canal"
            value={nouveau}
            onChange={(e) => setNouveau(e.target.value)}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={ajouter.isPending || nouveau.trim() === ''}
          >
            <PlusIcon aria-hidden="true" /> Ajouter
          </Button>
        </form>
      }
    >
      {canaux.map((canal) => (
        <li key={canal.id} className="flex items-center gap-3 px-4 py-3">
          <strong className={canal.actif ? 'flex-1' : 'flex-1 text-muted-foreground line-through'}>
            {canal.libelle}
          </strong>
          <Button
            variant="ghost"
            size="sm"
            disabled={activer.isPending}
            onClick={() => activer.mutate(canal)}
          >
            {canal.actif ? 'Retirer' : 'Remettre'}
          </Button>
        </li>
      ))}
    </Section>
  );
}

function SiteDialog({
  site,
  ordre,
  onFermer,
  onEnregistre,
}: {
  site: SiteVente | null;
  ordre: number;
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const [draft, setDraft] = useState<SiteVenteInput>(() => siteInput(site, ordre));
  const changer = (patch: Partial<SiteVenteInput>) => setDraft((d) => ({ ...d, ...patch }));
  const enregistrer = useMutation({
    mutationFn: () => {
      const input = {
        ...draft,
        superficies: (draft.superficies ?? []).filter(
          (s) => s.superficie.trim() !== '' && s.prix > 0,
        ),
      };
      return site === null ? createSiteVente(input) : updateSiteVente(site.id, input);
    },
    onSuccess: (enregistre) => {
      toast.success(`Site ${enregistre.nom} enregistré.`);
      onEnregistre();
    },
    onError: (error) => toastApiError(error, 'Le site n’a pas pu être enregistré.'),
  });
  const changerTotalLots = (brut: string) =>
    setDraft(({ totalLots: _ancien, ...reste }) =>
      brut === '' ? reste : { ...reste, totalLots: entier(brut) },
    );
  return (
    <Dialog open onOpenChange={(o) => (o ? null : onFermer())}>
      <DialogContent className="sm:max-w-xl">
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.nom.trim() !== '') enregistrer.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>{site === null ? 'Nouveau site' : site.nom}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Champ label="Nom du site">
              <Input
                value={draft.nom}
                placeholder="Ex. THIEO"
                onChange={(e) => changer({ nom: e.target.value })}
              />
            </Champ>
            <Champ label="Nombre total de lots">
              <Input
                inputMode="numeric"
                value={draft.totalLots ?? ''}
                placeholder="Pas encore connu"
                onChange={(e) => changerTotalLots(e.target.value)}
              />
            </Champ>
            <Champ label="Prix d'un lot" aide={formatFcfa(draft.prixUnitaireDefaut)}>
              <Input
                inputMode="numeric"
                value={draft.prixUnitaireDefaut || ''}
                placeholder="0"
                onChange={(e) => changer({ prixUnitaireDefaut: entier(e.target.value) })}
              />
            </Champ>
            <Champ
              label="Part du propriétaire par lot"
              aide={formatFcfa(draft.partProprietaireParLot)}
            >
              <Input
                inputMode="numeric"
                value={draft.partProprietaireParLot || ''}
                placeholder="0"
                onChange={(e) => changer({ partProprietaireParLot: entier(e.target.value) })}
              />
            </Champ>
            <Champ label="Part de l'apporteur">
              <Select
                items={MODES}
                value={draft.partApporteurMode}
                onValueChange={(mode) =>
                  changer({ partApporteurMode: mode ?? 'AUCUNE', partApporteurValeur: 0 })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODES.map((mode) => (
                    <SelectItem key={mode.value} value={mode.value}>
                      {mode.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Champ>
            <ValeurApporteur
              mode={draft.partApporteurMode}
              valeur={draft.partApporteurValeur}
              onChange={(partApporteurValeur) => changer({ partApporteurValeur })}
            />
            <Champ label="Superficie habituelle">
              <Input
                value={draft.superficieDefaut}
                placeholder="Ex. 225 m²"
                onChange={(e) => changer({ superficieDefaut: e.target.value })}
              />
            </Champ>
          </div>
          <SuperficiesAuChoix
            superficies={draft.superficies ?? []}
            onChange={(superficies) => changer({ superficies })}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFermer}>
              Annuler
            </Button>
            <Button type="submit" disabled={enregistrer.isPending || draft.nom.trim() === ''}>
              {enregistrer.isPending ? (
                <LoaderIcon className="animate-spin" aria-hidden="true" />
              ) : null}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SuperficiesAuChoix({
  superficies,
  onChange,
}: {
  superficies: readonly SuperficieSite[];
  onChange: (superficies: SuperficieSite[]) => void;
}) {
  const remplacer = (rang: number, patch: Partial<SuperficieSite>) =>
    onChange(superficies.map((s, i) => (i === rang ? { ...s, ...patch } : s)));
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-[0.9375rem] font-[600]">Superficies au choix</legend>
      <p className="text-[0.8125rem] text-muted-foreground">
        Chacune avec son prix. La vente demande alors la superficie.
      </p>
      {superficies.map((s, rang) => (
        <div key={rang} className="flex items-center gap-2">
          <Input
            aria-label="Superficie"
            placeholder="Ex. 200 m²"
            value={s.superficie}
            onChange={(e) => remplacer(rang, { superficie: e.target.value })}
          />
          <Input
            aria-label={`Prix d'un lot de ${s.superficie || 'cette superficie'}`}
            inputMode="numeric"
            placeholder="Prix d'un lot"
            value={s.prix ? s.prix.toLocaleString('fr-FR') : ''}
            onChange={(e) => remplacer(rang, { prix: entier(e.target.value) })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Retirer cette superficie"
            onClick={() => onChange(superficies.filter((_, i) => i !== rang))}
          >
            <XIcon aria-hidden="true" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => onChange([...superficies, { superficie: '', prix: 0 }])}
      >
        <PlusIcon aria-hidden="true" /> Ajouter une superficie
      </Button>
    </fieldset>
  );
}

function ValeurApporteur({
  mode,
  valeur,
  onChange,
}: {
  mode: string;
  valeur: number;
  onChange: (valeur: number) => void;
}) {
  if (mode === 'AUCUNE') return null;
  if (mode === 'POURCENTAGE_PROPRIETAIRE') {
    return (
      <Champ label="Pourcentage">
        <Input
          inputMode="numeric"
          value={valeur || ''}
          placeholder="10"
          onChange={(e) => onChange(Math.min(100, entier(e.target.value)))}
        />
      </Champ>
    );
  }
  return (
    <Champ label="Montant" aide={formatFcfa(valeur)}>
      <Input
        inputMode="numeric"
        value={valeur || ''}
        placeholder="0"
        onChange={(e) => onChange(entier(e.target.value))}
      />
    </Champ>
  );
}

function Champ({ label, aide, children }: { label: string; aide?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[0.9375rem] font-[600]">
      {label}
      {children}
      {aide ? (
        <span className="text-[0.8125rem] font-[400] text-muted-foreground">{aide}</span>
      ) : null}
    </label>
  );
}
