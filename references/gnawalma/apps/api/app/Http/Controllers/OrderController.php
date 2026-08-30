<?php

namespace App\Http\Controllers;

use App\Models\{Atelier, Beneficiary, Order};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderController extends Controller
{
    private const FIELDS = [
        'beneficiary_id' => 'nullable|integer', 'measurements' => 'required|string|max:2000', 'description' => 'nullable|string|max:2000',
        'fabric_photo_path' => 'nullable|string', 'measurements_photo_path' => 'nullable|string', 'voice_note_path' => 'nullable|string',
        'total_cfa' => 'nullable|integer|min:0', 'due_at' => 'required|date',
    ];

    private const TRANSITIONS = ['en_cours' => ['pret'], 'pret' => ['livre', 'en_cours'], 'livre' => ['pret'], 'annule' => ['en_cours']];

    private const OPEN = "status in ('en_cours', 'pret')";

    public function index(Request $r)
    {
        $q = $this->ownAtelier($r)->orders()->withSum('payments as paid_cfa', 'amount_cfa')->with('client:id,name,phone', 'beneficiary:id,label,client_id,gender')
            ->orderBy('due_at', $r->input('sort') === 'desc' ? 'desc' : 'asc');
        if ($status = $r->input('status')) $q->whereIn('status', explode(',', $status));
        if ($r->boolean('impayees')) {
            $q->where('status', '!=', 'annule')
                ->whereRaw('total_cfa > (select coalesce(sum(amount_cfa),0) from payments where order_id = orders.id)');
        }
        // Le retard se compte en jours : une échéance d'aujourd'hui n'est jamais en retard.
        $today = now()->startOfDay();
        if ($r->boolean('en_retard')) $q->whereRaw(self::OPEN)->where('due_at', '<', $today);
        if ($r->input('echeance') === 'aujourdhui') {
            $q->whereRaw(self::OPEN)->where('due_at', '>=', $today)->where('due_at', '<', $today->copy()->addDay());
        }
        if ($term = $r->input('q')) {
            $digits = preg_replace('/\D/', '', $term);
            $q->where(function ($w) use ($term, $digits) {
                $w->whereHas('client', fn ($c) => $c->where('name', 'ilike', "%$term%"))->orWhere('reference', 'ilike', "%$term%");
                // Un numéro saisi avec des espaces ou un indicatif doit retrouver le client.
                if (strlen((string) $digits) >= 4) {
                    $w->orWhereHas('client', fn ($c) => $c->whereRaw("regexp_replace(phone, '\D', '', 'g') like ?", ["%$digits%"]));
                }
            });
        }
        return $q->simplePaginate($this->limit($r));
    }

    public function store(Request $r)
    {
        $atelier = $this->ownAtelier($r);
        $data = $r->validate(['client_id' => 'required|integer', 'acompte_cfa' => 'nullable|integer|min:0', 'client_token' => 'nullable|string|max:64'] + self::FIELDS);
        $client = $atelier->clients()->findOrFail($data['client_id']);
        if ($data['beneficiary_id'] ?? null) $client->beneficiaries()->findOrFail($data['beneficiary_id']);

        // Idempotence : un renvoi après coupure réseau retrouve la commande au lieu d'en créer une seconde.
        $token = $data['client_token'] ?? null;
        if ($token !== null && $existing = $atelier->orders()->where('client_token', $token)->first()) {
            return $existing->load('client:id,name', 'payments');
        }

        $acompte = $data['acompte_cfa'] ?? 0;
        unset($data['acompte_cfa']);
        $order = DB::transaction(function () use ($atelier, $data, $acompte) {
            $order = $atelier->orders()->create($data + ['reference' => Order::nextReference($atelier->id)]);
            if ($acompte > 0) $order->payments()->create(['amount_cfa' => $acompte]);
            return $order;
        });
        // Relu depuis la base : la réponse porte toutes les colonnes, même celles laissées vides.
        return response($order->refresh()->load('client:id,name', 'payments'), 201);
    }

    public function show(Request $r, Order $order)
    {
        return $this->own($r, $order)->loadSum('payments as paid_cfa', 'amount_cfa')
            ->load('client:id,name,phone', 'beneficiary:id,label,client_id,gender', 'payments');
    }

    public function update(Request $r, Order $order)
    {
        $order = $this->own($r, $order);
        $data = $r->validate(self::FIELDS);
        if ($id = $data['beneficiary_id'] ?? null) {
            abort_unless(Beneficiary::where('id', $id)->where('client_id', $order->client_id)->exists(), 404);
        }
        DB::transaction(function () use ($order, $data) {
            if (($data['total_cfa'] ?? null) !== null && $data['total_cfa'] < $this->lockedPaid($order)) {
                throw ValidationException::withMessages(['total_cfa' => 'Le montant ne peut pas être inférieur à ce qui a déjà été payé.']);
            }
            $order->update($data);
        });
        return $order->load('client:id,name,phone', 'payments');
    }

    public function status(Request $r, Order $order)
    {
        $this->own($r, $order);
        $status = $r->validate(['status' => 'required|in:'.implode(',', Order::STATUSES)])['status'];
        $allowed = $status === $order->status || $status === 'annule' || in_array($status, self::TRANSITIONS[$order->status] ?? [], true);
        if (! $allowed) throw ValidationException::withMessages(['status' => 'Changement de statut impossible.']);
        if ($status === 'livre' && $order->total_cfa === null) {
            throw ValidationException::withMessages(['total_cfa' => 'Indiquez le montant avant de livrer.']);
        }
        if ($status !== $order->status) {
            $order->update(['status' => $status, 'delivered_at' => $status === 'livre' ? now() : null]);
        }
        return $order;
    }

    public function pay(Request $r, Order $order)
    {
        $this->own($r, $order);
        $data = $r->validate([
            'amount_cfa' => 'required|integer|not_in:0',
            'client_token' => 'nullable|string|max:64',
            'correction_of' => 'nullable|integer',
        ]);
        $token = $data['client_token'] ?? null;
        if ($token !== null && $existing = $order->payments()->where('client_token', $token)->first()) {
            return $order->load('payments');
        }
        if ($id = $data['correction_of'] ?? null) {
            $target = $order->payments()->find($id) ?? abort(404, 'Paiement introuvable');
            if ($target->correction_of !== null) {
                throw ValidationException::withMessages(['correction_of' => 'Une correction ne peut pas être corrigée.']);
            }
        }
        // Négatif = contre-passation. Le journal ne se modifie jamais, le cumul ne descend pas sous zéro.
        DB::transaction(function () use ($order, $data) {
            if ($this->lockedPaid($order) + $data['amount_cfa'] < 0) {
                throw ValidationException::withMessages(['amount_cfa' => 'Correction supérieure aux paiements enregistrés.']);
            }
            $order->payments()->create($data);
        });
        return response($order->load('payments'), 201);
    }

    // Le verrou sur la commande sérialise les paiements concurrents avant de lire leur somme.
    private function lockedPaid(Order $order): int
    {
        Order::whereKey($order->id)->lockForUpdate()->value('id');
        return (int) $order->payments()->sum('amount_cfa');
    }

    private function own(Request $r, Order $order): Order
    {
        abort_unless($order->atelier_id === $r->user()->atelier()->value('id'), 404);
        return $order;
    }

    private function ownAtelier(Request $r): Atelier
    {
        return $r->user()->atelier()->first() ?? abort(404, 'Aucun atelier');
    }
}
