<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Encoders\JpegEncoder;
use Intervention\Image\Laravel\Facades\Image;

// Les images vivent dans Postgres : le disque de Render est effacé à chaque redémarrage.
class Media
{
    /** Dossier temporaire des dépôts Filament sur le disque public. */
    public const UPLOAD_DIR = 'promotions';

    private const MAX_EDGE = 1600;

    /** Redimensionne, enregistre l'image et sa vignette, renvoie le chemin. */
    public static function store(string $bytes, string $kind): string
    {
        $full = (string) Image::decodeBinary($bytes)->orient()->scaleDown(self::MAX_EDGE, self::MAX_EDGE)->encode(new JpegEncoder(quality: 82));
        $path = $kind.'/'.Str::uuid().'.jpg';
        self::put($path, $full);
        self::put(Thumbnail::path($path), Thumbnail::encode($full));

        return $path;
    }

    /** Reprend en base le fichier que Filament vient de déposer sur le disque public. */
    public static function adopt(?string $path): ?string
    {
        if ($path === null || ! str_starts_with($path, self::UPLOAD_DIR.'/') || ! Storage::disk('public')->exists($path)) return $path;
        $stored = self::store((string) Storage::disk('public')->get($path), self::UPLOAD_DIR);
        Storage::disk('public')->delete($path);

        return $stored;
    }

    // PDO transmet les liaisons en texte : le binaire passe par du base64.
    public static function put(string $path, string $bytes, string $mime = 'image/jpeg'): void
    {
        DB::statement(
            "insert into media (path, mime, bytes, created_at) values (?, ?, decode(?, 'base64'), ?)
             on conflict (path) do update set mime = excluded.mime, bytes = excluded.bytes",
            [$path, $mime, base64_encode($bytes), now()],
        );
    }

    /** @return array{mime: string, bytes: string}|null */
    public static function fetch(string $path): ?array
    {
        $row = DB::selectOne("select mime, encode(bytes, 'base64') as b64 from media where path = ?", [$path]);

        return $row === null ? null : ['mime' => (string) $row->mime, 'bytes' => (string) base64_decode((string) $row->b64)];
    }

    public static function forget(?string $path): void
    {
        if ($path === null) return;
        DB::table('media')->whereIn('path', [$path, Thumbnail::path($path)])->delete();
    }

    public static function url(?string $path): ?string
    {
        return $path === null ? null : url("/m/$path");
    }
}
