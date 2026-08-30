<?php

namespace App\Models;

use App\Support\Media;
use App\Support\Thumbnail;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Cache;

class Promotion extends Model
{
    public const CACHE_KEY = 'promotions:actives';

    protected $casts = ['active' => 'bool'];
    protected $appends = ['image_url', 'image_thumb_url'];
    /** @return BelongsTo<Atelier, $this> */
    public function atelier(): BelongsTo { return $this->belongsTo(Atelier::class); }
    public function getImageUrlAttribute(): ?string { return Media::url($this->image_path); }
    public function getImageThumbUrlAttribute(): ?string { return Thumbnail::url($this->image_path); }

    protected static function booted(): void
    {
        static::saved(fn () => Cache::forget(self::CACHE_KEY));
        static::deleted(function (Promotion $promotion) {
            Cache::forget(self::CACHE_KEY);
            Media::forget($promotion->image_path);
        });
        static::updating(function (Promotion $promotion): void {
            if ($promotion->isDirty('image_path')) Media::forget($promotion->getOriginal('image_path'));
        });
    }
}
