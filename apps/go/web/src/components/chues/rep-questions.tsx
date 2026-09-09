import {
  Choix,
  Liste,
  OUI_NON,
  Question,
  REVELE,
  type OptionListe,
} from '@/components/chues/console-ui';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const AUCUN_SYNDICAT = 'aucun';

export interface ChampsJoignable {
  etablissementConfirme: boolean | null;
  setEtablissementConfirme: (valeur: boolean | null) => void;
  nouvelEtablissement: string;
  setNouvelEtablissement: (valeur: string) => void;
  contacte: boolean | null;
  setContacte: (valeur: boolean | null) => void;
  connaitUES: boolean | null;
  setConnaitUES: (valeur: boolean | null) => void;
  syndicatId: string | null;
  setSyndicatId: (valeur: string | null) => void;
  syndicatOptions: readonly OptionListe[];
  ambassadeur: boolean | null;
  setAmbassadeur: (valeur: boolean | null) => void;
  memeWhatsapp: boolean | null;
  setMemeWhatsapp: (valeur: boolean | null) => void;
  whatsapp: string;
  setWhatsapp: (valeur: string) => void;
}

/** Les questions qui n'ont de sens que si la personne a décroché. */
export function QuestionsJoignable(props: ChampsJoignable) {
  return (
    <>
      <Question titre="L’établissement de la fiche est-il confirmé ?" anime>
        <Choix
          options={OUI_NON}
          value={props.etablissementConfirme}
          onChange={(valeur) => {
            props.setEtablissementConfirme(valeur);
            if (valeur) props.setNouvelEtablissement('');
          }}
        />
        {props.etablissementConfirme === false ? (
          <div className={cn('flex max-w-80 flex-col gap-1.5', REVELE)}>
            <label htmlFor="rep-etablissement" className="text-[0.875rem] font-[600]">
              Nouvel établissement
            </label>
            <Input
              id="rep-etablissement"
              autoComplete="off"
              maxLength={160}
              value={props.nouvelEtablissement}
              onChange={(evenement) => {
                props.setNouvelEtablissement(evenement.target.value);
              }}
            />
          </div>
        ) : null}
      </Question>

      <Question titre="A-t-il déjà été contacté ?" anime>
        <Choix options={OUI_NON} value={props.contacte} onChange={props.setContacte} />
      </Question>

      <Question titre="Connaît-il l’UES ?" anime>
        <Choix options={OUI_NON} value={props.connaitUES} onChange={props.setConnaitUES} />
      </Question>

      <Question titre="Sur quel syndicat ? (facultatif)" anime>
        <div className="max-w-80">
          <Liste
            id="rep-syndicat"
            items={[{ value: AUCUN_SYNDICAT, label: 'Aucun' }, ...props.syndicatOptions]}
            value={props.syndicatId ?? AUCUN_SYNDICAT}
            placeholder="Choisir un syndicat"
            onChange={(valeur) => {
              props.setSyndicatId(valeur === AUCUN_SYNDICAT ? null : valeur);
            }}
          />
        </div>
      </Question>

      <Question titre="Souhaite-t-il être représentant CHUES ?" anime>
        <Choix
          options={OUI_NON}
          value={props.ambassadeur}
          onChange={(valeur) => {
            props.setAmbassadeur(valeur);
            if (!valeur) props.setMemeWhatsapp(null);
          }}
        />
      </Question>

      {props.ambassadeur === true ? (
        <Question titre="A-t-il WhatsApp sur ce numéro ?" anime>
          <Choix options={OUI_NON} value={props.memeWhatsapp} onChange={props.setMemeWhatsapp} />
          {props.memeWhatsapp === false ? (
            <div className={cn('flex max-w-80 flex-col gap-1.5', REVELE)}>
              <label htmlFor="rep-whatsapp" className="text-[0.875rem] font-[600]">
                Numéro WhatsApp
              </label>
              <Input
                id="rep-whatsapp"
                inputMode="tel"
                autoComplete="off"
                placeholder="77 123 45 67"
                value={props.whatsapp}
                onChange={(evenement) => {
                  props.setWhatsapp(evenement.target.value);
                }}
              />
            </div>
          ) : null}
        </Question>
      ) : null}
    </>
  );
}

export interface ChampsSuggestion {
  sugPhone: string;
  setSugPhone: (valeur: string) => void;
  sugName: string;
  setSugName: (valeur: string) => void;
  sugNote: string;
  setSugNote: (valeur: string) => void;
}

export function QuestionSuggestion(props: ChampsSuggestion) {
  return (
    <Question titre="Il propose quelqu’un d’autre ? (facultatif)" anime>
      <div className="flex max-w-96 flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rep-sug-phone" className="text-[0.875rem] font-[600]">
            Son numéro
          </label>
          <Input
            id="rep-sug-phone"
            inputMode="tel"
            autoComplete="off"
            placeholder="77 123 45 67"
            value={props.sugPhone}
            onChange={(evenement) => {
              props.setSugPhone(evenement.target.value);
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rep-sug-name" className="text-[0.875rem] font-[600]">
            Son nom et prénom
          </label>
          <Input
            id="rep-sug-name"
            autoComplete="off"
            maxLength={160}
            value={props.sugName}
            onChange={(evenement) => {
              props.setSugName(evenement.target.value);
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rep-sug-note" className="text-[0.875rem] font-[600]">
            Sa remarque
          </label>
          <Textarea
            id="rep-sug-note"
            rows={2}
            maxLength={2000}
            value={props.sugNote}
            onChange={(evenement) => {
              props.setSugNote(evenement.target.value);
            }}
          />
        </div>
      </div>
    </Question>
  );
}
