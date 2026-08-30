<?php

namespace App\Models;

use App\Support\Media;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    public const STATUSES = ['en_cours', 'pret', 'livre', 'annule'];

    protected $casts = ['due_at' => 'datetime', 'delivered_at' => 'datetime', 'total_history' => 'array'];
    protected $appends = ['paid_cfa', 'remaining_cfa', 'fabric_photo_url', 'measurements_photo_url', 'voice_note_url'];

    public function atelier() { return $this->belongsTo(Atelier::class); }
    public function client() { return $this->belongsTo(Client::class); }
    public function beneficiary() { return $this->belongsTo(Beneficiary::class); }
    public function payments() { return $this->hasMany(Payment::class)->orderBy('created_at')->orderBy('id'); }

    // withSum('payments as paid_cfa') évite la requête par commande dans les listes.
    public function getPaidCfaAttribute(): int
    {
        return array_key_exists('paid_cfa', $this->attributes)
            ? (int) $this->attributes['paid_cfa']
            : (int) $this->payments()->sum('amount_cfa');
    }

    // Montant total facultatif tant que la commande n'est pas livrée : le reste dû est alors inconnu.
    public function getRemainingCfaAttribute(): ?int { return $this->total_cfa === null ? null : $this->total_cfa - $this->paid_cfa; }
    public function getFabricPhotoUrlAttribute(): ?string { return Media::url($this->fabric_photo_path); }
    public function getMeasurementsPhotoUrlAttribute(): ?string { return Media::url($this->measurements_photo_path); }
    public function getVoiceNoteUrlAttribute(): ?string { return Media::url($this->voice_note_path); }

    protected static function booted(): void
    {
        static::updating(function (Order $order): void {
            foreach (['fabric_photo_path', 'measurements_photo_path', 'voice_note_path'] as $column) {
                if ($order->isDirty($column)) Media::forget($order->getOriginal($column));
            }
            if (! $order->isDirty('total_cfa')) return;
            $order->total_history = [...$order->total_history ?? [], [
                'at' => now()->toIso8601String(),
                'from' => $order->getOriginal('total_cfa') === null ? null : (int) $order->getOriginal('total_cfa'),
                'to' => $order->total_cfa === null ? null : (int) $order->total_cfa,
            ]];
        });
    }

    // Doit être appelé dans la même transaction que le create() : le verrou sur
    // l'atelier sérialise les créations concurrentes jusqu'au commit de l'appelant.
    public static function nextReference(int $atelierId): string
    {
        Atelier::whereKey($atelierId)->lockForUpdate()->value('id');
        $prefix = 'C-'.now()->format('ym').'-';
        $last = static::where('atelier_id', $atelierId)->where('reference', 'like', "$prefix%")->max('reference');
        return $prefix.sprintf('%03d', $last === null ? 1 : (int) substr($last, strlen($prefix)) + 1);
    }
}
