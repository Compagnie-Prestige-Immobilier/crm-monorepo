<?php

namespace App\Models;

use App\Support\Media;
use App\Support\Thumbnail;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Cache;

/**
 * Attributs calculés par le contrôleur marketplace, jamais persistés.
 *
 * @property bool $is_favorite
 * @property bool $can_review
 */
class Atelier extends Model
{
    protected $casts = ['specialties' => 'array', 'verified_at' => 'datetime', 'completed_at' => 'datetime', 'latitude' => 'float', 'longitude' => 'float'];
    protected $appends = ['logo_url', 'cover_url', 'logo_thumb_url', 'cover_thumb_url', 'share_url'];

    // Colonnes générées pour l'index plein texte, jamais exposées par l'API.
    // La note de vérification est un motif de modération : visible du seul propriétaire.
    protected $hidden = ['search', 'search_text', 'verification_note'];

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    /** @return HasMany<PortfolioPhoto, $this> */
    public function photos(): HasMany { return $this->hasMany(PortfolioPhoto::class)->orderBy('position'); }
    public function clients() { return $this->hasMany(Client::class); }
    public function orders() { return $this->hasMany(Order::class); }
    public function contacts() { return $this->hasMany(Contact::class); }
    public function reviews() { return $this->hasMany(Review::class)->where('status', 'published'); }

    public function getLogoUrlAttribute(): ?string { return Media::url($this->logo_path); }
    public function getCoverUrlAttribute(): ?string { return Media::url($this->cover_path); }
    public function getLogoThumbUrlAttribute(): ?string { return Thumbnail::url($this->logo_path); }
    public function getCoverThumbUrlAttribute(): ?string { return Thumbnail::url($this->cover_path); }
    public function getShareUrlAttribute(): string { return url('/a/'.$this->id); }

    public function scopePublic($q) { return $q->whereNotNull('completed_at'); }

    public static function cacheVersion(): int
    {
        return (int) Cache::get('ateliers:v', 0);
    }

    protected static function booted(): void
    {
        // Le store database n'incrémente pas une clé absente : on l'amorce au premier passage.
        $bump = fn () => Cache::increment('ateliers:v') || Cache::forever('ateliers:v', 1);
        static::saved($bump);
        static::deleted($bump);

        static::updating(function (Atelier $atelier): void {
            foreach (['logo_path', 'cover_path', 'registre_commerce_path'] as $column) {
                if ($atelier->isDirty($column)) Media::forget($atelier->getOriginal($column));
            }
        });
    }

    // Haversine en km, sans PostGIS. Suffisant à l'échelle du Sénégal.
    public function scopeWithDistance($q, ?float $lat, ?float $lng)
    {
        if ($lat === null || $lng === null) return $q->selectRaw('ateliers.*, NULL::float AS distance_km');
        return $q->selectRaw('ateliers.*, 6371 * acos(least(1.0, cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude)))) AS distance_km', [$lat, $lng, $lat]);
    }
}
