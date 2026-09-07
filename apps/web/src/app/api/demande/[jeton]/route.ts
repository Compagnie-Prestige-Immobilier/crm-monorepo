import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  API_PREFIX,
  ApiConfigurationError,
  configErrorBody,
  serverApiOrigin,
} from '@/lib/api/config';
import { demandePubliqueSchema } from '@/lib/schemas';

/** Le jeton anti-robot n'est pas un champ du formulaire : le widget le pose. */
const corpsSchema = demandePubliqueSchema.extend({
  turnstileToken: z.string().max(2048).default(''),
});

const REFUS_CAPTCHA =
  'La vérification anti-robot n’a pas abouti. Rechargez la page et recommencez.';

const REFUS: Readonly<Record<number, string>> = {
  400: 'Vérifiez les champs signalés.',
  404: 'Ce lien ne fonctionne plus. Demandez-en un nouveau à votre conseiller CPI.',
  429: 'Trop d’envois depuis cette connexion. Patientez une minute.',
  503: 'La vérification anti-robot est indisponible. Réessayez dans un instant.',
};

/**
 * Un 400 anti-robot n'est pas une saisie fautive : sans son code, le visiteur
 * relirait ses champs sans jamais trouver ce qui cloche.
 */
async function messageDeRefus(amont: Response): Promise<string | undefined> {
  const charge: unknown = await amont.json().catch(() => null);
  const code =
    typeof charge === 'object' && charge !== null ? (charge as { code?: unknown }).code : undefined;
  return code === 'CAPTCHA_REFUSE' ? REFUS_CAPTCHA : REFUS[amont.status];
}

type CorpsAnalyse = z.infer<typeof corpsSchema>;

function buildDemandePayload(data: CorpsAnalyse): Record<string, unknown> {
  const { turnstileToken, ...demande } = data;
  return { ...demande, ...(turnstileToken === '' ? {} : { turnstileToken }) };
}

type OrigineResolue = { ok: true; origin: string } | { ok: false; reponse: NextResponse };

function resolveOrigin(): OrigineResolue {
  try {
    return { ok: true, origin: serverApiOrigin() };
  } catch (error) {
    if (error instanceof ApiConfigurationError) {
      return { ok: false, reponse: NextResponse.json(configErrorBody(error), { status: 500 }) };
    }
    throw error;
  }
}

async function relayerVersFormulairePublic(
  origin: string,
  jeton: string,
  demande: Record<string, unknown>,
  visiteur: string | null,
): Promise<Response> {
  return fetch(`${origin}${API_PREFIX}/formulaire-public/${encodeURIComponent(jeton)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(visiteur === null ? {} : { 'x-forwarded-for': visiteur }),
    },
    body: JSON.stringify(demande),
    cache: 'no-store',
  });
}

/**
 * Le relais `/api/v1` attache toujours un jeton de session et renvoie 401 sans
 * cookie : une page publique ne peut pas l'emprunter. Ce relais-ci ne porte
 * aucune identité et ne sert que cette route.
 *
 * L'adresse du visiteur est reportée : sans elle, l'API compte tous les envois
 * sur l'adresse du panel, et la limitation par adresse réseau ne limite plus
 * rien (elle exige `API_TRUST_PROXY_HEADERS` côté API).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ jeton: string }> },
): Promise<NextResponse> {
  const { jeton } = await context.params;

  let corps: unknown;
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ error: 'Demande illisible.' }, { status: 400 });
  }

  const parsed = corpsSchema.safeParse(corps);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Vérifiez les champs signalés.' }, { status: 400 });
  }

  const origine = resolveOrigin();
  if (!origine.ok) return origine.reponse;

  const demande = buildDemandePayload(parsed.data);
  const visiteur = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip');

  let amont: Response;
  try {
    amont = await relayerVersFormulairePublic(origine.origin, jeton, demande, visiteur);
  } catch {
    return NextResponse.json(
      { error: 'Le serveur CPI est injoignable. Réessayez dans un instant.' },
      { status: 502 },
    );
  }

  if (amont.ok) return NextResponse.json({ ok: true });

  const connu = await messageDeRefus(amont);
  if (connu !== undefined) return NextResponse.json({ error: connu }, { status: amont.status });

  return NextResponse.json(
    { error: 'Votre demande n’a pas pu être enregistrée. Réessayez dans un instant.' },
    { status: 502 },
  );
}
