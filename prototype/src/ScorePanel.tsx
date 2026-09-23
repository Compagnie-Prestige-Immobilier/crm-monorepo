import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Info,
  XCircle,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import {
  Button as AriaButton,
  Disclosure,
  DisclosurePanel,
  Heading,
  Meter,
} from 'react-aria-components';

import {
  adequation,
  argumentaire,
  type Check,
  CLASSES,
  computeScore,
  diasporaProtocol,
  type Fiche,
  missingFields,
  recommendations,
  SECTOR_LABELS,
  simulationRows,
  VERDICT_LABELS,
  verdictText,
} from './bant';
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

export function ScorePanel({ fiche }: { fiche: Fiche }) {
  const s = computeScore(fiche);
  const a = adequation(fiche, s.cap);
  const recos = recommendations(fiche, s, a);
  const missing = missingFields(fiche);
  if (missing.length)
    recos.push(`Champs obligatoires manquants : ${missing.map((m) => m.label).join(', ')}`);
  const sim = s.cap.applicable ? simulationRows(fiche, s.cap) : [];
  const verdict = verdictText(s.cap);
  const args = argumentaire(fiche);
  const protocol = diasporaProtocol(fiche);
  const info = CLASSES[s.classe];

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Score prospect
            </p>
            <p
              className="font-display text-6xl font-bold leading-none tabular-nums text-ink"
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
              {s.manquants > 0 &&
                ` · ${s.manquants} critère${s.manquants > 1 ? 's' : ''} non noté${s.manquants > 1 ? 's' : ''}`}
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

      {(sim.length > 0 || s.cap.tauxManquant) && (
        <Card
          title="Capacité de paiement"
          aside={
            s.cap.verdict && (
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${TONE[s.cap.verdict]}`}>
                {VERDICT_LABELS[s.cap.verdict]}
              </span>
            )
          }
        >
          {s.cap.tauxManquant ? (
            <p className="text-sm text-muted">
              Saisir le taux de change de la devise pour lancer la simulation.
            </p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {sim.map(([k, x]) => (
                <div key={k}>
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="font-semibold tabular-nums">{x}</dd>
                </div>
              ))}
            </dl>
          )}
          {verdict && s.cap.verdict !== 'ok' && (
            <p
              className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${TONE[s.cap.verdict ?? 'ok']}`}
            >
              {verdict}
            </p>
          )}
          {!s.cap.verdict && !s.cap.tauxManquant && (
            <p className="mt-3 text-sm text-muted">
              Renseigner le revenu pour calculer la capacité.
            </p>
          )}
        </Card>
      )}

      <Card
        title="Adéquation de l'offre"
        aside={
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${NIVEAU[a.niveau]}`}>
            {a.label}
          </span>
        }
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

      <Actions recos={recos} />

      {args.length > 0 && (
        <Fold title="Argumentaire selon la motivation">
          {args.map((x) => (
            <li key={x.text} className={x.main ? 'font-medium text-ink' : ''}>
              {x.main && <span className="mr-1 text-gold-text">★ Principal :</span>}
              {x.text}
            </li>
          ))}
        </Fold>
      )}
      {protocol.length > 0 && (
        <Fold title="Protocole de suivi à distance">
          {protocol.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </Fold>
      )}
    </div>
  );
}

const VISIBLE_ACTIONS = 5;
function Actions({ recos }: { recos: string[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? recos : recos.slice(0, VISIBLE_ACTIONS);
  return (
    <Card
      title="Actions conseillées"
      aside={<span className="text-xs font-semibold text-muted">{recos.length}</span>}
    >
      {recos.length === 0 ? (
        <p className="flex items-center gap-2 text-sm font-medium text-ok">
          <CheckCircle2 size={16} />
          Bien qualifié
        </p>
      ) : (
        <ol className="space-y-2.5">
          {shown.map((r, i) => (
            <li key={r} className="flex gap-3 text-sm">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand">
                {i + 1}
              </span>
              <span className="pt-0.5">{r}</span>
            </li>
          ))}
        </ol>
      )}
      {recos.length > VISIBLE_ACTIONS && (
        <AriaButton
          onPress={() => setAll(!all)}
          className="focus-ring mt-3 cursor-pointer rounded text-sm font-semibold text-brand"
        >
          {all ? 'Réduire' : `Voir les ${recos.length - VISIBLE_ACTIONS} autres`}
        </AriaButton>
      )}
    </Card>
  );
}

function Fold({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Disclosure className="group rounded-2xl border border-line bg-paper">
      <Heading>
        <AriaButton
          slot="trigger"
          className="focus-ring flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 text-left font-display font-semibold sm:px-5"
        >
          {title}
          <ChevronDown
            size={18}
            className="text-muted transition group-data-[expanded]:rotate-180"
            aria-hidden
          />
        </AriaButton>
      </Heading>
      <DisclosurePanel>
        <ul className="space-y-2 px-4 pb-4 text-sm text-muted sm:px-5">{children}</ul>
      </DisclosurePanel>
    </Disclosure>
  );
}
