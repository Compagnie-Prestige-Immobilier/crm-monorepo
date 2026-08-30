<?php

namespace Tests\Feature;

use App\Models\Atelier;
use App\Models\Contact;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuditFixesTest extends TestCase
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

    private function registerClient(string $identifier, string $name = 'Client'): array
    {
        $token = $this->postJson('/api/v1/auth/register', ['name' => $name, 'identifier' => $identifier, 'pin' => '1234', 'role' => 'client'])
            ->assertOk()->json('access_token');
        return ['Authorization' => "Bearer $token"];
    }

    private function createOrder(array $h, int $clientId, array $overrides = []): array
    {
        return $this->postJson('/api/v1/mon-atelier/commandes', $overrides + [
            'client_id' => $clientId, 'measurements' => 'x', 'total_cfa' => 40000, 'due_at' => now()->addWeek()->toIso8601String(),
        ], $h)->assertCreated()->json();
    }

    public function test_order_update_rejects_total_below_payments(): void
    {
        $h = $this->registerAtelier('77 101 01 01', 'Atelier 1');
        $client = $this->postJson('/api/v1/mon-atelier/clients', ['name' => 'Awa'], $h)->json();
        $order = $this->createOrder($h, $client['id'], ['acompte_cfa' => 15000]);

        $base = ['measurements' => 'x', 'due_at' => now()->addWeek()->toIso8601String()];
        $this->patchJson("/api/v1/mon-atelier/commandes/{$order['id']}", $base + ['total_cfa' => 10000], $h)
            ->assertStatus(422)->assertJsonPath('errors.total_cfa.0', 'Le montant ne peut pas être inférieur à ce qui a déjà été payé.');
        $this->assertSame(40000, $this->getJson("/api/v1/mon-atelier/commandes/{$order['id']}", $h)->json('total_cfa'));

        $this->patchJson("/api/v1/mon-atelier/commandes/{$order['id']}", $base + ['total_cfa' => 15000], $h)
            ->assertOk()->assertJsonPath('remaining_cfa', 0);
    }

    public function test_order_status_transitions_are_validated(): void
    {
        $h = $this->registerAtelier('77 202 02 02', 'Atelier 2');
        $client = $this->postJson('/api/v1/mon-atelier/clients', ['name' => 'Awa'], $h)->json();
        $id = $this->createOrder($h, $client['id'])['id'];
        $patch = fn (string $status) => $this->patchJson("/api/v1/mon-atelier/commandes/$id/statut", ['status' => $status], $h);

        $patch('livre')->assertStatus(422)->assertJsonPath('errors.status.0', 'Changement de statut impossible.');
        $patch('en_cours')->assertOk()->assertJsonPath('status', 'en_cours');
        $patch('pret')->assertOk()->assertJsonPath('status', 'pret');
        $patch('livre')->assertOk()->assertJsonPath('status', 'livre');
        $patch('en_cours')->assertStatus(422);
        $patch('pret')->assertOk()->assertJsonPath('status', 'pret');
        $patch('annule')->assertOk()->assertJsonPath('status', 'annule');
        $patch('pret')->assertStatus(422);
        $patch('en_cours')->assertOk()->assertJsonPath('status', 'en_cours');
        $patch('annule')->assertOk()->assertJsonPath('status', 'annule');
    }

    public function test_payment_correction_cannot_drive_total_below_zero(): void
    {
        $h = $this->registerAtelier('77 303 03 03', 'Atelier 3');
        $client = $this->postJson('/api/v1/mon-atelier/clients', ['name' => 'Awa'], $h)->json();
        $id = $this->createOrder($h, $client['id'], ['acompte_cfa' => 15000])['id'];

        $this->postJson("/api/v1/mon-atelier/commandes/$id/paiements", ['amount_cfa' => -20000], $h)
            ->assertStatus(422)->assertJsonPath('errors.amount_cfa.0', 'Correction supérieure aux paiements enregistrés.');
        $this->postJson("/api/v1/mon-atelier/commandes/$id/paiements", ['amount_cfa' => 0], $h)->assertStatus(422);

        $this->postJson("/api/v1/mon-atelier/commandes/$id/paiements", ['amount_cfa' => -5000], $h)
            ->assertCreated()->assertJsonPath('paid_cfa', 10000);
        $this->postJson("/api/v1/mon-atelier/commandes/$id/paiements", ['amount_cfa' => 5000], $h)
            ->assertCreated()->assertJsonPath('paid_cfa', 15000);
    }

    public function test_order_list_filters_by_status_list_sort_and_phone(): void
    {
        $h = $this->registerAtelier('77 404 04 04', 'Atelier 4');
        $awa = $this->postJson('/api/v1/mon-atelier/clients', ['name' => 'Awa', 'phone' => '+221771234567'], $h)->json();
        $bou = $this->postJson('/api/v1/mon-atelier/clients', ['name' => 'Bou'], $h)->json();

        $livre = $this->createOrder($h, $awa['id'], ['due_at' => now()->addDay()->toIso8601String()]);
        $annule = $this->createOrder($h, $bou['id'], ['due_at' => now()->addDays(5)->toIso8601String()]);
        $this->createOrder($h, $bou['id'], ['due_at' => now()->addDays(9)->toIso8601String()]);
        $this->patchJson("/api/v1/mon-atelier/commandes/{$livre['id']}/statut", ['status' => 'pret'], $h)->assertOk();
        $this->patchJson("/api/v1/mon-atelier/commandes/{$livre['id']}/statut", ['status' => 'livre'], $h)->assertOk();
        $this->patchJson("/api/v1/mon-atelier/commandes/{$annule['id']}/statut", ['status' => 'annule'], $h)->assertOk();

        $this->getJson('/api/v1/mon-atelier/commandes?status=livre,annule', $h)->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/v1/mon-atelier/commandes?status=livre', $h)->assertOk()->assertJsonCount(1, 'data');

        $this->getJson('/api/v1/mon-atelier/commandes', $h)->assertOk()->assertJsonPath('data.0.id', $livre['id']);
        $this->getJson('/api/v1/mon-atelier/commandes?sort=desc', $h)->assertOk()->assertJsonPath('data.2.id', $livre['id']);

        $this->getJson('/api/v1/mon-atelier/commandes?q='.urlencode('77 123 45'), $h)->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $livre['id']);
        $this->getJson('/api/v1/mon-atelier/commandes?q=221771234567', $h)->assertOk()->assertJsonCount(1, 'data');
        // Moins de quatre chiffres : pas de recherche par téléphone, sinon tout remonte.
        $this->getJson('/api/v1/mon-atelier/commandes?q=77', $h)->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_contact_is_deduplicated_per_channel_and_day(): void
    {
        $atelier = $this->publishAtelier($this->registerAtelier('77 505 05 05', 'Atelier 5'));
        $ch = $this->registerClient('76 111 11 11', 'Awa');

        $first = $this->postJson("/api/v1/ateliers/{$atelier->id}/contacts", ['channel' => 'request', 'message' => 'Bonjour'], $ch)
            ->assertCreated()->json();
        $this->postJson("/api/v1/ateliers/{$atelier->id}/contacts", ['channel' => 'request', 'message' => 'Rebonjour'], $ch)
            ->assertOk()->assertJsonPath('id', $first['id'])->assertJsonPath('message', 'Bonjour');
        $this->postJson("/api/v1/ateliers/{$atelier->id}/contacts", ['channel' => 'phone'], $ch)->assertCreated();
        $this->assertSame(2, Contact::count());

        Contact::whereKey($first['id'])->update(['created_at' => now()->subDay()]);
        $this->postJson("/api/v1/ateliers/{$atelier->id}/contacts", ['channel' => 'request', 'message' => 'Le lendemain'], $ch)->assertCreated();
        $this->assertSame(3, Contact::count());
    }

    public function test_requests_expose_the_phone_only_when_shared(): void
    {
        $h = $this->registerAtelier('77 606 06 06', 'Atelier 6');
        $atelier = $this->publishAtelier($h);
        $partage = $this->registerClient('76 111 11 11', 'Awa');
        $prive = $this->registerClient('76 222 22 22', 'Bou');

        $this->postJson("/api/v1/ateliers/{$atelier->id}/contacts", ['channel' => 'request', 'message' => 'A', 'share_phone' => true], $partage)->assertCreated();
        $this->postJson("/api/v1/ateliers/{$atelier->id}/contacts", ['channel' => 'request', 'message' => 'B', 'share_phone' => false], $prive)->assertCreated();

        $data = collect($this->getJson('/api/v1/mon-atelier/demandes', $h)->assertOk()->json('data'))->keyBy('message');
        $this->assertSame('+221761111111', $data['A']['user']['phone']);
        $this->assertNull($data['B']['user']['phone']);
        $this->assertSame('Bou', $data['B']['user']['name']);
    }

    public function test_atelier_show_exposes_can_review(): void
    {
        $atelier = $this->publishAtelier($this->registerAtelier('77 707 07 07', 'Atelier 7'));
        $ch = $this->registerClient('76 333 33 33', 'Awa');

        $this->getJson("/api/v1/ateliers/{$atelier->id}")->assertOk()->assertJsonPath('can_review', false);
        $this->getJson("/api/v1/ateliers/{$atelier->id}", $ch)->assertOk()->assertJsonPath('can_review', false);

        $this->postJson("/api/v1/ateliers/{$atelier->id}/contacts", ['channel' => 'phone'], $ch)->assertCreated();
        $this->getJson("/api/v1/ateliers/{$atelier->id}", $ch)->assertOk()->assertJsonPath('can_review', true);
    }

    public function test_my_contacts_exposes_handled_at(): void
    {
        $h = $this->registerAtelier('77 808 08 08', 'Atelier 8');
        $atelier = $this->publishAtelier($h);
        $ch = $this->registerClient('76 444 44 44', 'Awa');

        $contact = $this->postJson("/api/v1/ateliers/{$atelier->id}/contacts", ['channel' => 'request', 'message' => 'Bonjour'], $ch)->assertCreated()->json();
        $this->getJson('/api/v1/mes-contacts', $ch)->assertOk()->assertJsonPath('data.0.handled_at', null);

        $this->patchJson("/api/v1/mon-atelier/demandes/{$contact['id']}", [], $h)->assertOk();
        $this->assertNotNull($this->getJson('/api/v1/mes-contacts', $ch)->assertOk()->json('data.0.handled_at'));
    }
}
