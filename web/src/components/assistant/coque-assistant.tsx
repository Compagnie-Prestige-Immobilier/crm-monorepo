import type { ReactNode } from 'react';

import { BulleAssistant } from '@/components/assistant/bulle-assistant';
import { FournisseurAssistant } from '@/components/assistant/conversation';

/** Chargé à part : les rôles sans l'assistant ne téléchargent pas sa bibliothèque. */
export default function CoqueAssistant({ children }: { children: ReactNode }) {
  return (
    <FournisseurAssistant>
      {children}
      <BulleAssistant />
    </FournisseurAssistant>
  );
}
