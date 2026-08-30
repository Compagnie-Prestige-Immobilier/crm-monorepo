<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Review extends Model
{
    public function user() { return $this->belongsTo(User::class); }

    /** @return BelongsTo<Atelier, $this> */
    public function atelier(): BelongsTo { return $this->belongsTo(Atelier::class); }
}
