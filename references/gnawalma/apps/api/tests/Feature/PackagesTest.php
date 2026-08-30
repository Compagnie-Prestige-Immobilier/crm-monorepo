<?php

namespace Tests\Feature;

use App\Support\Media;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class PackagesTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_normalizes_local_phone_to_e164(): void
    {
        $this->postJson('/api/v1/auth/register', ['name' => 'Fatou', 'identifier' => '77 987 65 43', 'pin' => '1234', 'role' => 'atelier'])
            ->assertOk()->assertJsonPath('user.phone', '+221779876543');
    }

    public function test_register_rejects_invalid_phone(): void
    {
        $this->postJson('/api/v1/auth/register', ['name' => 'Fatou', 'identifier' => 'not-a-phone', 'pin' => '1234', 'role' => 'atelier'])
            ->assertStatus(422)->assertHeader('Content-Type', 'application/problem+json');
    }

    public function test_atelier_phone_is_normalized_and_validated(): void
    {
        $token = $this->postJson('/api/v1/auth/register', ['name' => 'Moussa', 'identifier' => '77 111 22 33', 'pin' => '1234', 'role' => 'atelier'])->json('access_token');
        $h = ['Authorization' => "Bearer $token"];
        $this->postJson('/api/v1/mon-atelier', ['name' => 'Atelier Moussa', 'phone' => '78 000 11 22'], $h)
            ->assertCreated()->assertJsonPath('phone', '+221780001122');
        $this->patchJson('/api/v1/mon-atelier', ['phone' => 'invalide'], $h)->assertStatus(422);
    }

    public function test_client_phone_is_normalized(): void
    {
        $token = $this->postJson('/api/v1/auth/register', ['name' => 'Moussa', 'identifier' => '77 222 33 44', 'pin' => '1234', 'role' => 'atelier'])->json('access_token');
        $h = ['Authorization' => "Bearer $token"];
        $this->postJson('/api/v1/mon-atelier', ['name' => 'Atelier'], $h)->assertCreated();
        $this->postJson('/api/v1/mon-atelier/clients', ['name' => 'Awa', 'phone' => '76 555 66 77'], $h)
            ->assertCreated()->assertJsonPath('phone', '+221765556677');
    }

    public function test_media_upload_is_resized_and_reencoded(): void
    {
        $token = $this->postJson('/api/v1/auth/register', ['name' => 'Moussa', 'identifier' => '77 333 44 55', 'pin' => '1234', 'role' => 'atelier'])->json('access_token');
        $h = ['Authorization' => "Bearer $token"];

        $file = UploadedFile::fake()->image('portrait.jpg', 3000, 2000);
        $res = $this->postJson('/api/v1/media', ['file' => $file, 'kind' => 'portfolio'], $h)->assertOk()->json();

        $this->assertStringEndsWith('.jpg', $res['path']);
        [$width, $height] = getimagesizefromstring(Media::fetch($res['path'])['bytes']);
        $this->assertLessThanOrEqual(1600, max($width, $height));
    }
}
