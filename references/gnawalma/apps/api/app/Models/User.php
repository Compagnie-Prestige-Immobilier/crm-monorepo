<?php

namespace App\Models;

use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use PHPOpenSourceSaver\JWTAuth\Contracts\JWTSubject;

class User extends Authenticatable implements FilamentUser, JWTSubject
{
    use Notifiable;

    protected $hidden = ['password'];
    protected $casts = ['deletion_requested_at' => 'datetime'];

    public function getJWTIdentifier(): mixed { return $this->getKey(); }
    public function getJWTCustomClaims(): array { return ['role' => $this->role]; }
    public function canAccessPanel(Panel $panel): bool { return $this->role === 'admin'; }

    /** @return HasOne<Atelier, $this> */
    public function atelier(): HasOne { return $this->hasOne(Atelier::class); }

    // Le propriétaire voit le motif de vérification, masqué partout ailleurs.
    public function loadOwnAtelier(): static
    {
        $this->load('atelier');
        $this->atelier?->makeVisible('verification_note');
        return $this;
    }
    public function favorites() { return $this->belongsToMany(Atelier::class, 'favorites')->withTimestamps(); }
    public function contacts() { return $this->hasMany(Contact::class); }
    public function reviews() { return $this->hasMany(Review::class); }
}
