<?php

namespace Tests\Feature;

use App\Models\Atelier;
use App\Models\Order;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class QaFixesTest extends TestCase
{
    use RefreshDatabase;

    private function registerAtelier(string $identifier, string $name = 'Atelier'): array
    {
        $token = $this->postJson('/api/v1/auth/register', ['name' => $name, 'identifier' => $identifier, 'pin' => '1234', 'role' => 'atelier'])
            ->assertOk()->json('access_token');
        $h = ['Authorization' => "Bearer $token"];
        $this->postJson('/api/v1/mon-atelier', ['name' => $name], $h)->assertCreated();
        return $h;
    }

    // Blocker 1 : la recherche par référence de commande ne doit pas fuiter d'un autre atelier.
    public function test_register_rejects_malformed_phone_and_email(): void
    {
        $base = ['name' => 'X', 'pin' => '1234', 'role' => 'client'];
        $this->postJson('/api/v1/auth/register', $base + ['identifier' => '7817076180'])->assertStatus(422)->assertJsonPath('errors.identifier.0', 'Numéro de téléphone invalide.');
        $this->postJson('/api/v1/auth/register', $base + ['identifier' => 'pas-un-mail@'])->assertStatus(422)->assertJsonPath('errors.identifier.0', 'Adresse e-mail invalide.');
        $this->postJson('/api/v1/auth/register', $base + ['identifier' => '78 170 76 18'])->assertOk()->assertJsonPath('user.phone', '+221781707618');
    }

    public function test_order_search_does_not_leak_across_ateliers(): void
    {
        $ha = $this->registerAtelier('77 111 11 11', 'Atelier A');
        $hb = $this->registerAtelier('77 222 22 22', 'Atelier B');

        $clientA = $this->postJson('/api/v1/mon-atelier/clients', ['name' => 'Client A'], $ha)->json();
        $order = ['client_id' => $clientA['id'], 'measurements' => 'x', 'total_cfa' => 1000, 'due_at' => now()->addWeek()->toIso8601String()];
        // Deux commandes de remplissage pour qu'A obtienne une référence "003" absente chez B.
        $this->postJson('/api/v1/mon-atelier/commandes', $order, $ha)->assertCreated();
        $this->postJson('/api/v1/mon-atelier/commandes', $order, $ha)->assertCreated();
        $orderA = $this->postJson('/api/v1/mon-atelier/commandes', $order, $ha)->assertCreated()->json();
        $this->assertStringEndsWith('003', $orderA['reference']);

        $clientB = $this->postJson('/api/v1/mon-atelier/clients', ['name' => 'Client B'], $hb)->json();
        $this->postJson('/api/v1/mon-atelier/commandes', [
            'client_id' => $clientB['id'], 'measurements' => 'x', 'total_cfa' => 1000, 'due_at' => now()->addWeek()->toIso8601String(),
        ], $hb)->assertCreated();

        $this->getJson('/api/v1/mon-atelier/commandes?q='.$orderA['reference'], $hb)->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/mon-atelier/commandes?q='.$orderA['reference'], $ha)->assertOk()->assertJsonCount(1, 'data');
    }

    // Blocker 2 : PATCH /auth/me ne doit persister que name/password, jamais pin/current_pin.
    public function test_auth_update_persists_only_name_and_password(): void
    {
        $token = $this->postJson('/api/v1/auth/register', ['name' => 'Ousmane', 'identifier' => 'ousmane3@example.sn', 'pin' => '5678', 'role' => 'client'])->json('access_token');
        $h = ['Authorization' => "Bearer $token"];

        $this->patchJson('/api/v1/auth/me', ['pin' => '9999', 'current_pin' => '5678'], $h)->assertSuccessful();

        // Avant le correctif, Model::unguard() propageait pin/current_pin vers update() et
        // provoquait un 500 (colonnes inexistantes) au lieu de simplement changer le mot de passe.
        $this->postJson('/api/v1/auth/login', ['identifier' => 'ousmane3@example.sn', 'pin' => '9999'])->assertOk();
    }

    // Blocker 3 : la table sessions doit exister pour SESSION_DRIVER=database (utilisé par Filament).
    public function test_sessions_table_exists(): void
    {
        $this->assertTrue(Schema::hasTable('sessions'));
    }

    // Blocker 4 : le rate limiter de login est clé par identifiant normalisé + IP.
    public function test_login_is_rate_limited_after_five_failures_regardless_of_identifier_format(): void
    {
        $this->postJson('/api/v1/auth/register', ['name' => 'Moussa', 'identifier' => '+221771234567', 'pin' => '1234', 'role' => 'atelier'])->assertOk();

        $formats = ['77 123 45 67', '771234567', '+221771234567', '77-123-45-67', '77 123 45 67'];
        foreach ($formats as $format) {
            $this->postJson('/api/v1/auth/login', ['identifier' => $format, 'pin' => '0000'])->assertStatus(422);
        }

        $response = $this->postJson('/api/v1/auth/login', ['identifier' => '+221771234567', 'pin' => '0000']);
        $response->assertStatus(429)
            ->assertJsonPath('title', 'Trop de tentatives')
            ->assertHeader('Content-Type', 'application/problem+json')
            ->assertHeader('Retry-After');
    }

    // Majeur 5 : ModelNotFound (route model binding) ne doit pas fuiter le message anglais de Laravel.
    public function test_model_not_found_returns_generic_french_title(): void
    {
        $response = $this->getJson('/api/v1/ateliers/999999');
        $response->assertStatus(404)
            ->assertJsonPath('title', 'Introuvable')
            ->assertJsonPath('detail', null);
    }

    // Majeur 5 : un jeton JWT invalide sur /auth/refresh doit renvoyer 401, pas 500.
    public function test_refresh_with_garbage_token_returns_401(): void
    {
        $response = $this->postJson('/api/v1/auth/refresh', [], ['Authorization' => 'Bearer ceci-nest-pas-un-jwt']);
        $response->assertStatus(401)->assertJsonPath('title', 'Session expirée');
    }

    // Majeur 6 : beneficiary_id doit être vérifié comme appartenant au client de la commande.
    public function test_order_update_rejects_foreign_beneficiary(): void
    {
        $h = $this->registerAtelier('77 333 33 33', 'Atelier C');
        $clientA = $this->postJson('/api/v1/mon-atelier/clients', ['name' => 'Client A'], $h)->json();
        $clientB = $this->postJson('/api/v1/mon-atelier/clients', ['name' => 'Client B'], $h)->json();
        $benB = $this->postJson("/api/v1/mon-atelier/clients/{$clientB['id']}/beneficiaires", ['label' => 'Elle-même', 'gender' => 'femme'], $h)->json();

        $order = $this->postJson('/api/v1/mon-atelier/commandes', [
            'client_id' => $clientA['id'], 'measurements' => 'x', 'total_cfa' => 1000, 'due_at' => now()->addWeek()->toIso8601String(),
        ], $h)->json();

        $this->patchJson("/api/v1/mon-atelier/commandes/{$order['id']}", [
            'beneficiary_id' => $benB['id'], 'measurements' => 'x', 'total_cfa' => 1000, 'due_at' => now()->addWeek()->toIso8601String(),
        ], $h)->assertStatus(404);
    }

    // Majeur 7 : un utilisateur atelier sans atelier ne doit jamais provoquer un 500.
    public function test_order_and_client_endpoints_guard_missing_atelier(): void
    {
        $token = $this->postJson('/api/v1/auth/register', ['name' => 'Sans Atelier', 'identifier' => '77 444 44 44', 'pin' => '1234', 'role' => 'atelier'])->json('access_token');
        $h = ['Authorization' => "Bearer $token"];

        $this->getJson('/api/v1/mon-atelier/commandes', $h)->assertStatus(404);
        $this->postJson('/api/v1/mon-atelier/commandes', ['measurements' => 'x', 'total_cfa' => 1000, 'due_at' => now()->toIso8601String()], $h)->assertStatus(404);
        $this->getJson('/api/v1/mon-atelier/clients', $h)->assertStatus(404);
        $this->postJson('/api/v1/mon-atelier/clients', ['name' => 'X'], $h)->assertStatus(404);
    }

    // Majeur 8 : paid_cfa vient de la somme agrégée dans les listes, sans requête par commande.
    public function test_order_list_exposes_paid_and_remaining(): void
    {
        $h = $this->registerAtelier('77 555 55 55', 'Atelier D');
        $client = $this->postJson('/api/v1/mon-atelier/clients', ['name' => 'Client'], $h)->json();
        $this->postJson('/api/v1/mon-atelier/commandes', [
            'client_id' => $client['id'], 'measurements' => 'x', 'total_cfa' => 40000, 'acompte_cfa' => 15000, 'due_at' => now()->addWeek()->toIso8601String(),
        ], $h)->assertCreated();
        // Une commande sans paiement : la somme SQL vaut NULL et doit tomber à 0.
        $this->postJson('/api/v1/mon-atelier/commandes', [
            'client_id' => $client['id'], 'measurements' => 'y', 'total_cfa' => 5000, 'due_at' => now()->addWeek()->toIso8601String(),
        ], $h)->assertCreated();

        $data = collect($this->getJson('/api/v1/mon-atelier/commandes', $h)->assertOk()->json('data'))->keyBy('measurements');
        $this->assertSame([15000, 25000], [$data['x']['paid_cfa'], $data['x']['remaining_cfa']]);
        $this->assertSame([0, 5000], [$data['y']['paid_cfa'], $data['y']['remaining_cfa']]);
    }

    // Mineur 17 : la référence suit le maximum du mois, pas le nombre de commandes,
    // sinon une suppression rejouerait une référence déjà utilisée (index unique).
    public function test_reference_does_not_collide_after_a_deletion(): void
    {
        $h = $this->registerAtelier('77 888 88 88', 'Atelier F');
        $client = $this->postJson('/api/v1/mon-atelier/clients', ['name' => 'Client'], $h)->json();
        $order = ['client_id' => $client['id'], 'measurements' => 'x', 'total_cfa' => 1000, 'due_at' => now()->addWeek()->toIso8601String()];

        $first = $this->postJson('/api/v1/mon-atelier/commandes', $order, $h)->assertCreated()->json();
        $this->postJson('/api/v1/mon-atelier/commandes', $order, $h)->assertCreated()->assertJsonPath('reference', str_replace('001', '002', $first['reference']));
        Order::whereKey($first['id'])->delete();

        $this->postJson('/api/v1/mon-atelier/commandes', $order, $h)->assertCreated()
            ->assertJsonPath('reference', str_replace('001', '003', $first['reference']));
    }

    // Majeur 10 : région restreinte à la liste, et centroïde recalculé quand le GPS est inconnu.
    public function test_region_change_rederives_centroid_when_gps_is_unknown(): void
    {
        $h = $this->registerAtelier('77 777 77 77', 'Atelier E');
        $this->patchJson('/api/v1/mon-atelier', ['region' => 'Sine-Saloum'], $h)->assertStatus(422);

        $this->patchJson('/api/v1/mon-atelier', ['region' => 'Dakar', 'specialties' => ['homme']], $h)->assertOk();
        $this->postJson('/api/v1/mon-atelier/terminer', [], $h)->assertOk()->assertJsonPath('latitude', 14.6928);

        $this->patchJson('/api/v1/mon-atelier', ['region' => 'Thiès'], $h)->assertOk()->assertJsonPath('latitude', 14.6928);

        Atelier::where('name', 'Atelier E')->update(['latitude' => null, 'longitude' => null]);
        $this->patchJson('/api/v1/mon-atelier', ['region' => 'Thiès'], $h)->assertOk()
            ->assertJsonPath('latitude', 14.791)->assertJsonPath('longitude', -16.926);
    }

    // Majeur 12 : le lien de réinitialisation ouvre l'app mobile, pas l'URL de l'API.
    public function test_password_reset_link_uses_the_configured_scheme(): void
    {
        Notification::fake();
        $this->postJson('/api/v1/auth/register', ['name' => 'Astou', 'identifier' => 'astou@example.sn', 'pin' => '1234', 'role' => 'client'])->assertOk();
        $this->postJson('/api/v1/auth/mot-de-passe-oublie', ['email' => 'astou@example.sn'])->assertNoContent();

        Notification::assertSentTo(
            User::where('email', 'astou@example.sn')->firstOrFail(),
            ResetPassword::class,
            fn (ResetPassword $n, array $channels, User $user) => str_starts_with($n->toMail($user)->actionUrl, 'gnawalma://reinitialiser?token=')
        );
    }

    // Mineur 13 : une recherche sans aucun token exploitable ne doit pas produire de SQL invalide.
    public function test_search_with_punctuation_only_query_is_not_a_server_error(): void
    {
        $this->seed();
        $this->getJson('/api/v1/ateliers?q='.urlencode('&&& !!'))->assertOk();
    }

    // Mineur 13 : is_favorite sur la recherche, colonnes générées masquées, limit borné à 50.
    public function test_search_exposes_is_favorite_and_hides_generated_columns(): void
    {
        $this->seed();

        $guest = $this->getJson('/api/v1/ateliers?limit=999')->assertOk();
        $this->assertLessThanOrEqual(50, count($guest->json('data')));
        $this->assertFalse($guest->json('data.0.is_favorite'));
        $this->assertArrayNotHasKey('search', $guest->json('data.0'));
        $this->assertArrayNotHasKey('search_text', $guest->json('data.0'));

        $token = $this->postJson('/api/v1/auth/register', ['name' => 'Fatou', 'identifier' => 'fatou@example.sn', 'pin' => '5678', 'role' => 'client'])->json('access_token');
        $h = ['Authorization' => "Bearer $token"];
        $favori = Atelier::where('name', 'Atelier Sow')->first();
        $this->postJson("/api/v1/mes-favoris/{$favori->id}", [], $h)->assertNoContent();

        $data = collect($this->getJson('/api/v1/ateliers?limit=0', $h)->assertOk()->json('data'));
        $this->assertCount(1, $data, 'limit=0 doit être ramené à 1');
        $ateliers = collect($this->getJson('/api/v1/ateliers?q=sow', $h)->assertOk()->json('data'))->keyBy('name');
        $this->assertTrue($ateliers['Atelier Sow']['is_favorite']);
    }

    // Mineur 14 : un atelier non terminé reste invisible côté marketplace.
    public function test_incomplete_atelier_is_not_reachable_from_marketplace(): void
    {
        $this->registerAtelier('77 666 66 66', 'Atelier Brouillon');
        $atelier = Atelier::where('name', 'Atelier Brouillon')->firstOrFail();

        $token = $this->postJson('/api/v1/auth/register', ['name' => 'Awa', 'identifier' => 'awa@example.sn', 'pin' => '5678', 'role' => 'client'])->json('access_token');
        $h = ['Authorization' => "Bearer $token"];

        $this->getJson("/api/v1/ateliers/{$atelier->id}")->assertStatus(404);
        $this->getJson("/api/v1/ateliers/{$atelier->id}/avis")->assertStatus(404);
        $this->postJson("/api/v1/ateliers/{$atelier->id}/contacts", ['channel' => 'request'], $h)->assertStatus(404);
        $this->postJson('/api/v1/avis', ['atelier_id' => $atelier->id, 'rating' => 5], $h)->assertStatus(404);
    }

    // Mineur 16 : l'inscription est limitée à 5 par minute et par IP.
    public function test_register_is_throttled_per_ip(): void
    {
        foreach (range(1, 5) as $i) {
            $this->postJson('/api/v1/auth/register', ['name' => "U$i", 'identifier' => "u$i@example.sn", 'pin' => '1234', 'role' => 'client'])->assertOk();
        }
        $this->postJson('/api/v1/auth/register', ['name' => 'U6', 'identifier' => 'u6@example.sn', 'pin' => '1234', 'role' => 'client'])
            ->assertStatus(429)->assertJsonPath('title', 'Trop de tentatives')->assertHeader('X-RateLimit-Limit');
    }
}
