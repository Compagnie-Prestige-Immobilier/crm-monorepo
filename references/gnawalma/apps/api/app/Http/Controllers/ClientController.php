<?php

namespace App\Http\Controllers;

use App\Models\{Atelier, Beneficiary, Client};
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class ClientController extends Controller
{
    private const FIELDS = ['name' => 'required|string|max:80', 'phone' => 'nullable|phone:SN,INTERNATIONAL', 'address' => 'nullable|string|max:200', 'notes' => 'nullable|string|max:2000'];
    private const BENEFICIARY = ['label' => 'required|string|max:40', 'gender' => 'required|in:homme,femme,enfant', 'measurements' => 'nullable|string|max:2000'];

    public function index(Request $r)
    {
        // Postgres ne résout l'alias last_order_at que seul dans ORDER BY, pas dans une expression : la sous-requête est répétée.
        $q = $this->ownAtelier($r)->clients()->withCount('orders')->withMax('orders as last_order_at', 'created_at')
            ->orderByRaw('coalesce((select max(created_at) from orders where orders.client_id = clients.id), clients.created_at) desc')
            ->orderBy('name');
        if ($term = $r->input('q')) {
            $digits = preg_replace('/\D/', '', $term);
            $q->where(function ($w) use ($term, $digits) {
                $w->where('name', 'ilike', "%$term%");
                if (strlen((string) $digits) >= 4) $w->orWhereRaw("regexp_replace(phone, '\D', '', 'g') like ?", ["%$digits%"]);
            });
        }
        return $q->simplePaginate(30);
    }

    public function merge(Request $r, Client $client, Client $autre): Client
    {
        $this->own($r, $client);
        $this->own($r, $autre);
        abort_if($client->id === $autre->id, 422, 'Choisissez deux fiches différentes.');

        DB::transaction(function () use ($client, $autre) {
            $autre->orders()->update(['client_id' => $client->id]);
            $autre->beneficiaries()->update(['client_id' => $client->id]);
            $autre->delete();
        });
        return $client->refresh();
    }

    public function store(Request $r)
    {
        return $this->ownAtelier($r)->clients()->create($this->normalizePhone($r->validate(self::FIELDS)));
    }

    public function show(Request $r, Client $client)
    {
        $this->own($r, $client);
        $client->load(['beneficiaries', 'orders' => fn ($q) => $q->withSum('payments as paid_cfa', 'amount_cfa')->latest()]);
        $client->total_spent_cfa = (int) $client->orders()->where('status', '!=', 'annule')->join('payments', 'payments.order_id', 'orders.id')->sum('amount_cfa');
        $client->remaining_cfa = (int) $client->orders()->where('status', '!=', 'annule')->sum('total_cfa') - $client->total_spent_cfa;
        return $client;
    }

    public function update(Request $r, Client $client)
    {
        $this->own($r, $client)->update($this->normalizePhone($r->validate(self::FIELDS)));
        return $client;
    }

    public function destroy(Request $r, Client $client): Response
    {
        $this->own($r, $client);
        abort_if($client->orders()->whereIn('status', ['en_cours', 'pret'])->exists(), 422, 'Ce client a des commandes en cours. Livrez-les ou annulez-les d\'abord.');
        $client->delete();
        return response()->noContent();
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

    public function storeBeneficiary(Request $r, Client $client)
    {
        return $this->own($r, $client)->beneficiaries()->create($r->validate(self::BENEFICIARY));
    }

    public function updateBeneficiary(Request $r, Beneficiary $beneficiary)
    {
        $this->own($r, $beneficiary->client)->beneficiaries();
        $beneficiary->update($r->validate(self::BENEFICIARY));
        return $beneficiary;
    }

    public function destroyBeneficiary(Request $r, Beneficiary $beneficiary): Response
    {
        $this->own($r, $beneficiary->client);
        $beneficiary->delete();
        return response()->noContent();
    }

    private function own(Request $r, Client $client): Client
    {
        abort_unless($client->atelier_id === $r->user()->atelier()->value('id'), 404);
        return $client;
    }

    private function ownAtelier(Request $r): Atelier
    {
        return $r->user()->atelier()->first() ?? abort(404, 'Aucun atelier');
    }
}
