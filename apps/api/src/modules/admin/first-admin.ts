import { Role } from '@crm/database';

export interface FirstAdminReader {
  findFirst(args: {
    where: { role: Role; deletedAt: null; isActive: true };
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }];
    select: { id: true; email: true; username: true };
  }): Promise<{ id: string; email: string; username: string } | null>;
}

export interface FirstAdmin {
  readonly id: string;
  readonly email: string;
  readonly username: string;
}

// Aucune colonne « compte d'amorçage » : le seed crée l'ADMIN initial en premier,
// donc le plus ancien ADMIN vivant EST ce compte (`id` UUID v7 départage à égalité).
export function findFirstAdmin(users: FirstAdminReader): Promise<FirstAdmin | null> {
  return users.findFirst({
    where: { role: Role.ADMIN, deletedAt: null, isActive: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, email: true, username: true },
  });
}

export function matchesConfirmation(admin: FirstAdmin, typed: string): boolean {
  const normalized = typed.trim().toLocaleLowerCase();
  if (normalized === '') return false;
  return (
    normalized === admin.email.trim().toLocaleLowerCase() ||
    normalized === admin.username.trim().toLocaleLowerCase()
  );
}
