<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Beneficiary extends Model
{
    /** @return BelongsTo<Client, $this> */
    public function client(): BelongsTo { return $this->belongsTo(Client::class); }
}
