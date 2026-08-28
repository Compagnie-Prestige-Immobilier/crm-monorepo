# Sons d'interface

Quatre repères sonores synthétisés localement (aucune source tierce, aucune
licence à porter) : `etape`, `succes`, `echec`, `rappel`. `tap` et `choix` sont
muets et n'ont pas de fichier.

WAV PCM 16 bits mono 44,1 kHz, et non Ogg Vorbis : l'encodeur `vorbis` natif de
ffmpeg 8.1.2 (le seul présent ici, `libvorbis` n'est pas compilé) refuse le
mono — « Current FFmpeg Vorbis encoder only supports 2 channels ». Le PCM est
décodé par toutes les versions d'Android, et les quatre fichiers tiennent sous
50 Ko (le plus gros, `rappel.wav`, fait 47 Ko pour 540 ms).

Regénération (depuis `apps/mobile/`) :

```sh
F="afade=t=in:st=0:d=0.008"

# etape : une note, 120 ms
ffmpeg -y -f lavfi -i "sine=f=880:d=0.12:r=44100" \
  -af "volume=0.5,$F,afade=t=out:st=0.09:d=0.03" \
  -ac 1 -ar 44100 -c:a pcm_s16le assets/sounds/etape.wav

# succes : deux notes montantes (A5 → E6), 180 ms
ffmpeg -y -f lavfi -i "sine=f=880:d=0.09:r=44100" \
       -f lavfi -i "sine=f=1319:d=0.09:r=44100" \
  -filter_complex "[0:a]volume=0.5,$F,afade=t=out:st=0.075:d=0.015[a];\
[1:a]volume=0.5,$F,afade=t=out:st=0.06:d=0.03[b];[a][b]concat=n=2:v=0:a=1[o]" \
  -map "[o]" -ac 1 -ar 44100 -c:a pcm_s16le assets/sounds/succes.wav

# echec : deux notes descendantes (D5 → G4), 220 ms
ffmpeg -y -f lavfi -i "sine=f=587:d=0.11:r=44100" \
       -f lavfi -i "sine=f=392:d=0.11:r=44100" \
  -filter_complex "[0:a]volume=0.5,$F,afade=t=out:st=0.095:d=0.015[a];\
[1:a]volume=0.5,$F,afade=t=out:st=0.07:d=0.04[b];[a][b]concat=n=2:v=0:a=1[o]" \
  -map "[o]" -ac 1 -ar 44100 -c:a pcm_s16le assets/sounds/echec.wav

# rappel : trois notes (A5, D6, A5) séparées de 30 ms, 540 ms
ffmpeg -y -f lavfi -i "sine=f=880:d=0.16:r=44100" \
       -f lavfi -i "sine=f=1175:d=0.16:r=44100" \
       -f lavfi -t 0.03 -i "anullsrc=r=44100:cl=mono" \
  -filter_complex "[0:a]volume=0.5,$F,afade=t=out:st=0.13:d=0.03[a];\
[1:a]volume=0.5,$F,afade=t=out:st=0.13:d=0.03[b];\
[2:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=mono,\
asplit=2[s1][s2];[a][s1][b][s2][a]concat=n=5:v=0:a=1[o]" \
  -map "[o]" -ac 1 -ar 44100 -c:a pcm_s16le assets/sounds/rappel.wav
```

Fondus de 8 ms en entrée et 15 à 40 ms en sortie : une sinusoïde coupée net
claque dans le haut-parleur. Niveau à 0,5 pour laisser de la marge au volume
système.
