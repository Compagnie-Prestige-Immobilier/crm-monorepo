<?php

use App\Http\Controllers\MediaController;
use App\Http\Middleware\EnsureRole;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Validation\ValidationException;
use PHPOpenSourceSaver\JWTAuth\Exceptions\JWTException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api/v1',
        // Hors du groupe web : servir une image n'ouvre ni session ni cookie.
        then: fn () => Route::get('/m/{path}', [MediaController::class, 'show'])->where('path', '.*')->name('media.show'),
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias(['role' => EnsureRole::class]);
        $middleware->throttleApi();
        // Derrière le proxy Render : sans ça, Filament redirige en http.
        $middleware->trustProxies(at: '*');
        // L'API répond 401 en problem+json, jamais une redirection vers la connexion Filament.
        $middleware->redirectGuestsTo(fn (Request $r) => $r->is('api/*') ? null : route('filament.admin.auth.login'));
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // RFC 7807 pour toute l'API : le client mobile ne parse que ce format.
        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*')) return null;

            // Le model binding échoué remonte enveloppé dans une NotFoundHttpException.
            $notFound = $e instanceof ModelNotFoundException
                || ($e instanceof NotFoundHttpException && $e->getPrevious() instanceof ModelNotFoundException);

            [$status, $title, $extra, $detail] = match (true) {
                $e instanceof ValidationException => [422, 'Données invalides', ['errors' => $e->errors()], $e->getMessage()],
                $e instanceof JWTException => [401, 'Session expirée', [], null],
                $e instanceof AuthenticationException => [401, 'Connexion requise', [], null],
                $e instanceof ThrottleRequestsException => [429, 'Trop de tentatives', [], null],
                $notFound => [404, 'Introuvable', [], null],
                $e instanceof HttpExceptionInterface => [$e->getStatusCode(), $e->getMessage() ?: 'Erreur', [], $e->getMessage()],
                default => [500, 'Erreur serveur', [], null],
            };

            $headers = ['Content-Type' => 'application/problem+json'];
            if ($e instanceof HttpExceptionInterface) $headers += $e->getHeaders();

            return response()->json([
                'type' => 'about:blank',
                'title' => $title,
                'status' => $status,
                'detail' => $status === 500 && ! config('app.debug') ? null : $detail,
            ] + $extra, $status, $headers);
        });
    })->create();
