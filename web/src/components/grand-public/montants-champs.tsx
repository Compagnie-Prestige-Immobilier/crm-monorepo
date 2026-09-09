import type { EtatFiche } from '@/components/grand-public/corps-prospect';
import { FilterCombobox } from '@/components/ui/filter-combobox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PaymentMode } from '@/lib/data/console';
import { DUREES_MOIS, PAYMENT_MODE_LABELS, formatDureeMois } from '@/lib/data/grand-public';
import { actifs, libelle, type ReferentielItem, type Referentiels } from '@/lib/data/referentiels';

/** Revenu, paiement, durée et provenance : ce qui chiffre la fiche. */
export function MontantsChamps({
  etat,
  referentiels,
  canaux,
  onPoser,
}: {
  etat: EtatFiche;
  referentiels: Referentiels | undefined;
  canaux: readonly ReferentielItem[] | undefined;
  onPoser: (patch: Partial<EtatFiche>) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FilterCombobox
        label="Revenu mensuel"
        placeholder="Choisir une tranche"
        value={etat.incomeBandId}
        options={actifs(referentiels?.incomeBands).map((item) => ({
          value: item.id,
          label: libelle(item),
        }))}
        onChange={(incomeBandId) => {
          onPoser({ incomeBandId });
        }}
      />

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="gp-paiement">Paiement</Label>
        <Select
          value={etat.paymentMode ?? ''}
          onValueChange={(valeur) => {
            const mode = valeur === null || valeur === '' ? null : (valeur as PaymentMode);
            onPoser({ paymentMode: mode, ...(mode === 'ECHELONNE' ? {} : { dureeMois: null }) });
          }}
        >
          <SelectTrigger id="gp-paiement">
            <SelectValue placeholder="Choisir un mode" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PAYMENT_MODE_LABELS).map(([cle, texte]) => (
              <SelectItem key={cle} value={cle}>
                {texte}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {etat.paymentMode === 'ECHELONNE' ? (
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="gp-duree">Durée de remboursement</Label>
          <Select
            value={etat.dureeMois === null ? '' : String(etat.dureeMois)}
            onValueChange={(valeur) => {
              onPoser({ dureeMois: valeur === null || valeur === '' ? null : Number(valeur) });
            }}
          >
            <SelectTrigger id="gp-duree">
              <SelectValue placeholder="Choisir une durée" />
            </SelectTrigger>
            <SelectContent>
              {DUREES_MOIS.map((mois) => (
                <SelectItem key={mois} value={String(mois)}>
                  {formatDureeMois(mois)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <FilterCombobox
        label="Canal de provenance"
        placeholder="Choisir un canal"
        value={etat.canalId}
        options={actifs(canaux).map((item) => ({ value: item.id, label: libelle(item) }))}
        onChange={(canalId) => {
          onPoser({ canalId });
        }}
      />
    </div>
  );
}
