<?php

use App\Http\Controllers\{AtelierController, AuthController, ClientController, MarketplaceController, MediaController, OrderController};
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

Route::prefix('auth')->controller(AuthController::class)->group(function () {
    Route::post('register', 'register')->middleware('throttle:register');
    Route::post('login', 'login')->middleware('throttle:login');
    Route::post('refresh', 'refresh');
    Route::post('mot-de-passe-oublie', 'forgot');
    Route::post('reinitialiser', 'reset');
    Route::middleware('auth:api')->group(function () {
        Route::post('logout', 'logout');
        Route::get('me', 'me');
        Route::patch('me', 'update');
        Route::delete('me', 'destroy');
        Route::post('devenir-atelier', 'becomeAtelier');
    });
});

Route::controller(MarketplaceController::class)->group(function () {
    Route::get('ateliers', 'search');
    Route::get('ateliers/completions', 'completions');
    Route::get('ateliers/{atelier}', 'show');
    Route::get('ateliers/{atelier}/avis', 'reviews');
    Route::get('promotions', 'promotions');
    Route::middleware('auth:api')->group(function () {
        Route::post('ateliers/{atelier}/contacts', 'contact');
        Route::post('avis', 'review');
        Route::post('signalements', 'report');
        Route::get('mes-contacts', 'myContacts');
        Route::get('mes-favoris', 'favorites');
        Route::post('mes-favoris/{atelier}', 'favorite');
        Route::delete('mes-favoris/{atelier}', 'unfavorite');
    });
});

Route::middleware(['auth:api', 'role:atelier'])->prefix('mon-atelier')->group(function () {
    Route::controller(AtelierController::class)->group(function () {
        Route::get('/', 'show');
        Route::post('/', 'store');
        Route::patch('/', 'update');
        Route::post('terminer', 'complete');
        Route::get('tableau', 'dashboard');
        Route::get('demandes', 'requests');
        Route::patch('demandes/{contact}', 'handleRequest');
        Route::post('portfolio', 'addPhoto');
        Route::patch('portfolio', 'reorderPhotos');
        Route::delete('portfolio/{photo}', 'removePhoto');
    });
    Route::controller(ClientController::class)->group(function () {
        Route::get('clients', 'index');
        Route::post('clients', 'store');
        Route::get('clients/{client}', 'show');
        Route::patch('clients/{client}', 'update');
        Route::delete('clients/{client}', 'destroy');
        Route::post('clients/{client}/fusionner/{autre}', 'merge');
        Route::post('clients/{client}/beneficiaires', 'storeBeneficiary');
        Route::patch('beneficiaires/{beneficiary}', 'updateBeneficiary');
        Route::delete('beneficiaires/{beneficiary}', 'destroyBeneficiary');
    });
    Route::controller(OrderController::class)->group(function () {
        Route::get('commandes', 'index');
        Route::post('commandes', 'store');
        Route::get('commandes/{order}', 'show');
        Route::patch('commandes/{order}', 'update');
        Route::patch('commandes/{order}/statut', 'status');
        Route::post('commandes/{order}/paiements', 'pay');
    });
});

Route::post('media', [MediaController::class, 'store'])->middleware(['auth:api', 'throttle:media']);

// Sonde de Render et version minimale de l'app mobile : aucun accès base.
Route::get('health', fn () => ['status' => 'up', 'min_version' => config('app.min_version')]);

Route::get('health/full', function () {
    $checks = ['db' => false, 'storage' => false];
    try {
        DB::select('select 1');
        $checks['db'] = true;
    } catch (Throwable) {
    }
    try {
        $checks['storage'] = Storage::disk('public')->exists('.');
    } catch (Throwable) {
    }
    $ok = ! in_array(false, $checks, true);
    return response()->json(['ok' => $ok] + $checks, $ok ? 200 : 503);
});
