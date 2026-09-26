import { createFileRoute } from '@tanstack/react-router';

import { Conversation } from '@/components/assistant/conversation';
import { guardPermission } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/admin/assistant')({
  beforeLoad: guardPermission('assistant.utiliser'),
  component: PageAssistant,
});

function PageAssistant() {
  return (
    <div className="mx-auto h-[calc(100dvh-8.5rem)] max-w-3xl overflow-hidden rounded-xl border border-border">
      <Conversation />
    </div>
  );
}
