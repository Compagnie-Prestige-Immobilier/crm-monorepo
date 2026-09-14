'use client';

import { useQuery } from '@tanstack/react-query';
import { MessageCircleIcon } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { fetchSessionUser } from '@/lib/data/auth';
import { monLienFormulaireQuery } from '@/lib/data/lien-formulaire';
import { fetchParametresChues } from '@/lib/data/parametres-chues';
import { formatPhone } from '@/lib/format';
import { lienFormulairePublic, texteDuMessage } from '@/lib/formulaire-public';
import { queryKeys } from '@/lib/query-keys';
import type { ProspectRow } from '@/lib/types';

const STALE_TIME = 300_000;

/** Ce que le message et le lien lisent d'une fiche, qu'elle existe déjà ou non. */
export type FicheContactable = Pick<
  ProspectRow,
  'prenom' | 'phoneE164' | 'whatsappStatus' | 'whatsappNumber'
>;

/** EB-26 : WhatsApp s'ouvre sur le numéro du prospect, message déjà écrit. */
export function BoutonWhatsApp({ prospect }: { prospect: FicheContactable }) {
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
  const lien = useQuery(monLienFormulaireQuery());

  if (prospect.whatsappStatus === 'AUCUN') return null;
  if (parametres.data === undefined || moi.data === undefined || lien.data === undefined)
    return null;

  const numero = prospect.whatsappNumber ?? prospect.phoneE164;
  if (numero === null) return null;
  const texte = texteDuMessage(parametres.data.messageWhatsapp, {
    prenom: prospect.prenom,
    teleconseiller: moi.data.fullName,
    telephoneTeleconseiller: formatPhone(moi.data.phoneE164 ?? ''),
    lien: lienFormulairePublic(lien.data.jeton),
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
