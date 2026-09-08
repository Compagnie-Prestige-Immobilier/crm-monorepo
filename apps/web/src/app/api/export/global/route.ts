import { relayXlsx } from '@/app/api/export/relay';

export async function GET(): Promise<Response> {
  return relayXlsx({
    upstreamPath: 'export/global.xlsx',
    search: new URLSearchParams(),
    filename: `cpi-global-${new Date().toISOString().slice(0, 10)}.xlsx`,
    allowedRoles: ['ADMIN', 'SUPERVISEUR', 'DIRECTION'],
  });
}
