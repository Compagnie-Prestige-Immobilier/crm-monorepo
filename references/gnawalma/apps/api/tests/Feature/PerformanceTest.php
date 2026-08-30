<?php

namespace Tests\Feature;

use App\Models\{Atelier, Promotion, User};
use App\Models\Order;
use App\Support\Media;
use App\Support\Thumbnail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PerformanceTest extends TestCase
{
    use RefreshDatabase;

    private function atelier(string $identifier, array $attributes = []): Atelier
    {
        $user = User::create(['name' => 'Proprio', 'phone' => $identifier, 'password' => bcrypt('1234'), 'role' => 'atelier']);
        return $user->atelier()->create($attributes + ['name' => 'Atelier '.$identifier, 'region' => 'Dakar', 'specialties' => ['homme'], 'wizard_step' => 3, 'completed_at' => now()]);
    }

    public function test_media_upload_writes_a_thumbnail(): void
    {
        $token = $this->postJson('/api/v1/auth/register', ['name' => 'Moussa', 'identifier' => '77 900 00 01', 'pin' => '1234', 'role' => 'atelier'])->json('access_token');

        $res = $this->postJson('/api/v1/media', ['file' => UploadedFile::fake()->image('p.jpg', 3000, 2000), 'kind' => 'portfolio'], ['Authorization' => "Bearer $token"])
            ->assertOk()->json();

        $thumb = Thumbnail::path($res['path']);
        [$w, $h] = getimagesizefromstring(Media::fetch($thumb)['bytes']);
        $this->assertLessThanOrEqual(480, max($w, $h));
        $this->assertSame(url("/m/$thumb"), $res['thumb_url']);
    }

    // Les images d'avant les vignettes n'en ont pas : /m/{path} sert alors l'image pleine.
    public function test_thumb_url_falls_back_to_the_full_image(): void
    {
        Media::put('couverture/legacy.jpg', 'x');
        $atelier = $this->atelier('+221779000002', ['cover_path' => 'couverture/legacy.jpg']);

        $json = $this->getJson("/api/v1/ateliers/{$atelier->id}")->assertOk()->json();
        $this->get($json['cover_thumb_url'])->assertOk()->assertSee('x');
        $this->assertNull($json['logo_thumb_url']);
    }

    public function test_anonymous_atelier_list_is_served_from_cache(): void
    {
        $this->atelier('+221779000003');

        $this->getJson('/api/v1/ateliers')->assertOk();
        DB::enableQueryLog();
        $this->getJson('/api/v1/ateliers')->assertOk()->assertJsonCount(1, 'data');
        $this->assertCount(0, DB::getQueryLog());

        DB::flushQueryLog();
        $this->atelier('+221779000004');
        $this->getJson('/api/v1/ateliers')->assertOk()->assertJsonCount(2, 'data');
        $this->assertNotEmpty(DB::getQueryLog());
    }

    public function test_promotion_update_busts_the_promotions_cache(): void
    {
        $promo = Promotion::create(['title' => 'Avant', 'image_path' => 'promo/a.jpg', 'position' => 0]);
        $this->getJson('/api/v1/promotions')->assertOk()->assertJsonPath('0.title', 'Avant');

        $promo->update(['title' => 'Après']);
        $this->getJson('/api/v1/promotions')->assertOk()->assertJsonPath('0.title', 'Après');
    }

    public function test_completions_are_cached_per_term(): void
    {
        $this->atelier('+221779000005', ['name' => 'Atelier Ndiaye']);

        $this->getJson('/api/v1/ateliers/completions?q=ndia')->assertOk()->assertJsonPath('data.0', 'Atelier Ndiaye');
        DB::enableQueryLog();
        $this->getJson('/api/v1/ateliers/completions?q=NDIA')->assertOk()->assertJsonPath('data.0', 'Atelier Ndiaye');
        $this->assertCount(0, DB::getQueryLog());
    }

    public function test_dashboard_is_bounded_and_keeps_its_totals(): void
    {
        $atelier = $this->atelier('+221779000006');
        $client = $atelier->clients()->create(['name' => 'Awa']);
        $order = fn (string $status, string $due, int $total) => $atelier->orders()->create([
            'client_id' => $client->id, 'reference' => Order::nextReference($atelier->id),
            'measurements' => 'x', 'total_cfa' => $total, 'status' => $status, 'due_at' => $due,
        ]);
        $order('en_cours', now()->subDay(), 10000)->payments()->create(['amount_cfa' => 4000]);
        $order('pret', now()->addDays(3), 20000);
        $order('annule', now()->addDay(), 50000);

        $token = auth('api')->login($atelier->user);
        DB::enableQueryLog();
        $json = $this->getJson('/api/v1/mon-atelier/tableau', ['Authorization' => "Bearer $token"])->assertOk()->json();
        $this->assertLessThanOrEqual(6, count(DB::getQueryLog()));

        $this->assertSame(26000, $json['unpaid_cfa']);
        $this->assertSame(1, $json['overdue_orders']);
        $this->assertSame(2, $json['active_orders']);
        $this->assertSame(0, $json['pending_requests']);
        $this->assertStringStartsWith(now()->addDays(3)->format('Y-m-d'), $json['next_due_at']);
    }
}
