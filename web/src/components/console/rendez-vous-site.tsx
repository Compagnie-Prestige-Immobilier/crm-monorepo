'use client';

import type { components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { CalendrierRvSite } from '@/components/console/calendrier-rv-site';
import { Label } from '@/components/ui/label';
import { getApiClient } from '@/lib/api/browser';
import type { CallbackSlot } from '@/lib/data/console';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

const CODE_RV_SITE = 'RV_SITE';
const CODES_RENDEZ_VOUS = new Set([
  'RENDEZ_VOUS',
  'RV_CPI',
  'RV_SITE',
  'RV_EXTERNE',
  'RDV_TELEPHONIQUE',
]);
const CLASSE_SELECT = 'h-11 rounded-md border border-input bg-background px-3 text-[0.875rem]';

interface RvSiteSaisie {
  siteId: string;
  pointRencontreId: string;
  pointRencontreCommentaire: string;
}

const VIDE: RvSiteSaisie = { siteId: '', pointRencontreId: '', pointRencontreCommentaire: '' };

type Choix = components['schemas']['QualificationRvSiteOutputBody'];

async function fetchRvSite(): Promise<Choix> {
  return unwrap(await getApiClient().GET('/api/v1/phase2/rv-site'));
}

function corpsRvSite(saisie: RvSiteSaisie) {
  const commentaire = saisie.pointRencontreCommentaire.trim();
  return {
    ...(saisie.siteId === '' ? {} : { siteId: saisie.siteId }),
    ...(saisie.pointRencontreId === '' ? {} : { pointRencontreId: saisie.pointRencontreId }),
    ...(commentaire === '' ? {} : { pointRencontreCommentaire: commentaire }),
  };
}

function ChampRvSite({
  id,
  libelle,
  erreur,
  valeur,
  vide,
  options,
  onChange,
}: {
  id: string;
  libelle: string;
  erreur: string | null;
  valeur: string;
  vide: string;
  options: readonly { id: string; libelle: string }[];
  onChange: (valeur: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{libelle} (obligatoire)</Label>
      <select
        id={id}
        required
        aria-invalid={erreur !== null}
        aria-describedby={erreur === null ? undefined : `${id}-erreur`}
        className={cn(CLASSE_SELECT, erreur !== null && 'border-destructive')}
        value={valeur}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        <option value="">{vide}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.libelle}
          </option>
        ))}
      </select>
      {erreur === null ? null : (
        <p id={`${id}-erreur`} className="text-[0.8125rem] text-destructive">
          {erreur}
        </p>
      )}
    </div>
  );
}

function ChampsRvSite({
  choix,
  saisie,
  verifie,
  onChange,
}: {
  choix: Choix | undefined;
  saisie: RvSiteSaisie;
  verifie: boolean;
  onChange: (patch: Partial<RvSiteSaisie>) => void;
}) {
  const manque = (valeur: string, texte: string): string | null =>
    verifie && valeur === '' ? texte : null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ChampRvSite
        id="rv-site-site"
        libelle="Site intéressé"
        erreur={manque(saisie.siteId, 'Choisissez le site avant la date.')}
        valeur={saisie.siteId}
        vide="Choisir un site"
        options={(choix?.sites ?? []).map((site) => ({
          id: site.id,
          libelle: `${site.nom} · ${formatNumber(site.prix)} FCFA`,
        }))}
        onChange={(siteId) => {
          onChange({ siteId });
        }}
      />
      <ChampRvSite
        id="rv-site-point"
        libelle="Point de rencontre"
        erreur={manque(saisie.pointRencontreId, 'Choisissez le point de rencontre avant la date.')}
        valeur={saisie.pointRencontreId}
        vide="Choisir un point"
        options={(choix?.points ?? []).map((point) => ({ id: point.id, libelle: point.label }))}
        onChange={(pointRencontreId) => {
          onChange({ pointRencontreId });
        }}
      />
    </div>
  );
}

/**
 * Ce qu'un RV site ajoute à l'appel : ses créneaux à la place des créneaux de
 * rappel, le site visité et le point de rencontre, exigés avant la date.
 */
export function useRvSite(code: string | undefined) {
  const estRvSite = code === CODE_RV_SITE;
  const [saisie, setSaisie] = useState<RvSiteSaisie>(VIDE);
  const [verifie, setVerifie] = useState(false);
  const choix = useQuery({
    queryKey: ['phase2', 'rv-site'],
    queryFn: fetchRvSite,
    refetchOnMount: 'always',
  });

  const [ouverture] = useState(() => Date.now());
  const sansRaccourci = code !== undefined && CODES_RENDEZ_VOUS.has(code);

  /** Les créneaux rapides selon le statut COURANT : un rendez-vous n'en a pas. */
  const filtrer = (slots: readonly CallbackSlot[] | null): readonly CallbackSlot[] | null =>
    slots !== null && sansRaccourci ? [] : slots;

  const calendrier = (choisi: string | null, onChoisir: (at: string) => void): ReactNode => {
    if (!estRvSite) return null;
    if (choix.data === undefined) {
      return <p className="text-[0.875rem] text-muted-foreground">Chargement des créneaux…</p>;
    }
    return (
      <CalendrierRvSite
        reglages={choix.data.reglages}
        reservations={choix.data.reservations}
        choisi={choisi}
        now={ouverture}
        onChoisir={onChoisir}
      />
    );
  };

  /** Vrai quand rien ne manque ; sinon l'erreur s'affiche sous le champ vide. */
  const verifier = (): boolean => {
    setVerifie(true);
    return !estRvSite || (saisie.siteId !== '' && saisie.pointRencontreId !== '');
  };

  return {
    filtrer,
    calendrier,
    verifier,
    champs: estRvSite ? (
      <ChampsRvSite
        choix={choix.data}
        saisie={saisie}
        verifie={verifie}
        onChange={(patch) => {
          setSaisie((avant) => ({ ...avant, ...patch }));
        }}
      />
    ) : null,
    corps: estRvSite ? corpsRvSite(saisie) : undefined,
  };
}

export type RvSiteConsole = ReturnType<typeof useRvSite>;
