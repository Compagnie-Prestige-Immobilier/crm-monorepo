<?php

namespace App\Http\Controllers;

use App\Support\Media;
use App\Support\Thumbnail;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;

class MediaController extends Controller
{
    // Un .m4a est souvent détecté en video/mp4 ou audio/x-m4a selon l'appareil.
    private const AUDIO_MIMES = 'audio/aac,audio/mp4,audio/x-m4a,audio/mpeg,audio/ogg,audio/webm,video/mp4';

    private const AUDIO_EXTENSIONS = ['audio/mpeg' => 'mp3', 'audio/ogg' => 'ogg', 'audio/webm' => 'webm'];

    /**
     * @return array{path: string, url: string, thumb_url: string|null}
     */
    public function store(Request $r): array
    {
        $voice = $r->input('kind') === 'voix';
        $data = $r->validate([
            'kind' => 'required|in:tissu,logo,couverture,portfolio,mesures,registre,voix',
            'file' => $voice ? 'required|file|mimetypes:'.self::AUDIO_MIMES.'|max:5120' : 'required|image|max:4096',
        ]);
        if ($voice) {
            $mime = (string) $data['file']->getMimeType();
            $path = 'voix/'.Str::uuid().'.'.(self::AUDIO_EXTENSIONS[$mime] ?? 'm4a');
            // Un .m4a détecté en video/mp4 est servi en audio/mp4 : les lecteurs mobiles s'y fient.
            if (! isset(self::AUDIO_EXTENSIONS[$mime])) $mime = 'audio/mp4';
            Media::put($path, $data['file']->getContent(), $mime);
        } else {
            $path = Media::store($data['file']->getContent(), $data['kind']);
        }

        return ['path' => $path, 'url' => (string) Media::url($path), 'thumb_url' => $voice ? null : Thumbnail::url($path)];
    }

    public function show(Request $r, string $path): Response
    {
        // Les images d'avant les vignettes n'en ont pas : on sert la pleine taille.
        $file = Media::fetch($path) ?? (str_ends_with($path, '_thumb.jpg') ? Media::fetch(substr($path, 0, -10).'.jpg') : null);
        abort_if($file === null, 404);

        $size = strlen($file['bytes']);
        $headers = [
            'Content-Type' => $file['mime'],
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'Accept-Ranges' => 'bytes',
        ];
        $response = response($file['bytes'], 200, $headers);
        $response->setEtag(md5($file['bytes']));
        if ($response->isNotModified($r)) return $response;

        // Les lecteurs audio demandent une tranche pour se déplacer dans la piste.
        $range = self::range($r->header('Range'), $size);
        if ($range === null) return $response;
        [$start, $end] = $range;
        if ($start > $end) return response('', 416, $headers + ['Content-Range' => "bytes */$size"]);

        return response(substr($file['bytes'], $start, $end - $start + 1), 206, $headers + ['Content-Range' => "bytes $start-$end/$size"]);
    }

    /** @return array{int, int}|null Bornes incluses, ou null si l'en-tête n'est pas une plage simple. */
    private static function range(?string $header, int $size): ?array
    {
        if ($header === null || ! preg_match('/^bytes=(\d*)-(\d*)$/', $header, $m) || $m[1].$m[2] === '') return null;
        // « bytes=-500 » demande les derniers octets.
        $start = $m[1] === '' ? max(0, $size - (int) $m[2]) : (int) $m[1];
        $end = $m[1] === '' || $m[2] === '' ? $size - 1 : min((int) $m[2], $size - 1);

        return [$start, $end];
    }
}
