'use client';

import { LoaderIcon, PauseIcon, PlayIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { fetchCallRecording } from '@/lib/data/phase2';

const SPEEDS = [1, 1.25, 1.5, 2] as const;

function clock(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${String(Math.floor(safe / 60))}:${String(safe % 60).padStart(2, '0')}`;
}

async function peaksOf(blob: Blob, count = 72): Promise<number[]> {
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    const channel = buffer.getChannelData(0);
    const stride = Math.max(1, Math.floor(channel.length / count));
    return Array.from({ length: count }, (_, index) => {
      let peak = 0;
      const end = Math.min(channel.length, (index + 1) * stride);
      for (let cursor = index * stride; cursor < end; cursor += 1) {
        peak = Math.max(peak, Math.abs(channel[cursor] ?? 0));
      }
      return Math.max(0.08, peak);
    });
  } finally {
    await context.close();
  }
}

export function CallRecordingPlayer({ attemptId }: { attemptId: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState<string>();
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [peaks, setPeaks] = useState<number[]>(() => Array(72).fill(0.08) as number[]);

  useEffect(
    () => () => {
      if (url !== undefined) URL.revokeObjectURL(url);
    },
    [url],
  );

  async function load() {
    setLoading(true);
    setMissing(false);
    setError(false);
    try {
      const blob = await fetchCallRecording(attemptId);
      if (blob === null) {
        setMissing(true);
        return;
      }
      setUrl(URL.createObjectURL(blob));
      void peaksOf(blob)
        .then(setPeaks)
        .catch(() => undefined);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (url === undefined) {
    let label = 'Écouter la note vocale';
    if (loading) label = 'Chargement…';
    else if (missing) label = 'Vérifier la note vocale';
    else if (error) label = 'Réessayer le chargement';
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={loading}
        onClick={() => void load()}
      >
        {loading ? (
          <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <PlayIcon className="size-4" aria-hidden="true" />
        )}
        {label}
      </Button>
    );
  }

  const progress = duration === 0 ? 0 : position / duration;
  return (
    <div className="w-full rounded-lg border border-border bg-muted/30 p-3">
      {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- enregistrement d'appel sans transcription */}
      <audio
        ref={audio}
        src={url}
        preload="metadata"
        onDurationChange={(event) => {
          setDuration(event.currentTarget.duration);
        }}
        onTimeUpdate={(event) => {
          setPosition(event.currentTarget.currentTime);
        }}
        onPlay={() => {
          setPlaying(true);
        }}
        onPause={() => {
          setPlaying(false);
        }}
        onEnded={() => {
          setPlaying(false);
        }}
      />
      <div className="relative h-14">
        <div className="absolute inset-0 flex items-center gap-px" aria-hidden="true">
          {peaks.map((peak, index) => (
            <span
              key={index}
              className={index / peaks.length <= progress ? 'bg-primary' : 'bg-border'}
              style={{ height: `${String(Math.round(12 + peak * 42))}px`, flex: 1 }}
            />
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={position}
          aria-label="Position dans la note vocale"
          className="absolute inset-0 size-full cursor-pointer opacity-0"
          onChange={(event) => {
            const value = Number(event.currentTarget.value);
            if (audio.current) audio.current.currentTime = value;
            setPosition(value);
          }}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="icon"
          className="rounded-full"
          aria-label={playing ? 'Mettre en pause' : 'Lire la note vocale'}
          onClick={() => {
            if (!audio.current) return;
            if (playing) audio.current.pause();
            else void audio.current.play();
          }}
        >
          {playing ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
        </Button>
        <span className="min-w-24 text-[0.8125rem] tabular-nums text-muted-foreground">
          {clock(position)} / {clock(duration)}
        </span>
        <label className="ml-auto flex items-center gap-2 text-[0.8125rem]">
          Vitesse
          <select
            value={speed}
            className="h-9 rounded-md border border-input bg-background px-2 font-[600]"
            onChange={(event) => {
              const value = Number(event.currentTarget.value);
              setSpeed(value);
              if (audio.current) audio.current.playbackRate = value;
            }}
          >
            {SPEEDS.map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
