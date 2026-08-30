<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;
use libphonenumber\NumberParseException;

class AuthController extends Controller
{
    private const PIN = ['required', 'digits_between:4,8'];

    public function register(Request $r)
    {
        $data = $r->validate([
            'name' => 'required|string|max:80',
            'identifier' => 'required|string|max:80',
            'pin' => self::PIN,
            'role' => 'required|in:atelier,client',
        ]);
        $key = $this->identifierColumn($data['identifier']);
        $value = $this->normalizeIdentifier($key, $data['identifier']);
        if (User::where($key, $value)->exists()) {
            throw ValidationException::withMessages(['identifier' => 'Un compte existe déjà avec cet identifiant.']);
        }
        $user = User::create(['name' => $data['name'], $key => $value, 'password' => Hash::make($data['pin']), 'role' => $data['role']]);
        return $this->tokenResponse(auth('api')->login($user), $user);
    }

    public function login(Request $r)
    {
        $data = $r->validate(['identifier' => 'required|string', 'pin' => self::PIN]);
        $key = $this->identifierColumn($data['identifier']);
        $value = $this->normalizeIdentifier($key, $data['identifier']);
        $user = User::where($key, $value)->first();
        if (! $user || ! Hash::check($data['pin'], $user->password)) {
            $user?->increment('failed_logins');
            throw ValidationException::withMessages(['pin' => 'Identifiant ou code incorrect.']);
        }
        // Se reconnecter avant la purge annule la suppression demandée.
        $cancelled = $user->deletion_requested_at !== null;
        $user->update(['failed_logins' => 0] + ($cancelled ? ['deletion_requested_at' => null] : []));
        return $this->tokenResponse(auth('api')->login($user), $user, $cancelled);
    }

    public function refresh()
    {
        // L'ancien jeton est sur liste noire après refresh : lire l'utilisateur avec le nouveau.
        $token = auth('api')->refresh();
        return $this->tokenResponse($token, auth('api')->setToken($token)->user());
    }

    public function logout()
    {
        auth('api')->logout();
        return response()->noContent();
    }

    public function me(Request $r)
    {
        return $r->user()->loadOwnAtelier();
    }

    public function update(Request $r)
    {
        $data = $r->validate(['name' => 'sometimes|string|max:80', 'pin' => ['sometimes', ...self::PIN], 'current_pin' => 'required_with:pin']);
        $user = $r->user();
        if (isset($data['pin'])) {
            if (! Hash::check($data['current_pin'], $user->password)) {
                throw ValidationException::withMessages(['current_pin' => 'Code actuel incorrect.']);
            }
            $data['password'] = Hash::make($data['pin']);
        }
        $user->update(array_intersect_key($data, array_flip(['name', 'password'])));
        return $user->loadOwnAtelier();
    }

    public function destroy(Request $r)
    {
        $data = $r->validate(['pin' => 'required']);
        $user = $r->user();
        if (! Hash::check($data['pin'], $user->password)) {
            throw ValidationException::withMessages(['pin' => 'Code incorrect.']);
        }
        // Suppression différée de 7 jours (accounts:purge) : une reconnexion l'annule.
        $user->update(['deletion_requested_at' => now()]);
        auth('api')->logout();
        return response()->noContent();
    }

    public function becomeAtelier(Request $r): User
    {
        $user = $r->user();
        if ($user->role !== 'client') {
            throw ValidationException::withMessages(['role' => 'Ce compte n\'est pas un compte client.']);
        }
        $user->update(['role' => 'atelier']);
        return $user->loadOwnAtelier();
    }

    public function forgot(Request $r)
    {
        $r->validate(['email' => 'required|email']);
        Password::sendResetLink($r->only('email'));
        return response()->noContent();
    }

    public function reset(Request $r)
    {
        $data = $r->validate(['email' => 'required|email', 'token' => 'required', 'pin' => self::PIN]);
        $status = Password::reset(
            ['email' => $data['email'], 'token' => $data['token'], 'password' => $data['pin']],
            fn (User $u, string $pin) => $u->update(['password' => Hash::make($pin)]),
        );
        abort_unless($status === Password::PasswordReset, 422, 'Lien invalide ou expiré.');
        return response()->noContent();
    }

    private function tokenResponse(string $token, User $user, bool $deletionCancelled = false)
    {
        return [
            'access_token' => $token,
            'token_type' => 'bearer',
            'expires_in' => auth('api')->factory()->getTTL() * 60,
            'deletion_cancelled' => $deletionCancelled,
            'user' => $user->loadOwnAtelier(),
        ];
    }

    private function identifierColumn(string $id): string
    {
        return str_contains($id, '@') ? 'email' : 'phone';
    }

    private function normalizeIdentifier(string $key, string $value): string
    {
        if ($key === 'email') {
            if (! filter_var($value, FILTER_VALIDATE_EMAIL)) throw ValidationException::withMessages(['identifier' => 'Adresse e-mail invalide.']);
            return strtolower($value);
        }
        try {
            $phone = phone($value, 'SN');
            if (! $phone->isValid()) throw new NumberParseException(0, 'invalid');
            return $phone->formatE164();
        } catch (NumberParseException) {
            throw ValidationException::withMessages(['identifier' => 'Numéro de téléphone invalide.']);
        }
    }

    // Clé de limitation : ne doit jamais lever, même sur un identifiant invalide.
    public static function loginLimiterKey(string $identifier): string
    {
        if (str_contains($identifier, '@')) return strtolower($identifier);
        try {
            return phone($identifier, 'SN')->formatE164();
        } catch (NumberParseException) {
            return $identifier;
        }
    }
}
