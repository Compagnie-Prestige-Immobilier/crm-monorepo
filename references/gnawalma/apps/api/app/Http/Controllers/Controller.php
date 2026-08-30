<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

abstract class Controller
{
    protected function limit(Request $r, int $default = 30): int
    {
        return min(50, max(1, $r->integer('limit', $default)));
    }
}
