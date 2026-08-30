<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Report extends Model
{
    protected $casts = ['resolved_at' => 'datetime'];

    public function user() { return $this->belongsTo(User::class); }
    /** @return MorphTo<Model, $this> */
    public function reportable(): MorphTo { return $this->morphTo(); }
}
