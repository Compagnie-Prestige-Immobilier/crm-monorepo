import { useMutation } from '@tanstack/react-query';
import { LoaderIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  ChampCommentaire,
  ChampJour,
  ChampsReferentiels,
  courantsDe,
  COMMENTAIRE_MAX,
  NOM_MAX,
  TELEPHONE_MAX,
} from '@/components/accueil/visite-form-champs';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  COLONNES_VISITE,
  corrigerVisite,
  correctionVisite,
  creerVisite,
  maintenantDakar,
  type CreerVisite,
  type ReferentielsVisite,
  type Visite,
} from '@/lib/data/visites';
import { toastApiError } from '@/lib/mutation-feedback';

type Champ = 'visitorName' | 'phone' | 'comment' | 'entrepriseId' | 'objetId' | 'date';
type Erreurs = Partial<Record<Champ, string>>;

interface Saisie {
  date: string;
  time: string;
  visitorName: string;
  phone: string;
  entrepriseId: string | null;
  directionId: string | null;
  destinataireId: string | null;
  objetId: string | null;
  comment: string;
}

function depart(visite: Visite | null): Saisie {
  const maintenant = maintenantDakar();
  if (visite === null) {
    return {
      date: maintenant.date,
      time: maintenant.time,
      visitorName: '',
      phone: '',
      entrepriseId: null,
      directionId: null,
      destinataireId: null,
      objetId: null,
      comment: '',
    };
  }
  const courants = courantsDe(visite);
  return {
    date: visite.date,
    // Une ligne dont l'heure n'a pas été relevée ne repart pas estampillée de
    // l'heure de la correction.
    time: visite.time ?? '',
    visitorName: visite.visitorName,
    phone: visite.phone ?? '',
    entrepriseId: visite.entreprise.id,
    directionId: courants.direction?.id ?? null,
    destinataireId: courants.destinataire?.id ?? null,
    objetId: visite.objet.id,
    comment: visite.comment ?? '',
  };
}

function verifier(saisie: Saisie): Erreurs {
  const erreurs: Erreurs = {};
  const nom = saisie.visitorName.trim();
  if (nom === '') erreurs.visitorName = 'À renseigner.';
  else if (nom.length < 2) erreurs.visitorName = 'Au moins deux caractères.';
  if (saisie.phone.trim().length > TELEPHONE_MAX) erreurs.phone = 'Numéro trop long.';
  if (saisie.comment.trim().length > COMMENTAIRE_MAX) erreurs.comment = 'Commentaire trop long.';
  if (saisie.entrepriseId === null) erreurs.entrepriseId = 'À choisir dans la liste.';
  if (saisie.objetId === null) erreurs.objetId = 'À choisir dans la liste.';
  if (saisie.date === '') erreurs.date = 'À renseigner.';
  return erreurs;
}

function corps(saisie: Saisie, entrepriseId: string, objetId: string): CreerVisite {
  return {
    date: saisie.date,
    visitorName: saisie.visitorName.trim(),
    entrepriseId,
    objetId,
    ...(saisie.time === '' ? {} : { time: saisie.time }),
    ...(saisie.phone.trim() === '' ? {} : { phone: saisie.phone.trim() }),
    ...(saisie.directionId === null ? {} : { directionId: saisie.directionId }),
    ...(saisie.destinataireId === null ? {} : { destinataireId: saisie.destinataireId }),
    ...(saisie.comment.trim() === '' ? {} : { comment: saisie.comment.trim() }),
  };
}

/** La file d'attente : l'entreprise reste, tout le reste repart de zéro. */
function suivantDeLaFile(courant: Saisie): Saisie {
  const maintenant = maintenantDakar();
  return {
    ...courant,
    date: maintenant.date,
    time: maintenant.time,
    visitorName: '',
    phone: '',
    directionId: null,
    destinataireId: null,
    objetId: null,
    comment: '',
  };
}

export function VisiteForm({
  referentiels,
  visite = null,
  onSaved,
  onCancel,
}: {
  referentiels: ReferentielsVisite | undefined;
  visite?: Visite | null;
  onSaved: () => void;
  onCancel?: (() => void) | undefined;
}) {
  const nomRef = useRef<HTMLInputElement>(null);
  const [saisie, setSaisie] = useState<Saisie>(() => depart(visite));
  const [erreurs, setErreurs] = useState<Erreurs>({});

  const correction = visite !== null;
  const courants = courantsDe(visite);
  const poser = (patch: Partial<Saisie>): void => {
    setSaisie((courant) => ({ ...courant, ...patch }));
  };

  const enregistrer = useMutation({
    mutationFn: (body: CreerVisite) =>
      correction ? corrigerVisite(visite.id, correctionVisite(visite, body)) : creerVisite(body),
    onSuccess: (enregistree) => {
      onSaved();
      if (correction) {
        toast.success(`Visite ${enregistree.reference} corrigée.`);
        return;
      }
      toast.success(`Visite ${enregistree.reference} enregistrée.`);
      setSaisie(suivantDeLaFile);
      setErreurs({});
      nomRef.current?.focus();
    },
    onError: (error) => {
      toastApiError(error, 'La visite n’a pas pu être enregistrée.');
    },
  });

  function soumettre(): void {
    if (enregistrer.isPending) return;
    const trouvees = verifier(saisie);
    setErreurs(trouvees);
    const { entrepriseId, objetId } = saisie;
    if (entrepriseId === null || objetId === null) return;
    if (Object.keys(trouvees).length > 0) return;
    enregistrer.mutate(corps(saisie, entrepriseId, objetId));
  }

  return (
    <form
      aria-label={correction ? 'Corriger la visite' : 'Enregistrer une visite'}
      className="flex flex-col gap-4"
      onSubmit={(evenement) => {
        evenement.preventDefault();
        soumettre();
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <ChampJour
          correction={correction}
          date={saisie.date}
          erreur={erreurs.date}
          onChange={(date) => {
            poser({ date });
          }}
        />

        <Field label={COLONNES_VISITE.time}>
          {(props) => (
            <Input
              {...props}
              type="time"
              value={saisie.time}
              onChange={(evenement) => {
                poser({ time: evenement.target.value });
              }}
            />
          )}
        </Field>

        <Field label={COLONNES_VISITE.visitorName} required error={erreurs.visitorName}>
          {(props) => (
            <Input
              {...props}
              ref={nomRef}
              maxLength={NOM_MAX}
              autoComplete="off"
              value={saisie.visitorName}
              onChange={(evenement) => {
                poser({ visitorName: evenement.target.value });
              }}
            />
          )}
        </Field>

        <Field label={COLONNES_VISITE.phone} error={erreurs.phone}>
          {(props) => (
            <Input
              {...props}
              type="tel"
              maxLength={TELEPHONE_MAX}
              autoComplete="off"
              value={saisie.phone}
              onChange={(evenement) => {
                poser({ phone: evenement.target.value });
              }}
            />
          )}
        </Field>

        <ChampsReferentiels
          referentiels={referentiels}
          courants={courants}
          valeurs={saisie}
          erreurs={erreurs}
          onChange={poser}
        />
      </div>

      <ChampCommentaire
        valeur={saisie.comment}
        erreur={erreurs.comment}
        onChange={(comment) => {
          poser({ comment });
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={enregistrer.isPending}>
          {enregistrer.isPending ? (
            <LoaderIcon className="animate-spin" aria-hidden="true" />
          ) : null}
          {correction ? 'Enregistrer la correction' : 'Enregistrer la visite'}
        </Button>
        {onCancel === undefined ? null : (
          <Button type="button" size="lg" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
        )}
      </div>
    </form>
  );
}
