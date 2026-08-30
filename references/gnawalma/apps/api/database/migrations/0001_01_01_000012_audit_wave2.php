<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $t) {
            $t->string('measurements_photo_path')->nullable();
        });

        // registre_commerce (le numéro) reste ; la photo du document arrive à côté.
        Schema::table('ateliers', function (Blueprint $t) {
            $t->string('hours', 120)->nullable();
            $t->unsignedInteger('price_from')->nullable();
            $t->string('registre_commerce_path')->nullable();
        });

        Schema::table('users', function (Blueprint $t) {
            $t->timestamp('deletion_requested_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $t) {
            $t->dropColumn('measurements_photo_path');
        });
        Schema::table('ateliers', function (Blueprint $t) {
            $t->dropColumn(['hours', 'price_from', 'registre_commerce_path']);
        });
        Schema::table('users', function (Blueprint $t) {
            $t->dropColumn('deletion_requested_at');
        });
    }
};
