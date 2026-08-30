<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// orders(atelier_id, status, due_at) existe déjà ; favorites(user_id) est le préfixe de la clé primaire.
return new class extends Migration {
    private const INDEXES = [
        'orders' => [['client_id']],
        'payments' => [['order_id']],
        'contacts' => [['user_id', 'created_at'], ['atelier_id', 'handled_at']],
        'reviews' => [['atelier_id', 'status']],
        'promotions' => [['active', 'position']],
        'ateliers' => [['region'], ['completed_at', 'verified_at']],
    ];

    public function up(): void
    {
        foreach (self::INDEXES as $table => $indexes) {
            Schema::table($table, function (Blueprint $t) use ($indexes) {
                foreach ($indexes as $columns) $t->index($columns);
            });
        }
    }

    public function down(): void
    {
        foreach (self::INDEXES as $table => $indexes) {
            Schema::table($table, function (Blueprint $t) use ($indexes) {
                foreach ($indexes as $columns) $t->dropIndex($columns);
            });
        }
    }
};
