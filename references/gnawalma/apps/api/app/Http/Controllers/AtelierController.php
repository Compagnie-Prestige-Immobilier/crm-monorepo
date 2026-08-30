<?php

namespace App\Http\Controllers;

use App\Models\{Atelier, Contact, PortfolioPhoto};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AtelierController extends Controller
{
    // Chef-lieu de chaque région : position de repli quand le GPS a été refusé.
    private const REGIONS = [
        'Dakar' => [14.6928, -17.4467], 'Diourbel' => [14.6522, -16.2314], 'Fatick' => [14.3390, -16.4110], 'Kaffrine' => [14.1059, -15.5508],
        'Kaolack' => [14.1520, -16.0730], 'Kédougou' => [12.5556, -12.1747], 'Kolda' => [12.8939, -14.9410], 'Louga' => [15.6144, -16.2264],
        'Matam' => [15.6559, -13.2548], 'Saint-Louis' => [16.0179, -16.4896], 'Sédhiou' => [12.7081, -15.5569], 'Tambacounda' => [13.7707, -13.6673],
        'Thiès' => [14.7910, -16.9260], 'Ziguinchor' => [12.5833, -16.2719],
    ];

    private const FIELDS = [
        'name' => 'string|max:80', 'description' => 'nullable|string|max:2000', 'phone' => 'nullable|phone:SN,INTERNATIONAL',
        'region' => 'nullable|in:Dakar,Diourbel,Fatick,Kaffrine,Kaolack,Kédougou,Kolda,Louga,Matam,Saint-Louis,Sédhiou,Tambacounda,Thiès,Ziguinchor',
        'address' => 'nullable|string|max:200', 'registre_commerce' => 'nullable|string|max:60', 'registre_commerce_path' => 'nullable|string',
        'hours' => 'nullable|string|max:120', 'price_from' => 'nullable|integer|min:0',
        'latitude' => 'nullable|numeric', 'longitude' => 'nullable|numeric', 'specialties' => 'array', 'specialties.*' => 'in:homme,femme,enfant',
        'logo_path' => 'nullable|string', 'cover_path' => 'nullable|string', 'tiktok' => 'nullable|string', 'instagram' => 'nullable|string',
        'facebook' => 'nullable|string', 'wizard_step' => 'integer|between:1,3',
    ];

    public function show(Request $r)
    {
        $atelier = $r->user()->atelier()->with('photos')->first() ?? abort(404, 'Aucun atelier');
        return $atelier->makeVisible('verification_note');
    }

    public function store(Request $r)
    {
        abort_if($r->user()->atelier()->exists(), 409, 'Atelier déjà créé');
        return $r->user()->atelier()->create($this->normalizePhone($r->validate(['name' => 'required|string|max:80'] + self::FIELDS)));
    }

    public function update(Request $r)
    {
        $atelier = $this->own($r);
        $data = $this->normalizePhone($r->validate(self::FIELDS));
        $atelier->update($data);

        // Le centroïde n'est jamais recalculé si le GPS est déjà connu : on ne veut
        // pas écraser une position précise par le chef-lieu de la nouvelle région.
        if (isset(self::REGIONS[$data['region'] ?? '']) && $atelier->completed_at && $atelier->latitude === null && $atelier->longitude === null) {
            [$lat, $lng] = self::REGIONS[$atelier->region];
            $atelier->update(['latitude' => $lat, 'longitude' => $lng]);
        }
        return $atelier->load('photos');
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalizePhone(array $data): array
    {
        if (! empty($data['phone'])) $data['phone'] = phone($data['phone'], 'SN')->formatE164();
        return $data;
    }

    public function complete(Request $r)
    {
        $atelier = $this->own($r);
        validator($atelier->toArray(), ['name' => 'required', 'region' => 'required|in:'.implode(',', array_keys(self::REGIONS)), 'specialties' => 'required|array|min:1'])->validate();
        [$lat, $lng] = self::REGIONS[$atelier->region];
        $atelier->update(['completed_at' => now(), 'wizard_step' => 3, 'latitude' => $atelier->latitude ?? $lat, 'longitude' => $atelier->longitude ?? $lng]);
        return $atelier;
    }

    public function dashboard(Request $r)
    {
        $atelier = $this->own($r);
        $now = now();
        $today = $now->copy()->startOfDay();
        $month = $now->copy()->startOfMonth();
        $active = "status in ('en_cours', 'pret')";

        // Un seul balayage de l'index (atelier_id, status, due_at) pour les quatre agrégats.
        // Le retard se compte en jours, comme la liste des commandes (en_retard=1).
        $totals = DB::table('orders')->where('atelier_id', $atelier->id)->selectRaw(
            "coalesce(sum(total_cfa) filter (where status <> 'annule'), 0) as open_total,
             count(*) filter (where $active and due_at < ?) as overdue_orders,
             count(*) filter (where $active) as active_orders,
             count(*) filter (where status = 'en_cours') as en_cours_orders,
             count(*) filter (where status = 'pret') as pret_orders,
             count(*) filter (where delivered_at >= ?) as delivered_month,
             min(due_at) filter (where $active and due_at >= ?) as next_due_at",
            [$today, $month, $now]
        )->first();

        $paid = DB::table('payments')->whereIn('order_id', fn ($q) => $q->from('orders')
            ->select('id')->where('atelier_id', $atelier->id)->where('status', '!=', 'annule'))->sum('amount_cfa');
        $paidMonth = DB::table('payments')->whereIn('order_id', fn ($q) => $q->from('orders')
            ->select('id')->where('atelier_id', $atelier->id)->where('delivered_at', '>=', $month))->sum('amount_cfa');

        return [
            'unpaid_cfa' => (int) $totals->open_total - (int) $paid,
            'overdue_orders' => (int) $totals->overdue_orders,
            'active_orders' => (int) $totals->active_orders,
            'en_cours_orders' => (int) $totals->en_cours_orders,
            'pret_orders' => (int) $totals->pret_orders,
            'delivered_month' => (int) $totals->delivered_month,
            'paid_month_cfa' => (int) $paidMonth,
            'next_due_at' => $totals->next_due_at,
            'pending_requests' => $atelier->contacts()->where('channel', 'request')->whereNull('handled_at')->count(),
        ];
    }

    public function requests(Request $r)
    {
        $page = $this->own($r)->contacts()->where('channel', 'request')->with('user:id,name,phone')->latest()->simplePaginate($this->limit($r));
        // Numéro visible seulement si partagé ; l'instance User est commune à toutes ses demandes, d'où la copie.
        $page->getCollection()->each(function (Contact $c) {
            if (! $c->share_phone && $c->user) $c->setRelation('user', (clone $c->user)->setAttribute('phone', null));
        });
        return $page;
    }

    public function handleRequest(Request $r, Contact $contact)
    {
        abort_unless($contact->atelier_id === $this->own($r)->id, 404);
        $contact->update(['handled_at' => now()]);
        return $contact;
    }

    public function addPhoto(Request $r)
    {
        $atelier = $this->own($r);
        $data = $r->validate(['path' => 'required|string']);
        return $atelier->photos()->create($data + ['position' => $atelier->photos()->count()]);
    }

    public function reorderPhotos(Request $r)
    {
        $atelier = $this->own($r);
        foreach ($r->validate(['ids' => 'required|array'])['ids'] as $i => $id) {
            $atelier->photos()->where('id', $id)->update(['position' => $i]);
        }
        return $atelier->photos()->get();
    }

    public function removePhoto(Request $r, PortfolioPhoto $photo)
    {
        abort_unless($photo->atelier_id === $this->own($r)->id, 404);
        $photo->delete();
        return response()->noContent();
    }

    private function own(Request $r): Atelier
    {
        $atelier = $r->user()->atelier()->first() ?? abort(404, 'Aucun atelier');
        return $atelier->makeVisible('verification_note');
    }
}
