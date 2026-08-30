<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;
use Intervention\Image\Encoders\JpegEncoder;
use Intervention\Image\Laravel\Facades\Image;

class Thumbnail
{
    private const MAX_EDGE = 480;

    public static function path(string $path): string
    {
        return preg_replace('/\.\w+$/', '', $path).'_thumb.jpg';
    }

    public static function encode(string $bytes): string
    {
        return (string) Image::decodeBinary($bytes)->scaleDown(self::MAX_EDGE, self::MAX_EDGE)->encode(new JpegEncoder(quality: 80));
    }

    // Images de démonstration : le seeder les garde sur le disque public.
    public static function make(string $path): void
    {
        $disk = Storage::disk('public');
        $disk->put(self::path($path), self::encode((string) $disk->get($path)));
    }

    // Sans repli ici : /m/{path} sert l'image pleine quand la vignette manque.
    public static function url(?string $path): ?string
    {
        return $path === null ? null : Media::url(self::path($path));
    }
}
