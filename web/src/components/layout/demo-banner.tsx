import { FlaskConicalIcon } from 'lucide-react';

import type { SessionUser } from '@/lib/types';

export function DemoBanner({ user }: { user: SessionUser }) {
  if (user.workspace === 'public') return null;

  return (
    <div
      role="status"
      className="flex min-h-10 items-center justify-center gap-2 bg-warning-surface px-4 py-2 text-center text-[0.8125rem] font-[700] text-warning"
    >
      <FlaskConicalIcon className="size-4 shrink-0" aria-hidden="true" />
      MODE DÉMO · BASE {user.workspace.toUpperCase()}
    </div>
  );
}
