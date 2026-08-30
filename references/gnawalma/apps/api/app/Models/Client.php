<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Client extends Model
{
    // Agrégat de la liste des clients, absent des autres réponses.
    protected $casts = ['last_order_at' => 'datetime'];

    public function atelier() { return $this->belongsTo(Atelier::class); }
    public function beneficiaries() { return $this->hasMany(Beneficiary::class); }
    public function orders() { return $this->hasMany(Order::class); }
}
