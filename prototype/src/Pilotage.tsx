import { budgetConseille, computeScore, fcfa, type Fiche } from './bant';
import { FIELDS, selText } from './fields';
import { Card } from './ui';

const ETAPES = FIELDS.find((f) => f.id === 'etape')?.options ?? [];

function group(list: Fiche[], key: (f: Fiche) => string) {
  const out = new Map<string, Fiche[]>();
  for (const f of list) {
    const k = key(f);
    if (k) out.set(k, [...(out.get(k) ?? []), f]);
  }
  return [...out].sort((a, b) => b[1].length - a[1].length);
}

function demandeParLocalite(list: Fiche[]) {
  const vivants = list.filter((f) => f.values.etape !== 'perdu');
  return group(vivants, (f) => f.values['localite-souhaitee'] ?? '').map(([loc, fs]) => {
    const budgets = fs
      .map((f) => budgetConseille(f)?.max || Number(f.values['prix-lot'] ?? 0))
      .filter((x) => x > 0);
    return [
      loc,
      fs.length,
      fs.filter((f) => ['A', 'B'].includes(computeScore(f).classe)).length,
      budgets.length ? fcfa(budgets.reduce((a, b) => a + b, 0) / budgets.length) : '-',
      group(fs, (f) => f.values.superficie ?? '')[0]?.[0] ?? '-',
    ];
  });
}

export function Pilotage({ list }: { list: Fiche[] }) {
  if (!list.length) return null;
  const parEtape = new Map(group(list, (f) => f.values.etape ?? ''));
  const etapes = ETAPES.filter(([e]) => parEtape.has(e)).map(([e, label]) => [
    label,
    parEtape.get(e)?.length ?? 0,
  ]);
  const canaux = group(list, (f) => selText(f, 'canal')).map(([c, fs]) => {
    const res = fs.filter((f) => f.values.etape === 'reservation').length;
    return [c, fs.length, res, `${Math.round((res / fs.length) * 100)} %`];
  });
  const pertes = group(
    list.filter((f) => f.values.etape === 'perdu'),
    (f) => selText(f, 'motif-perte') || 'Non renseigné',
  ).map(([m, fs]) => [m, fs.length]);
  return (
    <section aria-labelledby="pilotage" className="space-y-3 pt-4">
      <h2 id="pilotage" className="font-display text-2xl font-bold">
        Pilotage
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <MiniTable
          title="Demande par localité"
          head={['Localité', 'Prospects', 'dont A/B', 'Budget moyen', 'Superficie']}
          rows={demandeParLocalite(list)}
          empty="Renseigner la localité souhaitée."
          className="md:col-span-2"
        />
        <MiniTable
          title="Pipeline par étape"
          head={['Étape', 'Fiches']}
          rows={etapes}
          empty="Aucune étape renseignée."
          bar
        />
        <MiniTable
          title="Conversion par canal"
          head={['Canal', 'Fiches', 'Réservations', 'Taux']}
          rows={canaux}
          empty="Renseigner le canal."
        />
        <MiniTable
          title="Motifs de perte"
          head={['Motif', 'Fiches']}
          rows={pertes}
          empty="Aucun prospect perdu."
          bar
        />
      </div>
    </section>
  );
}

function MiniTable({
  title,
  head,
  rows,
  empty,
  bar,
  className = '',
}: {
  title: string;
  head: string[];
  rows: (string | number)[][];
  empty: string;
  bar?: boolean;
  className?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => Number(r[1])));
  return (
    <Card title={title} className={className}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                {head.map((h) => (
                  <th key={h} className="px-1 pb-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={String(r[0])}>
                  {r.map((c, i) => (
                    <td key={head[i]} className={`px-1 py-2 ${i > 0 ? 'tabular-nums' : ''}`}>
                      {bar && i === 1 ? (
                        <span className="flex items-center gap-2">
                          <span
                            className="h-1.5 rounded-full bg-brand"
                            style={{ width: `${(Number(c) / max) * 6}rem` }}
                          />
                          {c}
                        </span>
                      ) : (
                        c
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
