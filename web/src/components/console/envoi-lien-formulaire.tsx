'use client';

import { useQuery } from '@tanstack/react-query';
import { MailIcon } from 'lucide-react';

import { BoutonWhatsApp, type FicheContactable } from '@/components/prospects/bouton-whatsapp';
import { buttonVariants } from '@/components/ui/button';
import { fetchSessionUser } from '@/lib/data/auth';
import { monLienFormulaireQuery } from '@/lib/data/lien-formulaire';
import { fetchParametresChues } from '@/lib/data/parametres-chues';
import { formatPhone } from '@/lib/format';
import { lienFormulairePublic, texteDuMessage } from '@/lib/formulaire-public';
import { queryKeys } from '@/lib/query-keys';

const STALE_TIME = 300_000;

const OBJET = 'Votre demande d’adhésion CPI CHUES';

/**
 * EB-25 : l'autre mode de conversion. Le prospect remplit lui-même le
 * formulaire public, par le lien du compte qui le lui envoie.
 */
export function EnvoiLienFormulaire({
  prospect,
  email,
}: {
  prospect: FicheContactable;
  email: string;
}) {
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

  if (parametres.data === undefined || moi.data === undefined || lien.data === undefined)
    return null;

  const texte = texteDuMessage(parametres.data.messageWhatsapp, {
    prenom: prospect.prenom,
    teleconseiller: moi.data.fullName,
    telephoneTeleconseiller: formatPhone(moi.data.phoneE164 ?? ''),
    lien: lienFormulairePublic(lien.data.jeton),
  });
  const destinataire = encodeURIComponent(email.trim());
  const corps = `subject=${encodeURIComponent(OBJET)}&body=${encodeURIComponent(texte)}`;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pb-2 text-[0.75rem] font-[600] tracking-[0.08em] text-muted-foreground uppercase">
        Envoyer le lien du formulaire
      </legend>
      <div className="flex flex-wrap items-center gap-2">
        <BoutonWhatsApp prospect={prospect} />
        <a
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
          href={`mailto:${destinataire}?${corps}`}
        >
          <MailIcon aria-hidden="true" />
          Envoyer par e-mail
        </a>
      </div>
    </fieldset>
  );
}
