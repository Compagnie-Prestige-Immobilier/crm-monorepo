import { createFileRoute } from '@tanstack/react-router';

import { PanneauAssistant } from '@/components/assistant/panneau-assistant';
import { guardPermission } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/admin/assistant')({
  beforeLoad: guardPermission('assistant.utiliser'),
  component: PanneauAssistant,
});
