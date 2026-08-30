<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Contact extends Model
{
    protected $casts = ['share_phone' => 'bool', 'handled_at' => 'datetime'];

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function atelier() { return $this->belongsTo(Atelier::class); }
}
