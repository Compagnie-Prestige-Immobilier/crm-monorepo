<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS unaccent');
    }

    // Pas de DROP EXTENSION : d'autres objets de la base en dépendent encore au rollback.
    public function down(): void {}
};
