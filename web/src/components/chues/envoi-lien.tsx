import { useQuery } from '@tanstack/react-query';
import { MailIcon, MessageCircleIcon } from 'lucide-react';

import { apiClient, unwrap } from '@/api/client';
import { meQueryOptions } from '@/api/auth';
import { buttonVariants } from '@/components/ui/button';
import type { Prospect } from '@/lib/data/console';
import { formatPhone } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

const OBJET = 'Votre demande d’adhésion CPI CHUES';

const remplir = (modele: string, valeurs: Record<string, string>): string =>
  modele.replaceAll(/\{(\w+)\}/gu, (jeton, cle: string) => valeurs[cle] ?? jeton);

/**
 * L'autre mode de conversion : le prospect remplit lui-même le formulaire
 * public, par le lien du compte qui le lui envoie.
 */
export function EnvoiLienFormulaire({ prospect, email }: { prospect: Prospect; email: string }) {
  const parametres = useQuery({
    queryKey: queryKeys.parametresChues,
    queryFn: async () => unwrap(await apiClient.GET('/api/v1/parametres-chues')),
    staleTime: 300_000,
  });
  const moi = useQuery(meQueryOptions);

  if (parametres.data === undefined || moi.data === undefined || moi.data === null) return null;

  const texte = remplir(parametres.data.messageWhatsapp, {
    prenom: prospect.prenom,
    teleconseiller: moi.data.fullName,
    telephoneTeleconseiller: formatPhone(moi.data.phoneE164 ?? ''),
    lien: `${window.location.origin}/demande/${moi.data.id}`,
  });
  const corps = `subject=${encodeURIComponent(OBJET)}&body=${encodeURIComponent(texte)}`;
  const numero = (prospect.whatsappNumber ?? prospect.phoneE164).replaceAll(/\D/gu, '');

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pb-2 text-[0.75rem] font-[600] tracking-[0.08em] text-muted-foreground uppercase">
        Envoyer le lien du formulaire
      </legend>
      <div className="flex flex-wrap items-center gap-2">
        {prospect.whatsappStatus === 'AUCUN' ? null : (
          <a
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
            href={`https://wa.me/${numero}?text=${encodeURIComponent(texte)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircleIcon aria-hidden="true" />
            Écrire sur WhatsApp
          </a>
        )}
        <a
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
          href={`mailto:${encodeURIComponent(email.trim())}?${corps}`}
        >
          <MailIcon aria-hidden="true" />
          Envoyer par e-mail
        </a>
      </div>
      <p className="text-[0.8125rem] text-muted-foreground">
        Sa réponse revient sur votre compte, en fiche à part.
      </p>
    </fieldset>
  );
}
