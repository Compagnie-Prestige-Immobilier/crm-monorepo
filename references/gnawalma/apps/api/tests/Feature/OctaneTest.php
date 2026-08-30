<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OctaneTest extends TestCase
{
    use RefreshDatabase;

    private function registerAtelier(string $identifier, string $name): array
    {
        $token = $this->postJson('/api/v1/auth/register', ['name' => $name, 'identifier' => $identifier, 'pin' => '1234', 'role' => 'atelier'])
            ->assertOk()->json('access_token');
        $h = ['Authorization' => "Bearer $token"];
        $this->postJson('/api/v1/mon-atelier', ['name' => $name], $h)->assertCreated();

        return $h;
    }

    // Sous Octane le conteneur survit aux requêtes : sans la purge de octane.flush, le
    // jeton gardé en cache par JWT ferait voir à B l'atelier de A.
    public function test_two_tokens_on_the_same_app_instance_see_their_own_atelier(): void
    {
        $ha = $this->registerAtelier('77 811 11 11', 'Atelier A');
        $hb = $this->registerAtelier('77 822 22 22', 'Atelier B');

        $this->getJson('/api/v1/mon-atelier', $ha)->assertOk()->assertJsonPath('name', 'Atelier A');
        $this->getJson('/api/v1/mon-atelier', $hb)->assertOk()->assertJsonPath('name', 'Atelier B');
        $this->getJson('/api/v1/mon-atelier', $ha)->assertOk()->assertJsonPath('name', 'Atelier A');
    }

    // Une requête anonyme après une requête authentifiée ne doit hériter d'aucun jeton.
    public function test_anonymous_request_after_authenticated_one_is_rejected(): void
    {
        $ha = $this->registerAtelier('77 833 33 33', 'Atelier C');

        $this->getJson('/api/v1/mon-atelier', $ha)->assertOk();
        $this->getJson('/api/v1/mon-atelier')->assertUnauthorized();
    }
}
