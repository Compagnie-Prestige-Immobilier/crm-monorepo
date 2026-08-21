import { beforeEach, describe, expect, it, vi } from 'vitest';

const guardRoles = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('REDIRECT');
  }),
  unstable_rethrow: () => undefined,
}));
vi.mock('@/lib/session', () => ({ guardRoles }));

const CampaignsPage = (await import('@/app/(panel)/chues/campagnes/page')).default;
const CampaignPage = (await import('@/app/(panel)/chues/campagnes/[id]/page')).default;
const RepCampaignsPage = (await import('@/app/(panel)/chues/campagnes/representants/page')).default;
const RepCampaignPage = (await import('@/app/(panel)/chues/campagnes/representants/[id]/page'))
  .default;

beforeEach(() => {
  guardRoles.mockReset();
  guardRoles.mockResolvedValue({ status: 'anonymous' });
});

describe('lecture des campagnes', () => {
  it('ouvre les quatre écrans à l’admin, la supervision et la direction', async () => {
    await CampaignsPage({ searchParams: Promise.resolve({}) }).catch(() => undefined);
    await CampaignPage({ params: Promise.resolve({ id: 'campaign-1' }) }).catch(() => undefined);
    await RepCampaignsPage({ searchParams: Promise.resolve({}) }).catch(() => undefined);
    await RepCampaignPage({ params: Promise.resolve({ id: 'campaign-2' }) }).catch(() => undefined);

    expect(guardRoles).toHaveBeenCalledTimes(4);
    for (const [roles] of guardRoles.mock.calls) {
      expect(roles).toEqual(['ADMIN', 'SUPERVISEUR', 'DIRECTION']);
    }
  });
});
