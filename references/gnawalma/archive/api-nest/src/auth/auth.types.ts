export type AccountRole = 'platform_admin' | 'atelier_owner' | 'atelier_manager' | 'client';
export interface AuthClaims { sub: string; role: AccountRole; sid: string; }
export interface AuthenticatedRequest { user: AuthClaims; headers: Record<string, string | string[] | undefined>; }
