<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('ateliers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('region', 40)->nullable();
            $table->string('address')->nullable();
            $table->string('registre_commerce', 60)->nullable();
            $table->decimal('latitude', 9, 6)->nullable();
            $table->decimal('longitude', 9, 6)->nullable();
            $table->jsonb('specialties')->default('[]');
            $table->string('logo_path')->nullable();
            $table->string('cover_path')->nullable();
            $table->string('tiktok')->nullable();
            $table->string('instagram')->nullable();
            $table->string('facebook')->nullable();
            $table->unsignedTinyInteger('wizard_step')->default(1);
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();
        });

        Schema::create('portfolio_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('atelier_id')->constrained()->cascadeOnDelete();
            $table->string('path');
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('clients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('atelier_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('phone', 20)->nullable();
            $table->string('address')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('beneficiaries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->string('label');
            $table->string('gender', 10);
            $table->text('measurements')->nullable();
            $table->timestamps();
        });

        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('atelier_id')->constrained()->cascadeOnDelete();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->foreignId('beneficiary_id')->nullable()->constrained()->nullOnDelete();
            $table->string('reference', 20);
            $table->text('measurements');
            $table->text('description')->nullable();
            $table->string('fabric_photo_path')->nullable();
            $table->unsignedInteger('total_cfa');
            $table->string('status', 12)->default('en_cours');
            $table->timestamp('due_at');
            $table->timestamps();
            $table->unique(['atelier_id', 'reference']);
            $table->index(['atelier_id', 'status', 'due_at']);
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->integer('amount_cfa');
            $table->timestamps();
        });

        Schema::create('contacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('atelier_id')->constrained()->cascadeOnDelete();
            $table->string('channel', 10);
            $table->text('message')->nullable();
            $table->boolean('share_phone')->default(false);
            $table->timestamp('handled_at')->nullable();
            $table->timestamps();
        });

        Schema::create('reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('atelier_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('rating');
            $table->string('text', 500)->nullable();
            $table->string('status', 10)->default('published');
            $table->timestamps();
            $table->unique(['user_id', 'atelier_id']);
        });

        Schema::create('favorites', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('atelier_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->primary(['user_id', 'atelier_id']);
        });

        Schema::create('promotions', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('image_path');
            $table->foreignId('atelier_id')->nullable()->constrained()->nullOnDelete();
            $table->string('search_query')->nullable();
            $table->boolean('active')->default(true);
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->morphs('reportable');
            $table->string('reason', 500);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['reports', 'promotions', 'favorites', 'reviews', 'contacts', 'payments', 'orders', 'beneficiaries', 'clients', 'portfolio_photos', 'ateliers'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
