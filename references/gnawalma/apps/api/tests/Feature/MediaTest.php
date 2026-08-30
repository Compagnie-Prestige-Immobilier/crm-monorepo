<?php

namespace Tests\Feature;

use App\Filament\Resources\Promotions\Pages\CreatePromotion;
use App\Models\Promotion;
use App\Models\User;
use App\Support\Media;
use App\Support\Thumbnail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;
use Tests\TestCase;

class MediaTest extends TestCase
{
    use RefreshDatabase;

    private function upload(string $identifier = '+221779100001'): array
    {
        $token = $this->postJson('/api/v1/auth/register', ['name' => 'Moussa', 'identifier' => $identifier, 'pin' => '1234', 'role' => 'atelier'])->json('access_token');

        return $this->postJson('/api/v1/media', ['file' => UploadedFile::fake()->image('p.jpg', 3000, 2000), 'kind' => 'portfolio'], ['Authorization' => "Bearer $token"])
            ->assertOk()->json();
    }

    public function test_upload_stores_the_image_and_its_thumbnail_in_the_database(): void
    {
        $res = $this->upload();

        $this->assertDatabaseCount('media', 2);
        $this->assertDatabaseHas('media', ['path' => $res['path'], 'mime' => 'image/jpeg']);
        $this->assertDatabaseHas('media', ['path' => Thumbnail::path($res['path'])]);
        $this->assertSame(url('/m/'.$res['path']), $res['url']);
        $this->assertSame(url('/m/'.Thumbnail::path($res['path'])), $res['thumb_url']);

        [$w, $h] = getimagesizefromstring(Media::fetch(Thumbnail::path($res['path']))['bytes']);
        $this->assertLessThanOrEqual(480, max($w, $h));
    }

    public function test_media_route_serves_the_image_with_immutable_cache_headers(): void
    {
        $res = $this->upload();

        $response = $this->get('/m/'.$res['path'])->assertOk();
        $this->assertSame('image/jpeg', $response->headers->get('Content-Type'));
        $this->assertStringContainsString('max-age=31536000', (string) $response->headers->get('Cache-Control'));
        $this->assertStringContainsString('immutable', (string) $response->headers->get('Cache-Control'));
        $this->assertNotEmpty($response->headers->get('ETag'));
        $this->assertNotEmpty($response->getContent());
    }

    public function test_media_route_answers_304_when_the_etag_matches(): void
    {
        $res = $this->upload();

        $etag = $this->get('/m/'.$res['path'])->assertOk()->headers->get('ETag');
        $this->get('/m/'.$res['path'], ['If-None-Match' => $etag])->assertStatus(304);
    }

    public function test_unknown_media_path_is_not_found(): void
    {
        $this->get('/m/portfolio/inconnu.jpg')->assertNotFound();
    }

    public function test_missing_thumbnail_falls_back_to_the_full_image(): void
    {
        Media::put('couverture/legacy.jpg', 'binaire');

        $this->get('/m/'.Thumbnail::path('couverture/legacy.jpg'))->assertOk()->assertSee('binaire');
    }

    public function test_url_accessors_use_the_media_route_and_leave_the_seed_disk_alone(): void
    {
        $user = User::create(['name' => 'Proprio', 'phone' => '+221779100002', 'password' => bcrypt('1234'), 'role' => 'atelier']);
        $atelier = $user->atelier()->create([
            'name' => 'Atelier', 'region' => 'Dakar', 'specialties' => ['homme'], 'wizard_step' => 3, 'completed_at' => now(),
            'logo_path' => 'seed/logo-0.jpg', 'cover_path' => 'couverture/abc.jpg',
        ]);

        $json = $this->getJson("/api/v1/ateliers/{$atelier->id}")->assertOk()->json();
        $this->assertSame(url('/m/seed/logo-0.jpg'), $json['logo_url']);
        $this->assertSame(url('/m/seed/logo-0_thumb.jpg'), $json['logo_thumb_url']);
        $this->assertSame(url('/m/couverture/abc.jpg'), $json['cover_url']);
        $this->assertSame(url('/m/couverture/abc_thumb.jpg'), $json['cover_thumb_url']);
    }

    public function test_deleting_a_portfolio_photo_removes_its_media_rows(): void
    {
        $token = $this->postJson('/api/v1/auth/register', ['name' => 'Moussa', 'identifier' => '+221779100003', 'pin' => '1234', 'role' => 'atelier'])->json('access_token');
        $h = ['Authorization' => "Bearer $token"];
        $this->postJson('/api/v1/mon-atelier', ['name' => 'Atelier'], $h)->assertCreated();

        $res = $this->postJson('/api/v1/media', ['file' => UploadedFile::fake()->image('p.jpg', 800, 800), 'kind' => 'portfolio'], $h)->assertOk()->json();
        $photo = $this->postJson('/api/v1/mon-atelier/portfolio', ['path' => $res['path']], $h)->assertCreated()->json();

        $this->deleteJson("/api/v1/mon-atelier/portfolio/{$photo['id']}", [], $h)->assertNoContent();
        $this->assertDatabaseCount('media', 0);
    }

    public function test_promotion_image_uploaded_from_the_back_office_lands_in_the_database(): void
    {
        Storage::fake('public');
        $admin = User::create(['name' => 'Admin', 'email' => 'admin@lic.sn', 'password' => bcrypt('1234'), 'role' => 'admin']);
        Livewire::actingAs($admin);

        Livewire::test(CreatePromotion::class)
            ->fillForm(['title' => 'Tabaski', 'image_path' => UploadedFile::fake()->image('promo.jpg', 1200, 675), 'position' => 0])
            ->call('create')
            ->assertHasNoFormErrors();

        $promotion = Promotion::firstOrFail();
        $this->assertStringStartsWith(Media::UPLOAD_DIR.'/', $promotion->image_path);
        $this->assertDatabaseHas('media', ['path' => $promotion->image_path]);
        $this->assertDatabaseHas('media', ['path' => Thumbnail::path($promotion->image_path)]);
        $this->assertSame(url('/m/'.$promotion->image_path), $promotion->image_url);
        $this->assertEmpty(Storage::disk('public')->allFiles());
    }

    public function test_replacing_the_cover_forgets_the_previous_media(): void
    {
        $res = $this->upload('+221779100004');
        $atelier = User::where('role', 'atelier')->firstOrFail()->atelier()->create([
            'name' => 'Atelier', 'region' => 'Dakar', 'specialties' => ['homme'], 'wizard_step' => 3, 'cover_path' => $res['path'],
        ]);

        $atelier->update(['cover_path' => 'couverture/autre.jpg']);
        $this->assertDatabaseCount('media', 0);
    }
}
