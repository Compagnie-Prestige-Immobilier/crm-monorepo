<?php

namespace Tests\Feature;

use App\Models\Atelier;
use App\Models\Client;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuditWave2Test extends TestCase
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

    private function publishAtelier(array $h): Atelier
    {
        $this->patchJson('/api/v1/mon-atelier', ['region' => 'Dakar', 'specialties' => ['homme']], $h)->assertOk();
        return Atelier::findOrFail($this->postJson('/api/v1/mon-atelier/terminer', [], $h)->assertOk()->json('id'));
    }

    private function createOrder(array $h, int $clientId, array $overrides = []): array
    {
        return $this->postJson('/api/v1/mon-atelier/commandes', $overrides + [
            'client_id' => $clientId, 'measurements' => 'x', 'total_cfa' => 40000, 'due_at' => now()->addWeek()->toIso8601String(),
        ], $h)->assertCreated()->json();
    }

    public function test_atelier_carries_hours_price_from_and_registre_photo(): void
    {
        $h = $this->registerAtelier('77 111 11 01', 'Atelier A');
        $this->patchJson('/api/v1/mon-atelier', [
            'hours' => 'Lun-Sam, 9h-19h', 'price_from' => 5000, 'registre_commerce_path' => 'registre/abc.jpg',
        ], $h)->assertOk()->assertJsonPath('hours', 'Lun-Sam, 9h-19h')->assertJsonPath('price_from', 5000)
            ->assertJsonPath('registre_commerce_path', 'registre/abc.jpg');

        $this->getJson('/api/v1/mon-atelier', $h)->assertOk()->assertJsonPath('hours', 'Lun-Sam, 9h-19h');

        $atelier = $this->publishAtelier($h);
        $this->getJson("/api/v1/ateliers/{$atelier->id}")->assertOk()
            ->assertJsonPath('hours', 'Lun-Sam, 9h-19h')
            ->assertJsonPath('price_from', 5000)
            ->assertJsonPath('share_url', url("/a/{$atelier->id}"));
        $this->getJson('/api/v1/ateliers')->assertOk()->assertJsonPath('data.0.price_from', 5000);

        $this->patchJson('/api/v1/mon-atelier', ['price_from' => -1], $h)->assertStatus(422);
    }

    public function test_order_carries_measurements_photo_and_index_loads_beneficiary(): void
    {
        $h = $this->registerAtelier('77 111 11 02', 'Atelier B');
        $client = $this->postJson('/api/v1/mon-atelier/clients', ['name' => 'Awa'], $h)->json();
        $ben = $this->postJson("/api/v1/mon-atelier/clients/{$client['id']}/beneficiaires", ['label' => 'Son fils', 'gender' => 'enfant'], $h)
            ->assertCreated()->json();

        $order = $this->createOrder($h, $client['id'], ['beneficiary_id' => $ben['id'], 'measurements_photo_path' => 'mesures/a.jpg']);
        $this->assertSame('mesures/a.jpg', $order['measurements_photo_path']);

        $this->getJson("/api/v1/mon-atelier/commandes/{$order['id']}", $h)->assertOk()
            ->assertJsonPath('measurements_photo_path', 'mesures/a.jpg');

        $this->patchJson("/api/v1/mon-atelier/commandes/{$order['id']}", [
            'measurements' => 'x', 'total_cfa' => 40000, 'due_at' => now()->addWeek()->toIso8601String(), 'measurements_photo_path' => 'mesures/b.jpg',
        ], $h)->assertOk()->assertJsonPath('measurements_photo_path', 'mesures/b.jpg');

        $this->getJson('/api/v1/mon-atelier/commandes', $h)->assertOk()
            ->assertJsonPath('data.0.beneficiary.label', 'Son fils')
            ->assertJsonPath('data.0.measurements_photo_path', 'mesures/b.jpg');
    }

    public function test_client_show_returns_orders_latest_first_with_measurements(): void
    {
        $h = $this->registerAtelier('77 111 11 03', 'Atelier C');
        $client = $this->postJson('/api/v1/mon-atelier/clients', ['name' => 'Awa'], $h)->json();

        $ancienne = $this->createOrder($h, $client['id'], ['measurements' => 'ancienne', 'due_at' => now()->addDay()->toIso8601String()]);
        Order::whereKey($ancienne['id'])->update(['created_at' => now()->subDay()]);
        $recente = $this->createOrder($h, $client['id'], ['measurements' => 'recente', 'measurements_photo_path' => 'mesures/c.jpg']);

        $body = $this->getJson("/api/v1/mon-atelier/clients/{$client['id']}", $h)->assertOk()->json();
        $this->assertSame($recente['id'], $body['orders'][0]['id']);
        $this->assertSame('recente', $body['orders'][0]['measurements']);
        $this->assertSame('mesures/c.jpg', $body['orders'][0]['measurements_photo_path']);
        foreach (['id', 'reference', 'measurements', 'measurements_photo_path', 'created_at', 'status', 'total_cfa', 'beneficiary_id'] as $field) {
            $this->assertArrayHasKey($field, $body['orders'][0]);
        }
    }

    public function test_clients_are_sorted_by_last_activity(): void
    {
        $h = $this->registerAtelier('77 111 11 04', 'Atelier D');
        $awa = $this->postJson('/api/v1/mon-atelier/clients', ['name' => 'Awa'], $h)->json();
        $bou = $this->postJson('/api/v1/mon-atelier/clients', ['name' => 'Bou'], $h)->json();
        Client::whereKey($awa['id'])->update(['created_at' => now()->subDays(3)]);
        Client::whereKey($bou['id'])->update(['created_at' => now()->subDays(2)]);

        $list = $this->getJson('/api/v1/mon-atelier/clients', $h)->assertOk()->json('data');
        $this->assertSame([$bou['id'], $awa['id']], array_column($list, 'id'));
        $this->assertNull($list[0]['last_order_at']);

        $this->createOrder($h, $awa['id']);
        $list = $this->getJson('/api/v1/mon-atelier/clients', $h)->assertOk()->json('data');
        $this->assertSame([$awa['id'], $bou['id']], array_column($list, 'id'));
        $this->assertNotNull($list[0]['last_order_at']);

        $this->assertSame([$awa['id']], array_column($this->getJson('/api/v1/mon-atelier/clients?q=Awa', $h)->assertOk()->json('data'), 'id'));
    }

    public function test_client_delete_is_refused_while_an_order_is_open(): void
    {
        $h = $this->registerAtelier('77 111 11 05', 'Atelier E');
        $autre = $this->registerAtelier('77 111 11 06', 'Atelier F');
        $client = $this->postJson('/api/v1/mon-atelier/clients', ['name' => 'Awa'], $h)->json();
        $order = $this->createOrder($h, $client['id']);

        $this->deleteJson("/api/v1/mon-atelier/clients/{$client['id']}", [], $h)
            ->assertStatus(422)->assertJsonPath('detail', 'Ce client a des commandes en cours. Livrez-les ou annulez-les d\'abord.');

        $this->patchJson("/api/v1/mon-atelier/commandes/{$order['id']}/statut", ['status' => 'pret'], $h)->assertOk();
        $this->deleteJson("/api/v1/mon-atelier/clients/{$client['id']}", [], $h)->assertStatus(422);
        $this->patchJson("/api/v1/mon-atelier/commandes/{$order['id']}/statut", ['status' => 'livre'], $h)->assertOk();

        $this->deleteJson("/api/v1/mon-atelier/clients/{$client['id']}", [], $autre)->assertNotFound();
        $this->deleteJson("/api/v1/mon-atelier/clients/{$client['id']}", [], $h)->assertNoContent();
        $this->assertDatabaseMissing('clients', ['id' => $client['id']]);
        $this->assertDatabaseMissing('orders', ['id' => $order['id']]);
    }

    public function test_beneficiary_delete_keeps_the_order(): void
    {
        $h = $this->registerAtelier('77 111 11 07', 'Atelier G');
        $autre = $this->registerAtelier('77 111 11 08', 'Atelier H');
        $client = $this->postJson('/api/v1/mon-atelier/clients', ['name' => 'Awa'], $h)->json();
        $ben = $this->postJson("/api/v1/mon-atelier/clients/{$client['id']}/beneficiaires", ['label' => 'Lui-même', 'gender' => 'homme'], $h)->json();
        $order = $this->createOrder($h, $client['id'], ['beneficiary_id' => $ben['id']]);

        $this->deleteJson("/api/v1/mon-atelier/beneficiaires/{$ben['id']}", [], $autre)->assertNotFound();
        $this->deleteJson("/api/v1/mon-atelier/beneficiaires/{$ben['id']}", [], $h)->assertNoContent();
        $this->assertDatabaseMissing('beneficiaries', ['id' => $ben['id']]);
        $this->assertDatabaseHas('orders', ['id' => $order['id'], 'beneficiary_id' => null]);
    }

    public function test_a_client_account_can_become_an_atelier(): void
    {
        $token = $this->postJson('/api/v1/auth/register', ['name' => 'Awa', 'identifier' => '76 111 11 09', 'pin' => '1234', 'role' => 'client'])
            ->assertOk()->json('access_token');
        $h = ['Authorization' => "Bearer $token"];

        $this->postJson('/api/v1/auth/devenir-atelier', [], $h)->assertOk()
            ->assertJsonPath('role', 'atelier')->assertJsonPath('atelier', null);
        $this->postJson('/api/v1/mon-atelier', ['name' => 'Nouvel atelier'], $h)->assertCreated();

        $this->postJson('/api/v1/auth/devenir-atelier', [], $h)->assertStatus(422)
            ->assertJsonPath('errors.role.0', 'Ce compte n\'est pas un compte client.');
        $this->postJson('/api/v1/auth/devenir-atelier')->assertStatus(401);
    }

    public function test_account_deletion_is_deferred_purged_and_cancelled_by_a_new_login(): void
    {
        $identifier = '76 111 11 10';
        $token = $this->postJson('/api/v1/auth/register', ['name' => 'Awa', 'identifier' => $identifier, 'pin' => '1234', 'role' => 'client'])
            ->assertOk()->json('access_token');
        $h = ['Authorization' => "Bearer $token"];
        $this->getJson('/api/v1/auth/me', $h)->assertOk()->assertJsonPath('deletion_requested_at', null);

        $this->deleteJson('/api/v1/auth/me', ['pin' => '0000'], $h)->assertStatus(422);
        $this->deleteJson('/api/v1/auth/me', ['pin' => '1234'], $h)->assertNoContent();
        $user = User::where('phone', '+221761111110')->firstOrFail();
        $this->assertNotNull($user->deletion_requested_at);

        $this->artisan('accounts:purge')->assertExitCode(0);
        $this->assertDatabaseHas('users', ['id' => $user->id]);

        $login = $this->postJson('/api/v1/auth/login', ['identifier' => $identifier, 'pin' => '1234'])->assertOk();
        $login->assertJsonPath('deletion_cancelled', true);
        $this->assertNull($user->fresh()->deletion_requested_at);
        $this->getJson('/api/v1/auth/me', ['Authorization' => 'Bearer '.$login->json('access_token')])
            ->assertOk()->assertJsonPath('deletion_requested_at', null);
        $this->postJson('/api/v1/auth/login', ['identifier' => $identifier, 'pin' => '1234'])->assertOk()
            ->assertJsonPath('deletion_cancelled', false);

        $user->update(['deletion_requested_at' => now()->subDays(8)]);
        $this->artisan('accounts:purge')->assertExitCode(0);
        $this->assertDatabaseMissing('users', ['id' => $user->id]);
    }

    public function test_public_landing_page_is_served_only_for_a_published_atelier(): void
    {
        $h = $this->registerAtelier('77 111 11 11', 'Atelier Ndiaye');
        $brouillon = Atelier::where('name', 'Atelier Ndiaye')->firstOrFail();
        $this->get("/a/{$brouillon->id}")->assertNotFound();
        $this->get('/a/999999')->assertNotFound();

        $atelier = $this->publishAtelier($h);
        $this->patchJson('/api/v1/mon-atelier', ['phone' => '+221771111111'], $h)->assertOk();

        $this->get("/a/{$atelier->id}")->assertOk()
            ->assertSee('Atelier Ndiaye')
            ->assertSee('Dakar')
            ->assertSee('Homme')
            ->assertSee('tel:+221771111111')
            ->assertSee('https://wa.me/221771111111')
            ->assertSee("gnawalma://atelier/{$atelier->id}", false)
            ->assertSee('Ouvrir dans Gnawalma')
            ->assertSee('Téléchargez l\'application Gnawalma', false);
    }
}
