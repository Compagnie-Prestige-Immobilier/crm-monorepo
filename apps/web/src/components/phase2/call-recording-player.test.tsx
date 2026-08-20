import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchCallRecording } from '@/lib/data/phase2';
import { CallRecordingPlayer } from './call-recording-player';

vi.mock('@/lib/data/phase2', () => ({ fetchCallRecording: vi.fn() }));

describe('lecture d’une note vocale', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('la position reste pilotable par un lecteur d’écran', async () => {
    vi.mocked(fetchCallRecording).mockResolvedValue(new Blob(['audio'], { type: 'audio/mp4' }));
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:note');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    render(<CallRecordingPlayer attemptId="attempt-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Écouter la note vocale' }));

    expect(
      await screen.findByRole('slider', { name: 'Position dans la note vocale' }),
    ).toBeDefined();
  });

  it('peut vérifier à nouveau quand l’upload termine après la première écoute', async () => {
    vi.mocked(fetchCallRecording)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(new Blob(['audio'], { type: 'audio/mp4' }));
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:note');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    render(<CallRecordingPlayer attemptId="attempt-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Écouter la note vocale' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Vérifier la note vocale' }));

    expect(
      await screen.findByRole('slider', { name: 'Position dans la note vocale' }),
    ).toBeDefined();
  });
});
