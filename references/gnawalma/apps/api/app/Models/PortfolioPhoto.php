<?php

namespace App\Models;

use App\Support\Media;
use App\Support\Thumbnail;
use Illuminate\Database\Eloquent\Model;

class PortfolioPhoto extends Model
{
    protected $appends = ['url', 'thumb_url'];
    public function atelier() { return $this->belongsTo(Atelier::class); }
    public function getUrlAttribute(): ?string { return Media::url($this->path); }
    public function getThumbUrlAttribute(): ?string { return Thumbnail::url($this->path); }

    protected static function booted(): void
    {
        static::deleted(fn (PortfolioPhoto $photo) => Media::forget($photo->path));
    }
}
