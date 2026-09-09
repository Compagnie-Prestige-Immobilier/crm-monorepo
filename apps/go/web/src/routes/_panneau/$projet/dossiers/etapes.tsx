import { createFileRoute } from '@tanstack/react-router';

import { EtapesBancaires } from '@/components/banque/etapes';
import { guardProjet } from '@/lib/guard';
import { ADMIN_SEUL, AUCUN } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/$projet/dossiers/etapes')({
  beforeLoad: guardProjet({ chues: ADMIN_SEUL, 'grand-public': AUCUN }),
  component: EtapesBancaires,
});
