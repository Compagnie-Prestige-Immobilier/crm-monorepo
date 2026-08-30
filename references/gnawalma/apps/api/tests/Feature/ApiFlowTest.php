<?php

namespace Tests\Feature;

use App\Models\Atelier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_atelier_flow_end_to_end(): void
    {
        $token = $this->postJson('/api/v1/auth/register', ['name' => 'Moussa Ndiaye', 'identifier' => '77 123 45 67', 'pin' => '1234', 'role' => 'atelier'])
            ->assertOk()->json('access_token');
        $h = ['Authorization' => "Bearer $token"];

        $this->postJson('/api/v1/auth/login', ['identifier' => '+221771234567', 'pin' => '0000'])->assertStatus(422)
            ->assertHeader('Content-Type', 'application/problem+json');

        $this->getJson('/api/v1/mon-atelier', $h)->assertNotFound();
        $this->postJson('/api/v1/mon-atelier', ['name' => 'Atelier Ndiaye'], $h)->assertCreated();
        $this->postJson('/api/v1/mon-atelier/terminer', [], $h)->assertStatus(422);
        $this->patchJson('/api/v1/mon-atelier', ['region' => 'Dakar', 'specialties' => ['homme']], $h)->assertOk();
        $this->postJson('/api/v1/mon-atelier/terminer', [], $h)->assertOk()->assertJsonPath('wizard_step', 3);

        $client = $this->postJson('/api/v1/mon-atelier/clients', ['name' => 'Awa Diop', 'phone' => '+221770000001'], $h)->assertCreated()->json();
        $ben = $this->postJson("/api/v1/mon-atelier/clients/{$client['id']}/beneficiaires", ['label' => 'Elle-même', 'gender' => 'femme', 'measurements' => '48 / 108 / 90'], $h)->assertCreated()->json();

        $order = $this->postJson('/api/v1/mon-atelier/commandes', [
            'client_id' => $client['id'], 'beneficiary_id' => $ben['id'], 'measurements' => '48 / 108 / 90',
            'total_cfa' => 40000, 'acompte_cfa' => 15000, 'due_at' => now()->addWeek()->toIso8601String(),
        ], $h)->assertCreated()->assertJsonPath('paid_cfa', 15000)->assertJsonPath('remaining_cfa', 25000)->json();

        $this->postJson("/api/v1/mon-atelier/commandes/{$order['id']}/paiements", ['amount_cfa' => 25000], $h)->assertCreated()->assertJsonPath('remaining_cfa', 0);
        $this->patchJson("/api/v1/mon-atelier/commandes/{$order['id']}/statut", ['status' => 'pret'], $h)->assertOk()->assertJsonPath('status', 'pret');
        $this->getJson('/api/v1/mon-atelier/tableau', $h)->assertOk()->assertJsonPath('unpaid_cfa', 0)->assertJsonPath('active_orders', 1);
        $this->getJson('/api/v1/mon-atelier/commandes?status=pret', $h)->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_client_marketplace_flow(): void
    {
        $this->seed();
        $this->getJson('/api/v1/ateliers?q=thiès')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/v1/ateliers?specialite=enfant')->assertOk()->assertJsonCount(3, 'data');
        $near = $this->getJson('/api/v1/ateliers?lat=14.67&lng=-17.44&rayon=15')->assertOk()->json('data');
        $this->assertSame('Maison Sarr', $near[0]['name']);
        $ndiaye = Atelier::where('name', 'Atelier Ndiaye Couture')->first();
        $diallo = Atelier::where('name', 'Couture Diallo & Fils')->first();
        $this->getJson("/api/v1/ateliers/{$ndiaye->id}")->assertOk()->assertJsonStructure(['reviews_avg_rating', 'reviews_count', 'photos', 'reviews']);
        $this->getJson('/api/v1/promotions')->assertOk()->assertJsonCount(2);

        $this->postJson("/api/v1/ateliers/{$ndiaye->id}/contacts", ['channel' => 'request', 'message' => 'Bonjour'])->assertUnauthorized();

        $token = $this->postJson('/api/v1/auth/register', ['name' => 'Ousmane', 'identifier' => 'ousmane@example.sn', 'pin' => '5678', 'role' => 'client'])->json('access_token');
        $h = ['Authorization' => "Bearer $token"];
        $this->postJson('/api/v1/avis', ['atelier_id' => $diallo->id, 'rating' => 5], $h)->assertForbidden();
        $this->postJson("/api/v1/ateliers/{$diallo->id}/contacts", ['channel' => 'request', 'message' => 'Bonjour', 'share_phone' => true], $h)->assertCreated();
        $this->postJson('/api/v1/avis', ['atelier_id' => $diallo->id, 'rating' => 5, 'text' => 'Excellent travail'], $h)->assertCreated();
        $this->postJson("/api/v1/mes-favoris/{$diallo->id}", [], $h)->assertNoContent();
        $this->getJson('/api/v1/mes-favoris', $h)->assertOk()->assertJsonCount(1);
        $this->getJson('/api/v1/mes-contacts', $h)->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/mon-atelier', $h)->assertForbidden();

        $owner = $diallo->user;
        $oh = ['Authorization' => 'Bearer '.auth('api')->login($owner)];
        $this->getJson('/api/v1/mon-atelier/demandes', $oh)->assertOk()->assertJsonPath('data.0.message', 'Bonjour')->assertJsonPath('data.0.user.phone', null);
        $this->getJson('/api/v1/mon-atelier/tableau', $oh)->assertOk()->assertJsonPath('pending_requests', 1);
    }

    public function test_search_est_tolerant_aux_fautes_et_accents(): void
    {
        $this->seed();

        $this->getJson('/api/v1/ateliers?q=thies')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/v1/ateliers?q=ndiay')->assertOk()->assertJsonPath('data.0.name', 'Atelier Ndiaye Couture');
        $this->getJson('/api/v1/ateliers?q=adjaa mod')->assertOk()->assertJsonPath('data.0.name', 'Adja Mode');
        $this->getJson('/api/v1/ateliers?q=Randoulène')->assertOk()->assertJsonPath('data.0.name', 'Couture Diallo & Fils');
        $this->getJson('/api/v1/ateliers?q=dial')->assertOk()->assertJsonPath('data.0.name', 'Couture Diallo & Fils');
        $this->getJson('/api/v1/ateliers?q=tailleurs')->assertOk()->assertJsonPath('data.0.name', 'Bintou Tailleur');
        $this->getJson('/api/v1/ateliers?q=Atelier Sow')->assertOk()->assertJsonPath('data.0.name', 'Atelier Sow');
        $this->getJson('/api/v1/ateliers')->assertOk()->assertJsonCount(8, 'data');

        $completions = $this->getJson('/api/v1/ateliers/completions?q=nd')->assertOk()->json('data');
        $this->assertContains('Atelier Ndiaye Couture', $completions);
        $this->assertLessThanOrEqual(6, count($completions));

        $atCompletions = $this->getJson('/api/v1/ateliers/completions?q=at')->assertOk()->json('data');
        $this->assertContains('Atelier Ndiaye Couture', $atCompletions);
        $this->assertContains('Atelier Sow', $atCompletions);

        $dakCompletions = $this->getJson('/api/v1/ateliers/completions?q=dak')->assertOk()->json('data');
        $this->assertContains('Dakar', $dakCompletions);

        $thCompletions = $this->getJson('/api/v1/ateliers/completions?q=th')->assertOk()->json('data');
        $this->assertContains('Thiès', $thCompletions);

        $this->getJson('/api/v1/ateliers/completions')->assertOk()->assertJson(['data' => []]);
    }

    public function test_suppression_du_compte_requiert_le_bon_pin(): void
    {
        $token = $this->postJson('/api/v1/auth/register', ['name' => 'Ousmane', 'identifier' => 'ousmane2@example.sn', 'pin' => '5678', 'role' => 'client'])->json('access_token');
        $h = ['Authorization' => "Bearer $token"];

        $this->deleteJson('/api/v1/auth/me', ['pin' => '0000'], $h)->assertStatus(422)
            ->assertHeader('Content-Type', 'application/problem+json');

        $this->deleteJson('/api/v1/auth/me', ['pin' => '5678'], $h)->assertNoContent();
        $this->getJson('/api/v1/auth/me', $h)->assertUnauthorized();
        // Suppression différée : le compte survit sept jours, la purge s'en charge.
        $this->assertDatabaseHas('users', ['email' => 'ousmane2@example.sn']);
        $this->assertNotNull(User::where('email', 'ousmane2@example.sn')->value('deletion_requested_at'));
    }
}
