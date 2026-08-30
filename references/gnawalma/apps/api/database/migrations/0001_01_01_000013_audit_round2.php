<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $t) {
            $t->string('client_token', 64)->nullable();
            $t->timestamp('delivered_at')->nullable();
            $t->jsonb('total_history')->nullable();
            $t->unsignedInteger('total_cfa')->nullable()->change();
            $t->unique(['atelier_id', 'client_token']);
        });

        // Les commandes déjà livrées gardent leur date de dernière modification comme livraison.
        DB::statement("update orders set delivered_at = updated_at where status = 'livre'");

        Schema::table('payments', function (Blueprint $t) {
            $t->string('client_token', 64)->nullable();
            $t->foreignId('correction_of')->nullable()->constrained('payments')->nullOnDelete();
            $t->unique(['order_id', 'client_token']);
        });

        Schema::table('ateliers', function (Blueprint $t) {
            $t->text('verification_note')->nullable();
        });

        Schema::table('users', function (Blueprint $t) {
            $t->unsignedInteger('failed_logins')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $t) {
            $t->dropUnique(['atelier_id', 'client_token']);
            $t->dropColumn(['client_token', 'delivered_at', 'total_history']);
        });
        Schema::table('payments', function (Blueprint $t) {
            $t->dropUnique(['order_id', 'client_token']);
            $t->dropConstrainedForeignId('correction_of');
            $t->dropColumn('client_token');
        });
        Schema::table('ateliers', function (Blueprint $t) {
            $t->dropColumn('verification_note');
        });
        Schema::table('users', function (Blueprint $t) {
            $t->dropColumn('failed_logins');
        });
    }
};
