import { ApiError } from '@crm/api-client/query';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as AppUpdates from '@/lib/data/app-updates';
import { renderWithQuery } from '@/test/render-query';

type Release = AppUpdates.AndroidRelease;

const fetchAndroidReleases = vi.hoisted(() =>
  vi.fn<() => Promise<{ items: Release[]; minVersionCode: number | null }>>(),
);
const markAndroidReleaseMandatory = vi.hoisted(() =>
  vi.fn<(versionCode: number) => Promise<Release>>(),
);
const withdrawAndroidRelease = vi.hoisted(() => vi.fn<(versionCode: number) => Promise<Release>>());

vi.mock('@/lib/data/app-updates', async () => {
  const actual = await vi.importActual<typeof AppUpdates>('@/lib/data/app-updates');
  return { ...actual, fetchAndroidReleases, markAndroidReleaseMandatory, withdrawAndroidRelease };
});

const { AndroidReleaseCard } = await import('@/components/settings/android-release-card');
const { AndroidReleaseUploadToast } =
  await import('@/components/settings/android-release-upload-toast');
const { Toaster } = await import('@/components/ui/sonner');
const { toast } = await import('sonner');

/** `XMLHttpRequest` piloté à la main : la progression d'envoi se déclenche ici, pas par le réseau. */
class FakeXhr extends EventTarget {
  static last: FakeXhr | null = null;

  readonly upload = new EventTarget();
  status = 0;
  responseText = '';
  method = '';
  url = '';
  aborted = false;

  constructor() {
    super();
    FakeXhr.last = this;
  }

  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(): void {}

  send(): void {}

  abort(): void {
    this.aborted = true;
    this.dispatchEvent(new Event('abort'));
  }

  emitProgress(loaded: number, total: number): void {
    this.upload.dispatchEvent(
      new ProgressEvent('progress', { loaded, total, lengthComputable: true }),
    );
  }

  respond(status: number, body: unknown): void {
    this.status = status;
    this.responseText = JSON.stringify(body);
    this.dispatchEvent(new Event('load'));
  }
}

function lastXhr(): FakeXhr {
  if (FakeXhr.last === null) throw new Error('Aucun envoi en cours.');
  return FakeXhr.last;
}

const release = (over: Partial<Release> = {}): Release => ({
  versionCode: 12,
  versionName: '1.2.0',
  fileName: 'cpi-go-v12.apk',
  fileSize: 42_000_000,
  sha256: `${'a'.repeat(64)}`,
  signerSha256: `${'b'.repeat(64)}`,
  mandatory: false,
  publishedAt: '2026-08-20T10:00:00.000Z',
  publishedById: 'u1',
  publishedByName: 'Awa Ndiaye',
  notes: null,
  withdrawnAt: null,
  withdrawnById: null,
  ...over,
});

const apk = (): File =>
  new File(['APK'], 'cpi-go-v12.apk', { type: 'application/vnd.android.package-archive' });

function Ecran({ carte = true }: { carte?: boolean }) {
  return (
    <>
      {carte ? <AndroidReleaseCard /> : <p>Une autre page du panel</p>}
      <AndroidReleaseUploadToast />
      <Toaster />
    </>
  );
}

const barreDEnvoi = (): HTMLElement =>
  screen.getByRole('progressbar', { name: /cpi-go-v12\.apk/u });

async function deposerEtPublier(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await screen.findByText('Historique des versions');
  await user.upload(screen.getByLabelText('Choisir un fichier APK'), apk());
  await user.click(screen.getByRole('button', { name: 'Publier' }));
  await waitFor(() => {
    expect(FakeXhr.last).not.toBeNull();
  });
}

beforeEach(() => {
  FakeXhr.last = null;
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
  fetchAndroidReleases.mockResolvedValue({ items: [release()], minVersionCode: null });
});

afterEach(() => {
  toast.dismiss();
  vi.unstubAllGlobals();
});

describe('dépôt d’un APK', () => {
  it('montre la progression puis la fenêtre de confirmation', async () => {
    const user = userEvent.setup();
    renderWithQuery(<Ecran />);
    await deposerEtPublier(user);

    await act(async () => {
      lastXhr().emitProgress(21_000_000, 42_000_000);
    });

    await waitFor(() => {
      expect(barreDEnvoi().getAttribute('aria-valuenow')).toBe('50');
    });
    expect(screen.getByText('50 %')).toBeTruthy();

    await act(async () => {
      lastXhr().respond(201, release({ versionCode: 13, versionName: '1.3.0' }));
    });

    const fenetre = await screen.findByRole('dialog');
    expect(within(fenetre).getByText('Version publiée')).toBeTruthy();
    expect(within(fenetre).getByText('1.3.0')).toBeTruthy();
    expect(within(fenetre).getByText('13')).toBeTruthy();
    expect(within(fenetre).getByText('aaaaaaaa…aaaaaaaa')).toBeTruthy();
    expect(within(fenetre).getByText('bbbbbbbb…bbbbbbbb')).toBeTruthy();
    expect(
      within(fenetre).getByText(
        'Les téléphones en dessous de cette version devront l’installer pour continuer.',
      ),
    ).toBeTruthy();
  });

  it('publier et rendre obligatoire sont deux gestes', async () => {
    const user = userEvent.setup();
    renderWithQuery(<Ecran />);
    await deposerEtPublier(user);

    await act(async () => {
      lastXhr().respond(201, release({ versionCode: 13, versionName: '1.3.0' }));
    });
    const fenetre = await screen.findByRole('dialog');

    markAndroidReleaseMandatory.mockResolvedValue(
      release({ versionCode: 13, versionName: '1.3.0', mandatory: true }),
    );
    await user.click(within(fenetre).getByRole('button', { name: 'Rendre obligatoire' }));

    expect(markAndroidReleaseMandatory).toHaveBeenCalledWith(13);
    expect(await screen.findByText(/déjà une mise à jour obligatoire/u)).toBeTruthy();
  });

  it('affiche le refus du serveur quand le signataire diffère', async () => {
    const user = userEvent.setup();
    renderWithQuery(<Ecran />);
    await deposerEtPublier(user);

    await act(async () => {
      lastXhr().respond(422, {
        statusCode: 422,
        code: 'APK_SIGNER_MISMATCH',
        message: 'Cet APK est signé par le certificat cc:cc, or le parc porte bb:bb.',
      });
    });

    expect(await screen.findByText(/signé par le certificat cc:cc/u)).toBeTruthy();
    expect(screen.queryByText('Version publiée')).toBeNull();
  });

  it('annule l’envoi depuis la barre', async () => {
    const user = userEvent.setup();
    renderWithQuery(<Ecran />);
    await deposerEtPublier(user);

    await act(async () => {
      lastXhr().emitProgress(1_000, 42_000_000);
    });
    await user.click(await screen.findByRole('button', { name: 'Annuler' }));

    expect(lastXhr().aborted).toBe(true);
    expect(await screen.findByText('Envoi annulé.')).toBeTruthy();
  });

  it('garde la barre visible quand la carte a quitté l’écran', async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithQuery(<Ecran />);
    await deposerEtPublier(user);

    await act(async () => {
      lastXhr().emitProgress(4_200_000, 42_000_000);
    });
    rerender(<Ecran carte={false} />);

    expect(await screen.findByText('Une autre page du panel')).toBeTruthy();
    expect(screen.queryByText('Historique des versions')).toBeNull();
    await waitFor(() => {
      expect(barreDEnvoi().getAttribute('aria-valuenow')).toBe('10');
    });
    expect(screen.getByText('10 %')).toBeTruthy();
  });
});

describe('historique des versions', () => {
  it('liste les versions, leur état et leur plancher', async () => {
    fetchAndroidReleases.mockResolvedValue({
      items: [
        release({ versionCode: 14, versionName: '1.4.0' }),
        release({ versionCode: 13, versionName: '1.3.0', mandatory: true }),
        release({ versionCode: 12, versionName: '1.2.0', withdrawnAt: '2026-08-21T09:00:00.000Z' }),
      ],
      minVersionCode: 13,
    });
    renderWithQuery(<Ecran />);

    expect(await screen.findByText('Historique des versions')).toBeTruthy();
    expect(screen.getByText('build 13')).toBeTruthy();
    expect(screen.getByText('Mise à jour obligatoire')).toBeTruthy();
    expect(screen.getByText('Retirée')).toBeTruthy();
    expect(screen.getAllByText('En ligne')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Retirer' })).toHaveLength(2);
  });

  it('rend une version obligatoire depuis le tableau', async () => {
    const user = userEvent.setup();
    fetchAndroidReleases.mockResolvedValue({
      items: [release({ versionCode: 14, versionName: '1.4.0' })],
      minVersionCode: null,
    });
    markAndroidReleaseMandatory.mockResolvedValue(
      release({ versionCode: 14, versionName: '1.4.0', mandatory: true }),
    );
    renderWithQuery(<Ecran />);

    await screen.findByText('Historique des versions');
    await user.click(screen.getByRole('button', { name: 'Rendre obligatoire' }));

    expect(markAndroidReleaseMandatory).toHaveBeenCalledWith(14);
    expect(await screen.findByText(/est maintenant obligatoire/u)).toBeTruthy();
  });

  it('dit ce que le retrait fait, et ce qu’il ne fait pas', async () => {
    const user = userEvent.setup();
    renderWithQuery(<Ecran />);

    await screen.findByText('Historique des versions');
    await user.click(screen.getByRole('button', { name: 'Retirer' }));

    expect(
      await screen.findByText(
        'Le retrait arrête la distribution de cette version et abaisse le plancher. ' +
          'Il ne désinstalle rien sur les téléphones qui l’ont déjà.',
      ),
    ).toBeTruthy();
  });

  it('affiche en français le refus de retirer la dernière version en ligne', async () => {
    const user = userEvent.setup();
    withdrawAndroidRelease.mockRejectedValue(
      new ApiError(
        {
          statusCode: 409,
          code: 'APK_LAST_RELEASE',
          message: 'C’est la seule release en ligne : publiez la version qui la remplace.',
        },
        new Response(null, { status: 409 }),
      ),
    );
    renderWithQuery(<Ecran />);

    await screen.findByText('Historique des versions');
    await user.click(screen.getByRole('button', { name: 'Retirer' }));
    const fenetre = await screen.findByRole('dialog');
    await user.click(within(fenetre).getByRole('button', { name: 'Retirer' }));

    expect(withdrawAndroidRelease).toHaveBeenCalledWith(12);
    expect(await screen.findByText(/seule release en ligne/u)).toBeTruthy();
  });
});
