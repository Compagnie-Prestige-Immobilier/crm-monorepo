<?php

namespace App\Providers;

use App\Http\Controllers\AuthController;
use App\OpenApi\ModelSchemas;
use Dedoc\Scramble\Scramble;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Model::unguard();
        Scramble::afterOpenApiGenerated(new ModelSchemas);

        // Par identifiant + IP : 5 essais puis 30 s. Par identifiant seul, délai croissant
        // pour qu'un attaquant changeant d'IP soit ralenti sur le même compte.
        RateLimiter::for('login', function (Request $r) {
            $id = AuthController::loginLimiterKey((string) $r->input('identifier'));
            return [
                new Limit("$id|".$r->ip(), 5, 30),
                Limit::perMinute(5)->by("login:$id"),
                Limit::perMinutes(10, 10)->by("login:10m:$id"),
                Limit::perHour(20)->by("login:1h:$id"),
            ];
        });

        // Filet grossier par IP sur toute l'API, indépendant des limiteurs par route.
        RateLimiter::for('api', fn (Request $r) => Limit::perMinute(120)->by($r->ip()));
        RateLimiter::for('register', fn (Request $r) => Limit::perMinute(5)->by($r->ip()));
        RateLimiter::for('media', fn (Request $r) => Limit::perMinute(30)->by((string) $r->user()?->id));

        ResetPassword::createUrlUsing(fn ($user, string $token) => rtrim(config('app.frontend_reset_url'), '/')."?token=$token&email=".urlencode($user->email));
    }
}
