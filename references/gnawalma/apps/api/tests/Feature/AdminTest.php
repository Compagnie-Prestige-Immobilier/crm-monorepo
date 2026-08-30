<?php

namespace Tests\Feature;

use App\Filament\Resources\Ateliers\Pages\ListAteliers;
use App\Filament\Resources\Ateliers\Pages\ViewAtelier;
use App\Filament\Resources\Promotions\Pages\ListPromotions;
use App\Filament\Resources\Reports\Pages\ListReports;
use App\Filament\Resources\Reviews\Pages\ListReviews;
use App\Filament\Resources\Users\Pages\ListUsers;
use App\Filament\Widgets\AteliersAVerifier;
use App\Filament\Widgets\ContactsParJour;
use App\Filament\Widgets\StatsGlobales;
use App\Models\Atelier;
use App\Models\Report;
use App\Models\Review;
use App\Models\User;
use Filament\Actions\Testing\TestAction;
use Filament\Auth\Pages\Login;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Livewire\Livewire;
use Tests\TestCase;

class AdminTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    private function admin(): User
    {
        return User::where('email', 'admin@lic.sn')->firstOrFail();
    }

    public function test_admin_se_connecte_et_voit_le_tableau_de_bord(): void
    {
        $this->get('/admin/login')->assertOk();

        Livewire::test(Login::class)
            ->fillForm(['email' => 'admin@lic.sn', 'password' => '1234'])
            ->call('authenticate')
            ->assertHasNoFormErrors();

        $this->assertAuthenticatedAs($this->admin());
        $this->actingAs($this->admin())->get('/admin')->assertOk();

        Livewire::actingAs($this->admin());
        Livewire::test(StatsGlobales::class)->assertSuccessful();
        Livewire::test(ContactsParJour::class)->assertSuccessful();
        Livewire::test(AteliersAVerifier::class)->assertSuccessful();
    }

    public function test_les_ecrans_du_back_office_s_affichent(): void
    {
        Livewire::actingAs($this->admin());

        foreach ([ListAteliers::class, ListPromotions::class, ListReviews::class, ListReports::class, ListUsers::class] as $page) {
            Livewire::test($page)->assertSuccessful();
        }

        $atelier = Atelier::whereNotNull('completed_at')->firstOrFail();
        $atelier->update(['registre_commerce_path' => 'registre/demo.jpg']);
        Livewire::test(ViewAtelier::class, ['record' => $atelier->getRouteKey()])
            ->assertSuccessful()->assertSee('Lun-Sam, 9h-19h');
    }

    public function test_un_client_ne_peut_pas_ouvrir_l_admin(): void
    {
        $client = User::where('role', 'client')->firstOrFail();

        // Le TestCase du projet oublie les guards à chaque requête : la session porte l'authentification.
        $this->withSession([Auth::guard('web')->getName() => $client->id])->get('/admin')->assertForbidden();
    }

    public function test_action_verifier_pose_la_date_de_verification(): void
    {
        $atelier = Atelier::whereNotNull('completed_at')->whereNull('verified_at')->firstOrFail();

        Livewire::actingAs($this->admin());
        Livewire::test(ListAteliers::class)
            ->callAction(TestAction::make('verifier')->table($atelier))
            ->assertHasNoErrors();

        $this->assertNotNull($atelier->refresh()->verified_at);
    }

    public function test_action_masquer_change_le_statut_de_l_avis(): void
    {
        $review = Review::where('status', 'published')->firstOrFail();

        Livewire::actingAs($this->admin());
        Livewire::test(ListReviews::class)
            ->callAction(TestAction::make('masquer')->table($review))
            ->assertHasNoErrors();

        $this->assertSame('hidden', $review->refresh()->status);
    }

    public function test_action_resoudre_cloture_le_signalement(): void
    {
        $report = Report::whereNull('resolved_at')->firstOrFail();

        Livewire::actingAs($this->admin());
        Livewire::test(ListReports::class)
            ->callAction(TestAction::make('resoudre')->table($report), ['resolution' => 'Atelier contacté, photos retirées.'])
            ->assertHasNoErrors();

        $report->refresh();
        $this->assertNotNull($report->resolved_at);
        $this->assertSame('Atelier contacté, photos retirées.', $report->resolution);
    }
}
