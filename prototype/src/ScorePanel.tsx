import { AlertTriangle, CheckCircle2, CircleDashed, Info, XCircle } from 'lucide-react';
import { Meter } from 'react-aria-components';

import {
  adequation,
  type Capacite,
  type Check,
  CLASSES,
  computeScore,
  type Fiche,
  recommendations,
  type Score,
  SECTOR_LABELS,
  simulationRows,
  VERDICT_LABELS,
  verdictText,
} from './bant';
import { Conseils } from './Conseils';
import { CONFIG } from './fields';
import { Bar, Card, ClassStamp } from './ui';

const TONE = {
  ok: 'bg-ok-soft text-ok',
  limite: 'bg-warn-soft text-warn',
  ko: 'bg-ko-soft text-ko',
};
const NIVEAU = {
  forte: 'bg-ok-soft text-ok',
  moyenne: 'bg-warn-soft text-warn',
  faible: 'bg-ko-soft text-ko',
  na: 'bg-canvas text-muted',
};
const CHECK_ICON: Record<Check['state'], typeof Info> = {
  ok: CheckCircle2,
  partial: CircleDashed,
  ko: XCircle,
  info: Info,
};
const CHECK_TONE: Record<Check['state'], string> = {
  ok: 'text-ok',
  partial: 'text-warn',
  ko: 'text-ko',
  info: 'text-muted',
};
const ZONES = [
  { c: 'D', from: 0, to: CONFIG.SEUILS_CLASSES.C },
  { c: 'C', from: CONFIG.SEUILS_CLASSES.C, to: CONFIG.SEUILS_CLASSES.B },
  { c: 'B', from: CONFIG.SEUILS_CLASSES.B, to: CONFIG.SEUILS_CLASSES.A },
  { c: 'A', from: CONFIG.SEUILS_CLASSES.A, to: 100 },
] as const;
const pill = 'rounded-full px-2.5 py-1 text-xs font-bold';

export function ScorePanel({ fiche }: { fiche: Fiche }) {
  const s = computeScore(fiche);
  const a = adequation(fiche, s.cap);

  return (
    <div className="space-y-4">
      <ScoreCard fiche={fiche} s={s} />
      <CapaciteCard fiche={fiche} c={s.cap} />
      <Card
        title="Adéquation de l'offre"
        aside={<span className={`${pill} ${NIVEAU[a.niveau]}`}>{a.label}</span>}
      >
        <ul className="space-y-2">
          {a.items.map((item) => {
            const Icon = CHECK_ICON[item.state];
            return (
              <li key={item.text} className="flex gap-2 text-sm">
                <Icon
                  size={16}
                  className={`mt-0.5 shrink-0 ${CHECK_TONE[item.state]}`}
                  aria-hidden
                />
                {item.text}
              </li>
            );
          })}
        </ul>
      </Card>
      <Conseils fiche={fiche} recos={recommendations(fiche, s, a)} />
    </div>
  );
}

function ScoreCard({ fiche, s }: { fiche: Fiche; s: Score }) {
  const info = CLASSES[s.classe];
  const pending = s.manquants > 0 ? ` · ${s.manquants} critère(s) non noté(s)` : '';
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Score prospect
          </p>
          <p
            className="font-display text-6xl font-bold leading-none tabular-nums"
            aria-live="polite"
          >
            {s.total}
            <span className="text-2xl font-medium text-muted/60">/100</span>
          </p>
          <p className="mt-2 font-display text-lg font-semibold">
            {info.label}
            {s.manquants > 0 && (
              <span className="ml-1 text-sm font-medium text-muted">(provisoire)</span>
            )}
          </p>
          <p className="text-sm text-muted">
            {SECTOR_LABELS[fiche.sector]} : {info.sub[fiche.sector]}
            {pending}
          </p>
        </div>
        <ClassStamp classe={s.classe} size="lg" />
      </div>

      <Meter value={s.total} aria-label="Position dans les classes" className="mt-5 block">
        {({ percentage }) => (
          <div className="relative">
            <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
              {ZONES.map((z) => (
                <span
                  key={z.c}
                  style={{ width: `${z.to - z.from}%` }}
                  className={z.c === s.classe ? 'bg-brand' : 'bg-line'}
                />
              ))}
            </div>
            <span
              className="absolute -top-1 size-4 -translate-x-1/2 rounded-full border-[3px] border-paper bg-ink shadow transition-[left] duration-500"
              style={{ left: `${percentage}%` }}
              aria-hidden
            />
            <div className="mt-1.5 flex text-[11px] font-semibold text-muted">
              {ZONES.map((z) => (
                <span
                  key={z.c}
                  style={{ width: `${z.to - z.from}%` }}
                  className={z.c === s.classe ? 'text-brand' : ''}
                >
                  {z.c} {z.from > 0 && <span className="font-normal">{z.from}</span>}
                </span>
              ))}
            </div>
          </div>
        )}
      </Meter>

      <div className="mt-5 space-y-2.5">
        <Bar label="Budget" value={s.pts.budget} max={CONFIG.POIDS.budget} />
        <Bar label="Autorité" value={s.pts.authority} max={CONFIG.POIDS.authority} />
        <Bar label="Besoin" value={s.pts.need} max={CONFIG.POIDS.need} />
        <Bar label="Calendrier" value={s.pts.timeline} max={CONFIG.POIDS.timeline} />
        <Bar
          label="Engagement"
          value={s.pts.engagement}
          max={CONFIG.POIDS.engagement}
          tone="bg-gold"
        />
      </div>
      {s.caps.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {s.caps.map((c) => (
            <li key={c} className="flex gap-2 text-sm font-medium text-ko">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              {c}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CapaciteCard({ fiche, c }: { fiche: Fiche; c: Capacite }) {
  if (c.tauxManquant) {
    return (
      <Card title="Capacité de paiement">
        <p className="text-sm text-muted">
          Saisir le taux de change de la devise pour lancer la simulation.
        </p>
      </Card>
    );
  }
  const rows = c.applicable ? simulationRows(fiche, c) : [];
  if (!rows.length) return null;
  const verdict = verdictText(c);
  return (
    <Card
      title="Capacité de paiement"
      aside={
        c.verdict && (
          <span className={`${pill} ${TONE[c.verdict]}`}>{VERDICT_LABELS[c.verdict]}</span>
        )
      }
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {rows.map(([k, x]) => (
          <div key={k}>
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="font-semibold tabular-nums">{x}</dd>
          </div>
        ))}
      </dl>
      {c.verdict && c.verdict !== 'ok' && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${TONE[c.verdict]}`}>
          {verdict}
        </p>
      )}
      {!c.verdict && (
        <p className="mt-3 text-sm text-muted">Renseigner le revenu pour calculer la capacité.</p>
      )}
    </Card>
  );
}
