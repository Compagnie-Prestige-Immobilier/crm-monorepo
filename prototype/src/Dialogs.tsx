import { Copy, MessageCircle, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Link, TextArea, TextField } from 'react-aria-components';

import { buildBilan, type Fiche, normTel } from './bant';
import { lots } from './store';
import { Button, buttonClass, Sheet } from './ui';

export function Bilan({
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

const BAREME = [
  ['Budget', 30, 'Note × 6, plafonnée à 24 si capacité limite, 12 si insuffisante'],
  ['Autorité', 20, 'Note × 4'],
  ['Besoin', 20, 'Note × 4'],
  ['Calendrier', 15, 'Note × 3'],
  ['Engagement', 15, 'Automatique : étape, visites, client existant'],
] as const;

const QUESTIONS = [
  'Revenu : proposer une fourchette (« plutôt 300 000, 500 000, un million ? »).',
  'Crédits : « Vous avez déjà des prélèvements chaque mois ? Un prêt Tabaski, une avance, une tontine ? »',
  "Conformité : « La loi nous oblige à vérifier l'origine des fonds. C'est aussi ce qui garantit que personne ne pourra contester votre terrain. »",
  "Toujours recueillir le consentement avant les questions d'argent.",
];

export function Guide({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const heading = 'mb-2 font-display text-base font-semibold';
  return (
    <Sheet isOpen={isOpen} onOpenChange={onOpenChange} title="Guide de qualification">
      <div className="space-y-5 text-sm leading-relaxed">
        <p>
          La fiche est remplie par le conseiller, jamais par le prospect. Elle se complète au fil
          des échanges. Chaque échange apporte quelque chose au prospect : plan, simulation, visite,
          bilan.
        </p>
        <div>
          <h3 className={heading}>Deux indicateurs distincts</h3>
          <p>
            <b>Score prospect (sur 100)</b> : maturité du prospect, pour prioriser les relances.{' '}
            <b>Adéquation de l'offre</b> : le lot proposé correspond-il à ce qu'il cherche ? Elle
            n'entre pas dans le score.
          </p>
        </div>
        <table className="w-full text-left">
          <caption className={`${heading} text-left`}>Barème</caption>
          <tbody className="divide-y divide-line">
            {BAREME.map(([critere, points, calcul]) => (
              <tr key={critere}>
                <th className="py-2 pr-3">{critere}</th>
                <td className="pr-3 tabular-nums">{points}</td>
                <td className="text-muted">{calcul}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div>
          <h3 className={heading}>Classes</h3>
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
          <h3 className={heading}>Questions sensibles</h3>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            {QUESTIONS.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      </div>
    </Sheet>
  );
}
