'use client';

import { useQuery } from '@tanstack/react-query';
import { MessageCircleIcon } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { fetchSessionUser } from '@/lib/data/auth';
import { fetchParametresChues } from '@/lib/data/parametres-chues';
import { formatPhone } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import type { ProspectRow } from '@/lib/types';

const STALE_TIME = 300_000;

/**
 * Le formulaire public d'EB-27 n'a pas encore d'adresse : `{lien}` s'efface,
 * avec le deux-points qui l'introduit, plutôt que de partir tel quel.
 */
function texteDuMessage(modele: string, valeurs: Record<string, string>): string {
  return modele
    .replaceAll(/\s*:?\s*\{lien\}/gu, '')
    .replaceAll(/\{(\w+)\}/gu, (jeton, cle: string) => valeurs[cle] ?? jeton);
}

/** EB-26 : WhatsApp s'ouvre sur le numéro du prospect, message déjà écrit. */
export function BoutonWhatsApp({ prospect }: { prospect: ProspectRow }) {
  const parametres = useQuery({
    queryKey: queryKeys.parametresChues,
    queryFn: () => fetchParametresChues(),
    staleTime: STALE_TIME,
  });
  const moi = useQuery({
    queryKey: queryKeys.session,
    queryFn: () => fetchSessionUser(),
    staleTime: STALE_TIME,
  });

  if (prospect.whatsappStatus === 'AUCUN') return null;
  if (parametres.data === undefined || moi.data === undefined) return null;

  const numero = prospect.whatsappNumber ?? prospect.phoneE164;
  const texte = texteDuMessage(parametres.data.messageWhatsapp, {
    prenom: prospect.prenom,
    teleconseiller: moi.data.fullName,
    telephoneTeleconseiller: formatPhone(moi.data.phoneE164 ?? ''),
  });

  return (
    <a
      className={buttonVariants({ variant: 'outline', size: 'sm' })}
      href={`https://wa.me/${numero.replaceAll(/\D/gu, '')}?text=${encodeURIComponent(texte)}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <MessageCircleIcon aria-hidden="true" />
      Écrire sur WhatsApp
    </a>
  );
}
