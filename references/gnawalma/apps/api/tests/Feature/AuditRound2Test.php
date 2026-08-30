<?php

namespace Tests\Feature;

use App\Filament\Resources\Ateliers\Pages\ListAteliers;
use App\Filament\Resources\Users\Pages\EditUser;
use App\Filament\Resources\Users\Pages\ListUsers;
use App\Models\Atelier;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Filament\Actions\Testing\TestAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Livewire\Livewire;
use Tests\TestCase;

class AuditRound2Test extends TestCase
{
    use RefreshDatabase;

    /** @return array<string, string> */
    private function registerAtelier(string $identifier, string $name = 'Atelier'): array
    {
        $token = $this->postJson('/api/v1/auth/register', ['name' => $name, 'identifier' => $identifier, 'pin' => '1234', 'role' => 'atelier'])
            ->assertOk()->json('access_token');
        $h = ['Authorization' => "Bearer $token"];
        $this->postJson('/api/v1/mon-atelier', ['name' => $name], $h)->assertCreated();
        return $h;
    }

    /** @param  array<string, string>  $h */
    private function publishAtelier(array $h): Atelier
    {
        $this->patchJson('/api/v1/mon-atelier', ['region' => 'Dakar', 'specialties' => ['homme']], $h)->assertOk();
        return Atelier::findOrFail($this->postJson('/api/v1/mon-atelier/terminer', [], $h)->assertOk()->json('id'));
    }

    /** @param  array<string, string>  $h */
    private function createClient(array $h, string $name = 'Awa'): int
    {
        return (int) $this->postJson('/api/v1/mon-atelier/clients', ['name' => $name], $h)->assertCreated()->json('id');
    }

    /**
     * @param  array<string, string>  $h
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function createOrder(array $h, int $clientId, array $overrides = []): array
    {
        return $this->postJson('/api/v1/mon-atelier/commandes', $overrides + [
            'client_id' => $clientId, 'measurements' => 'x', 'total_cfa' => 40000, 'due_at' => now()->addWeek()->toIso8601String(),
        ], $h)->assertCreated()->json();
    }

    public function test_contact_and_review_refuse_the_owner_of_the_atelier(): void
    {
        $h = $this->registerAtelier('77 222 22 01', 'Atelier Propre');
        $atelier = $this->publishAtelier($h);

        $this->postJson("/api/v1/ateliers/{$atelier->id}/contacts", ['channel' => 'phone'], $h)->assertStatus(403);
        $this->postJson('/api/v1/avis', ['atelier_id' => $atelier->id, 'rating' => 5], $h)->assertStatus(403);
        $this->assertSame(0, $atelier->reviews()->count());
    }

    public function test_review_clears_the_text_when_absent(): void
    {
        $h = $this->registerAtelier('77 222 22 02', 'Atelier Avis');
        $atelier = $this->publishAtelier($h);
        $token = $this->postJson('/api/v1/auth/register', ['name' => 'Aminata', 'identifier' => '77 222 22 03', 'pin' => '1234', 'role' => 'client'])
            ->json('access_token');
        $hc = ['Authorization' => "Bearer $token"];

        $this->postJson("/api/v1/ateliers/{$atelier->id}/contacts", ['channel' => 'phone'], $hc)->assertCreated();
        $this->postJson('/api/v1/avis', ['atelier_id' => $atelier->id, 'rating' => 5, 'text' => 'Parfait'], $hc)
            ->assertJsonPath('text', 'Parfait');
        $this->postJson('/api/v1/avis', ['atelier_id' => $atelier->id, 'rating' => 4], $hc)
            ->assertJsonPath('text', null)->assertJsonPath('rating', 4);
    }

    public function test_overdue_is_counted_by_day_not_by_instant(): void
    {
        $this->travelTo(now()->startOfDay()->addHours(20));
        $h = $this->registerAtelier('77 222 22 04', 'Atelier Retard');
        $client = $this->createClient($h);

        $ce_matin = $this->createOrder($h, $client, ['due_at' => now()->startOfDay()->addHours(8)->toIso8601String()]);
        $hier = $this->createOrder($h, $client, ['due_at' => now()->subDay()->toIso8601String()]);

        $ids = array_column($this->getJson('/api/v1/mon-atelier/commandes?en_retard=1', $h)->assertOk()->json('data'), 'id');
        $this->assertSame([$hier['id']], $ids);

        $this->getJson('/api/v1/mon-atelier/tableau', $h)->assertOk()->assertJsonPath('overdue_orders', 1);

        $aujourdhui = array_column($this->getJson('/api/v1/mon-atelier/commandes?echeance=aujourdhui', $h)->assertOk()->json('data'), 'id');
        $this->assertSame([$ce_matin['id']], $aujourdhui);
    }

    public function test_en_retard_ignores_delivered_and_cancelled_orders(): void
    {
        $h = $this->registerAtelier('77 222 22 05', 'Atelier Retard 2');
        $client = $this->createClient($h);
        $hier = now()->subDays(2)->toIso8601String();

        $ouverte = $this->createOrder($h, $client, ['due_at' => $hier]);
        $annulee = $this->createOrder($h, $client, ['due_at' => $hier]);
        $livree = $this->createOrder($h, $client, ['due_at' => $hier]);
        $this->patchJson("/api/v1/mon-atelier/commandes/{$annulee['id']}/statut", ['status' => 'annule'], $h)->assertOk();
        $this->patchJson("/api/v1/mon-atelier/commandes/{$livree['id']}/statut", ['status' => 'pret'], $h)->assertOk();
        $this->patchJson("/api/v1/mon-atelier/commandes/{$livree['id']}/statut", ['status' => 'livre'], $h)->assertOk();

        $ids = array_column($this->getJson('/api/v1/mon-atelier/commandes?en_retard=1', $h)->assertOk()->json('data'), 'id');
        $this->assertSame([$ouverte['id']], $ids);
    }

    public function test_impayees_excludes_cancelled_orders(): void
    {
        $h = $this->registerAtelier('77 222 22 06', 'Atelier Impayees');
        $client = $this->createClient($h);
        $ouverte = $this->createOrder($h, $client);
        $annulee = $this->createOrder($h, $client);
        $soldee = $this->createOrder($h, $client);
        $this->patchJson("/api/v1/mon-atelier/commandes/{$annulee['id']}/statut", ['status' => 'annule'], $h)->assertOk();
        $this->postJson("/api/v1/mon-atelier/commandes/{$soldee['id']}/paiements", ['amount_cfa' => 40000], $h)->assertCreated();

        $ids = array_column($this->getJson('/api/v1/mon-atelier/commandes?impayees=1', $h)->assertOk()->json('data'), 'id');
        $this->assertSame([$ouverte['id']], $ids);
    }

    public function test_order_creation_is_idempotent_per_client_token(): void
    {
        $h = $this->registerAtelier('77 222 22 07', 'Atelier Jeton');
        $client = $this->createClient($h);

        $first = $this->postJson('/api/v1/mon-atelier/commandes', [
            'client_id' => $client, 'measurements' => 'x', 'total_cfa' => 40000,
            'due_at' => now()->addWeek()->toIso8601String(), 'client_token' => 'abc-123', 'acompte_cfa' => 5000,
        ], $h)->assertCreated()->json();

        $second = $this->postJson('/api/v1/mon-atelier/commandes', [
            'client_id' => $client, 'measurements' => 'x', 'total_cfa' => 40000,
            'due_at' => now()->addWeek()->toIso8601String(), 'client_token' => 'abc-123', 'acompte_cfa' => 5000,
        ], $h)->assertOk()->json();

        $this->assertSame($first['id'], $second['id']);
        $this->assertSame(1, Order::count());
        $this->assertSame(1, Payment::count());
    }

    public function test_payment_is_idempotent_per_client_token(): void
    {
        $h = $this->registerAtelier('77 222 22 08', 'Atelier Jeton 2');
        $order = $this->createOrder($h, $this->createClient($h));

        $this->postJson("/api/v1/mon-atelier/commandes/{$order['id']}/paiements", ['amount_cfa' => 10000, 'client_token' => 'p-1'], $h)
            ->assertCreated();
        $this->postJson("/api/v1/mon-atelier/commandes/{$order['id']}/paiements", ['amount_cfa' => 10000, 'client_token' => 'p-1'], $h)
            ->assertOk()->assertJsonCount(1, 'payments');
        $this->assertSame(1, Payment::count());
        $this->assertSame(10000, (int) Payment::sum('amount_cfa'));
    }

    public function test_payments_are_ordered_by_date_then_id_and_corrections_cannot_be_corrected(): void
    {
        $h = $this->registerAtelier('77 222 22 09', 'Atelier Paiements');
        $order = $this->createOrder($h, $this->createClient($h));
        $url = "/api/v1/mon-atelier/commandes/{$order['id']}/paiements";

        $p1 = (int) $this->postJson($url, ['amount_cfa' => 10000], $h)->assertCreated()->json('payments.0.id');
        Payment::whereKey($p1)->update(['created_at' => now()->subDay()]);
        $this->postJson($url, ['amount_cfa' => 5000], $h)->assertCreated();
        $correction = $this->postJson($url, ['amount_cfa' => -5000, 'correction_of' => $p1], $h)->assertCreated()->json('payments');

        $this->assertSame([10000, 5000, -5000], array_column($correction, 'amount_cfa'));
        $this->assertSame($p1, $correction[2]['correction_of']);

        $this->postJson($url, ['amount_cfa' => 5000, 'correction_of' => $correction[2]['id']], $h)
            ->assertStatus(422)->assertJsonPath('errors.correction_of.0', 'Une correction ne peut pas être corrigée.');

        $autre = $this->createOrder($h, $this->createClient($h, 'Bou'));
        $this->postJson("/api/v1/mon-atelier/commandes/{$autre['id']}/paiements", ['amount_cfa' => -1000, 'correction_of' => $p1], $h)
            ->assertStatus(404);
    }

    public function test_delivered_at_is_stamped_and_drives_the_month_totals(): void
    {
        $h = $this->registerAtelier('77 222 22 10', 'Atelier Livraison');
        $order = $this->createOrder($h, $this->createClient($h));
        $this->postJson("/api/v1/mon-atelier/commandes/{$order['id']}/paiements", ['amount_cfa' => 20000], $h)->assertCreated();

        $this->getJson('/api/v1/mon-atelier/tableau', $h)->assertOk()
            ->assertJsonPath('delivered_month', 0)->assertJsonPath('paid_month_cfa', 0);

        $this->patchJson("/api/v1/mon-atelier/commandes/{$order['id']}/statut", ['status' => 'pret'], $h)->assertOk();
        $this->patchJson("/api/v1/mon-atelier/commandes/{$order['id']}/statut", ['status' => 'livre'], $h)->assertOk();
        $this->assertNotNull($this->getJson("/api/v1/mon-atelier/commandes/{$order['id']}", $h)->assertOk()->json('delivered_at'));

        $this->getJson('/api/v1/mon-atelier/tableau', $h)->assertOk()
            ->assertJsonPath('delivered_month', 1)->assertJsonPath('paid_month_cfa', 20000);

        $this->patchJson("/api/v1/mon-atelier/commandes/{$order['id']}/statut", ['status' => 'pret'], $h)->assertOk();
        $this->assertNull($this->getJson("/api/v1/mon-atelier/commandes/{$order['id']}", $h)->assertOk()->json('delivered_at'));
        $this->getJson('/api/v1/mon-atelier/tableau', $h)->assertOk()->assertJsonPath('delivered_month', 0);
    }

    public function test_total_is_optional_until_delivery_and_changes_are_journalled(): void
    {
        $h = $this->registerAtelier('77 222 22 11', 'Atelier Montant');
        $client = $this->createClient($h);

        $order = $this->postJson('/api/v1/mon-atelier/commandes', [
            'client_id' => $client, 'measurements' => 'x', 'due_at' => now()->addWeek()->toIso8601String(),
        ], $h)->assertCreated()->json();
        $this->assertNull($order['total_cfa']);
        $this->assertNull($order['remaining_cfa']);

        $this->patchJson("/api/v1/mon-atelier/commandes/{$order['id']}/statut", ['status' => 'pret'], $h)->assertOk();
        $this->patchJson("/api/v1/mon-atelier/commandes/{$order['id']}/statut", ['status' => 'livre'], $h)
            ->assertStatus(422)->assertJsonPath('errors.total_cfa.0', 'Indiquez le montant avant de livrer.');

        $patch = ['measurements' => 'x', 'due_at' => now()->addWeek()->toIso8601String()];
        $this->patchJson("/api/v1/mon-atelier/commandes/{$order['id']}", $patch + ['total_cfa' => 30000], $h)->assertOk();
        $this->patchJson("/api/v1/mon-atelier/commandes/{$order['id']}", $patch + ['total_cfa' => 45000], $h)->assertOk();

        $body = $this->getJson("/api/v1/mon-atelier/commandes/{$order['id']}", $h)->assertOk()->json();
        $this->assertSame([[null, 30000], [30000, 45000]], array_map(fn (array $e) => [$e['from'], $e['to']], $body['total_history']));
        $this->assertNotEmpty($body['total_history'][0]['at']);
        $this->assertSame(45000, $body['remaining_cfa']);

        $this->patchJson("/api/v1/mon-atelier/commandes/{$order['id']}/statut", ['status' => 'livre'], $h)->assertOk();
    }

    public function test_login_is_throttled_by_identifier_across_ip_addresses(): void
    {
        $this->postJson('/api/v1/auth/register', ['name' => 'Aminata', 'identifier' => '77 222 22 12', 'pin' => '1234', 'role' => 'client'])->assertOk();

        foreach (range(1, 5) as $i) {
            $this->withServerVariables(['REMOTE_ADDR' => "10.0.0.$i"])
                ->postJson('/api/v1/auth/login', ['identifier' => '77 222 22 12', 'pin' => '9999'])->assertStatus(422);
        }
        $this->assertSame(5, (int) User::where('phone', '+221772222212')->value('failed_logins'));

        $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.99'])
            ->postJson('/api/v1/auth/login', ['identifier' => '77 222 22 12', 'pin' => '1234'])->assertStatus(429);
    }

    public function test_failed_login_counter_is_reset_on_success(): void
    {
        $this->postJson('/api/v1/auth/register', ['name' => 'Aminata', 'identifier' => '77 222 22 13', 'pin' => '1234', 'role' => 'client'])->assertOk();
        $this->postJson('/api/v1/auth/login', ['identifier' => '77 222 22 13', 'pin' => '9999'])->assertStatus(422);
        $this->assertSame(1, (int) User::where('phone', '+221772222213')->value('failed_logins'));

        $this->postJson('/api/v1/auth/login', ['identifier' => '77 222 22 13', 'pin' => '1234'])->assertOk();
        $this->assertSame(0, (int) User::where('phone', '+221772222213')->value('failed_logins'));
    }

    public function test_clients_are_paginated_and_searchable_by_phone(): void
    {
        $h = $this->registerAtelier('77 222 22 14', 'Atelier Clients');
        foreach (range(1, 31) as $i) {
            $this->postJson('/api/v1/mon-atelier/clients', ['name' => "Client $i"], $h)->assertCreated();
        }
        $this->postJson('/api/v1/mon-atelier/clients', ['name' => 'Awa', 'phone' => '77 123 45 67'], $h)->assertCreated();

        $page = $this->getJson('/api/v1/mon-atelier/clients', $h)->assertOk()->json();
        $this->assertCount(30, $page['data']);
        $this->assertNotNull($page['next_page_url']);
        $this->assertCount(2, $this->getJson('/api/v1/mon-atelier/clients?page=2', $h)->assertOk()->json('data'));

        $found = $this->getJson('/api/v1/mon-atelier/clients?q='.urlencode('77 123 45'), $h)->assertOk()->json('data');
        $this->assertSame(['Awa'], array_column($found, 'name'));
    }

    public function test_two_client_files_can_be_merged(): void
    {
        $h = $this->registerAtelier('77 222 22 15', 'Atelier Fusion');
        $garde = $this->createClient($h, 'Awa Diop');
        $doublon = $this->createClient($h, 'Awa D.');
        $order = $this->createOrder($h, $doublon);
        $ben = $this->postJson("/api/v1/mon-atelier/clients/$doublon/beneficiaires", ['label' => 'Son fils', 'gender' => 'enfant'], $h)
            ->assertCreated()->json();

        $this->postJson("/api/v1/mon-atelier/clients/$garde/fusionner/$doublon", [], $h)
            ->assertOk()->assertJsonPath('id', $garde);

        $this->getJson("/api/v1/mon-atelier/clients/$doublon", $h)->assertStatus(404);
        $fiche = $this->getJson("/api/v1/mon-atelier/clients/$garde", $h)->assertOk()->json();
        $this->assertSame([$order['id']], array_column($fiche['orders'], 'id'));
        $this->assertSame([$ben['id']], array_column($fiche['beneficiaries'], 'id'));

        $this->postJson("/api/v1/mon-atelier/clients/$garde/fusionner/$garde", [], $h)->assertStatus(422);
    }

    public function test_merge_refuses_a_client_of_another_atelier(): void
    {
        $ha = $this->registerAtelier('77 222 22 16', 'Atelier A');
        $hb = $this->registerAtelier('77 222 22 17', 'Atelier B');
        $mien = $this->createClient($ha);
        $sien = $this->createClient($hb);

        $this->postJson("/api/v1/mon-atelier/clients/$mien/fusionner/$sien", [], $ha)->assertStatus(404);
    }

    public function test_verification_note_is_visible_to_the_owner_only(): void
    {
        $h = $this->registerAtelier('77 222 22 18', 'Atelier Note');
        $atelier = $this->publishAtelier($h);
        $atelier->update(['verified_at' => null, 'verification_note' => 'Envoyez une photo du registre.']);

        $this->getJson('/api/v1/mon-atelier', $h)->assertOk()
            ->assertJsonPath('verification_note', 'Envoyez une photo du registre.');
        $this->getJson('/api/v1/auth/me', $h)->assertOk()
            ->assertJsonPath('atelier.verification_note', 'Envoyez une photo du registre.');
        $this->getJson("/api/v1/ateliers/{$atelier->id}")->assertOk()->assertJsonMissingPath('verification_note');
    }

    public function test_health_returns_the_minimum_app_version_without_touching_the_database(): void
    {
        $queries = 0;
        DB::listen(function () use (&$queries) { $queries++; });

        $this->getJson('/api/v1/health')->assertOk()
            ->assertJsonPath('status', 'up')
            ->assertJsonPath('min_version', config('app.min_version'));

        $this->assertSame(0, $queries);
        $this->assertSame('2.0.0', config('app.min_version'));
    }

    private function admin(): User
    {
        return User::create(['name' => 'Administration', 'email' => 'admin@lic.sn', 'password' => Hash::make('1234'), 'role' => 'admin']);
    }

    public function test_admin_verifies_an_atelier_with_a_note(): void
    {
        $h = $this->registerAtelier('77 222 22 19', 'Atelier Filament');
        $atelier = $this->publishAtelier($h);

        Livewire::actingAs($this->admin());
        Livewire::test(ListAteliers::class)
            ->callAction(TestAction::make('verifier')->table($atelier), ['verification_note' => 'Registre reçu, merci.'])
            ->assertHasNoErrors();

        $atelier->refresh();
        $this->assertNotNull($atelier->verified_at);
        $this->assertSame('Registre reçu, merci.', $atelier->verification_note);
    }

    public function test_admin_changes_the_identifier_of_a_user(): void
    {
        $this->postJson('/api/v1/auth/register', ['name' => 'Aminata', 'identifier' => '77 222 22 20', 'pin' => '1234', 'role' => 'client'])->assertOk();
        $user = User::where('phone', '+221772222220')->firstOrFail();
        $autre = User::create(['name' => 'Moussa', 'phone' => '+221770000001', 'password' => Hash::make('1234'), 'role' => 'client']);

        Livewire::actingAs($this->admin());
        Livewire::test(EditUser::class, ['record' => $user->getRouteKey()])
            ->fillForm(['name' => 'Aminata Fall', 'phone' => '77 999 88 77'])
            ->call('save')
            ->assertHasNoFormErrors();

        $user->refresh();
        $this->assertSame('Aminata Fall', $user->name);
        $this->assertSame('+221779998877', $user->phone);

        Livewire::test(EditUser::class, ['record' => $user->getRouteKey()])
            ->fillForm(['phone' => $autre->phone])
            ->call('save')
            ->assertHasFormErrors(['phone']);
    }

    public function test_admin_exports_the_tables_as_csv(): void
    {
        $h = $this->registerAtelier('77 222 22 21', 'Atelier Export');
        $this->publishAtelier($h);

        Livewire::actingAs($this->admin());
        Livewire::test(ListUsers::class)->callAction(TestAction::make('exporter')->table())->assertFileDownloaded();
        Livewire::test(ListAteliers::class)->callAction(TestAction::make('exporter')->table())->assertFileDownloaded();
    }

    public function test_legal_pages_are_served_in_french(): void
    {
        $this->get('/conditions')->assertOk()->assertSee('Gnawalma met en relation des clients et des ateliers de couture.');
        $this->get('/confidentialite')->assertOk()->assertSee('Ces données ne sont pas revendues à des tiers.');
    }
}
