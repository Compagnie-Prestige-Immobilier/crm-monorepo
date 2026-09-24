'use client';

import { unwrap } from '@crm/api-client/query';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { CalendrierRvSite } from '@/components/console/calendrier-rv-site';
import { Label } from '@/components/ui/label';
import { getApiClient } from '@/lib/api/browser';
import type { CallbackSlot } from '@/lib/data/console';
import { formatNumber } from '@/lib/format';

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

type Choix = Awaited<ReturnType<typeof fetchRvSite>>;

async function fetchRvSite() {
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

function ChampsRvSite({
  choix,
  saisie,
  onChange,
}: {
  choix: Choix | undefined;
  saisie: RvSiteSaisie;
  onChange: (patch: Partial<RvSiteSaisie>) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <Label htmlFor="rv-site-site">Site intéressé</Label>
        <select
          id="rv-site-site"
          className={CLASSE_SELECT}
          value={saisie.siteId}
          onChange={(event) => {
            onChange({ siteId: event.target.value });
          }}
        >
          <option value="">Choisir un site</option>
          {(choix?.sites ?? []).map((site) => (
            <option key={site.id} value={site.id}>
              {site.nom} · {formatNumber(site.prix)} FCFA
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="rv-site-point">Point de rencontre</Label>
        <select
          id="rv-site-point"
          className={CLASSE_SELECT}
          value={saisie.pointRencontreId}
          onChange={(event) => {
            onChange({ pointRencontreId: event.target.value });
          }}
        >
          <option value="">Choisir un point</option>
          {(choix?.points ?? []).map((point) => (
            <option key={point.id} value={point.id}>
              {point.label}
            </option>
          ))}
        </select>
      </div>
      {/* <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="rv-site-point-commentaire">Précision sur le point de rencontre</Label>
        <Input
          id="rv-site-point-commentaire"
          maxLength={500}
          value={saisie.pointRencontreCommentaire}
          onChange={(event) => {
            onChange({ pointRencontreCommentaire: event.target.value });
          }}
        />
      </div> */}
    </div>
  );
}

/**
 * Ce qu'un RV site ajoute à l'appel : ses créneaux à la place des créneaux de
 * rappel, puis le site visité et le point de rencontre dans la note.
 */
export function useRvSite(code: string | undefined) {
  const estRvSite = code === CODE_RV_SITE;
  const [saisie, setSaisie] = useState<RvSiteSaisie>(VIDE);
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

  return {
    filtrer,
    calendrier,
    champs: estRvSite ? (
      <ChampsRvSite
        choix={choix.data}
        saisie={saisie}
        onChange={(patch) => {
          setSaisie((avant) => ({ ...avant, ...patch }));
        }}
      />
    ) : null,
    corps: estRvSite ? corpsRvSite(saisie) : undefined,
  };
}

export type RvSiteConsole = ReturnType<typeof useRvSite>;
