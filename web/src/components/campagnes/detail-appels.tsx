import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { CALL_OUTCOME_LABELS } from '@/lib/data/console';
import type { CampagneDetail } from '@/lib/data/lots-export';
import { LIBELLES_ISSUE_APPEL } from '@/lib/data/representants';
import { formatDateTime, formatNumber, formatPhone } from '@/lib/format';

/** Une tentative rend l'issue d'un appel de prospect OU de représentant, dans un même champ. */
const ISSUES: Record<string, string> = { ...LIBELLES_ISSUE_APPEL, ...CALL_OUTCOME_LABELS };

const METHODES: Record<string, string> = {
  APPOINTMENT: 'RDV CPI',
  PHYSICAL: 'RDV CPI',
  RDV_CPI: 'RDV CPI',
  PLATFORM: 'Plateforme en ligne',
  PLATEFORME_EN_LIGNE: 'Plateforme en ligne',
  VOICE_OR_ELECTRONIC_MESSAGING: 'Mail',
  MAIL: 'Mail',
  WHATSAPP: 'WhatsApp',
};

export function CarteAppels({ lot }: { lot: CampagneDetail }) {
  const parTeleconseiller = Object.entries(lot.callsByTeleconseiller ?? {}).sort(
    (a, b) => b[1] - a[1],
  );
  const tentatives = lot.recentAttempts ?? [];

  return (
    <Card>
      <CardHeader>
        <h3 className="font-display text-h4 font-[700] leading-tight tracking-[-0.02em]">
          Appels passés sur ces fiches depuis la création
        </h3>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="text-[0.9375rem]">
          <span className="tabular-nums">{formatNumber(lot.fichesAppelees)}</span> fiche
          {lot.fichesAppelees > 1 ? 's' : ''} appelée{lot.fichesAppelees > 1 ? 's' : ''} sur{' '}
          <span className="tabular-nums">{formatNumber(lot.itemCount)}</span>,{' '}
          <span className="tabular-nums">{formatNumber(lot.callsSince)}</span> appel
          {lot.callsSince > 1 ? 's' : ''} consigné{lot.callsSince > 1 ? 's' : ''}.
        </p>

        {parTeleconseiller.length === 0 ? null : (
          <div>
            <h4 className="mb-2 text-[0.8125rem] font-[600] text-muted-foreground">
              Par téléconseiller
            </h4>
            <ul className="flex flex-wrap gap-2">
              {parTeleconseiller.map(([nom, nombre]) => (
                <li key={nom}>
                  <Badge variant="outline">
                    {nom} : {formatNumber(nombre)}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tentatives.length === 0 ? (
          <p className="text-[0.875rem] text-muted-foreground">
            Aucun appel consigné depuis la création.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {tentatives.map((tentative) => (
              <li key={tentative.id} className="flex flex-col gap-1 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {ISSUES[tentative.outcome] ?? tentative.outcome}
                  </Badge>
                  <span className="font-[600]">{tentative.shortCode}</span>
                  <span className="text-[0.8125rem] tabular-nums text-muted-foreground">
                    {formatPhone(tentative.phoneE164)}
                  </span>
                  {tentative.method === null ? null : (
                    <span className="text-[0.8125rem] text-muted-foreground">
                      {METHODES[tentative.method] ?? tentative.method}
                    </span>
                  )}
                </div>
                <p className="text-[0.8125rem] text-muted-foreground">
                  {formatDateTime(tentative.createdAt)}, par {tentative.performedByName}
                  {tentative.rendezVousAt === null
                    ? ''
                    : ` · rendez-vous le ${formatDateTime(tentative.rendezVousAt)}`}
                </p>
                {tentative.comment === null || tentative.comment === '' ? null : (
                  <p className="text-[0.875rem]">{tentative.comment}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
