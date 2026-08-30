<?php

namespace App\Http\Controllers;

use App\Models\{Atelier, Promotion, Report, Review};
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Pagination\Paginator;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class MarketplaceController extends Controller
{
    private const TTL = 60;

    // Groupes de synonymes appliqués comme alternatives (OR) dans la requête plein texte.
    private const SYNONYMS = [
        ['tailleur', 'couturier', 'couture'],
        ['homme', 'hommes', 'masculin'],
        ['femme', 'femmes', 'dame', 'dames'],
        ['enfant', 'enfants', 'bebe', 'bebes'],
        ['boubou', 'boubous'],
        ['robe', 'robes'],
        ['costume', 'costumes'],
        ['wax'],
    ];

    private static function tsQuery(string $term): string
    {
        $tokens = array_values(array_filter(preg_split('/\s+/', $term)));
        $tokens = array_map(fn ($t) => preg_replace('/[&|!():\'"<>*]/', '', $t), $tokens);
        $tokens = array_values(array_filter($tokens, fn ($t) => $t !== ''));

        $parts = [];
        foreach ($tokens as $i => $token) {
            $variants = collect(self::SYNONYMS)->first(fn ($g) => in_array(mb_strtolower($token), $g, true)) ?? [$token];
            if ($i === array_key_last($tokens)) $variants = array_map(fn ($v) => "$v:*", $variants);
            $parts[] = count($variants) > 1 ? '('.implode(' | ', $variants).')' : $variants[0];
        }
        return implode(' & ', $parts);
    }

    /** @return Paginator<int, Atelier> */
    public function search(Request $r)
    {
        $query = $r->query->all();
        ksort($query);
        // is_favorite dépend de l'utilisateur : seules les listes anonymes non filtrées sont mises en cache.
        $cacheable = auth('api')->id() === null && ! array_diff(array_keys($query), ['page', 'limit']);
        $key = 'ateliers:'.Atelier::cacheVersion().':'.http_build_query($query);
        if ($cacheable && ($hit = Cache::get($key)) !== null) return $hit;

        $page = $this->searchQuery($r)->simplePaginate($this->limit($r, 20));
        if ($cacheable) Cache::put($key, $page->toArray(), self::TTL);
        return $page;
    }

    /** @return Builder<Atelier> */
    private function searchQuery(Request $r)
    {
        $lat = $r->float('lat') ?: null;
        $lng = $r->float('lng') ?: null;
        $q = Atelier::public()->withDistance($lat, $lng)->withAvg('reviews', 'rating')->withCount('reviews');
        $q->selectRaw(
            'exists(select 1 from favorites where favorites.atelier_id = ateliers.id and favorites.user_id = ?) as is_favorite',
            [auth('api')->id() ?? 0]
        );

        // Recherche plein texte (tsvector + français) avec repli trigramme pour fautes de frappe.
        $term = $r->string('q')->trim()->toString();
        $term = $term === '' ? '' : preg_replace('/\s+/', ' ', $term);
        // Une recherche uniquement composée de ponctuation ne laisse aucun token : pas de tri par pertinence.
        $ranked = $term !== '' && ($tsquery = self::tsQuery($term)) !== '';
        if ($ranked) {
            DB::statement('SELECT set_limit(0.25)');
            DB::statement('SET pg_trgm.word_similarity_threshold = 0.5');

            $q->whereRaw(
                "(search @@ to_tsquery('french_unaccent', ?) OR search_text % f_unaccent(lower(?)) OR f_unaccent(lower(?)) <% search_text)",
                [$tsquery, $term, $term]
            );
            $q->selectRaw(
                "(CASE WHEN f_unaccent(lower(name)) = f_unaccent(lower(?)) THEN 2
                       WHEN f_unaccent(lower(name)) LIKE f_unaccent(lower(?)) || '%' THEN 1
                       ELSE 0 END) AS name_rank,
                 (ts_rank_cd(search, to_tsquery('french_unaccent', ?)) +
                  GREATEST(similarity(search_text, f_unaccent(lower(?))), word_similarity(f_unaccent(lower(?)), search_text))) AS relevance_score",
                [$term, $term, $tsquery, $term, $term]
            );
        }
        if ($region = $r->input('region')) $q->where('region', $region);
        if ($spec = $r->input('specialite')) $q->whereJsonContains('specialties', $spec);

        $q = Atelier::query()->fromSub($q, 'ateliers');
        if ($ranked) $q->orderByDesc('name_rank')->orderByDesc('relevance_score');
        $q->orderByRaw('verified_at DESC NULLS LAST')->orderByDesc('reviews_count');
        if ($lat && $lng) {
            $q->orderBy('distance_km');
            if ($rayon = $r->float('rayon')) $q->where('distance_km', '<=', $rayon);
        } else {
            $q->orderBy('name');
        }
        $q->orderBy('id');
        return $q;
    }

    public function completions(Request $r)
    {
        $term = mb_strtolower((string) preg_replace('/\s+/', ' ', $r->string('q')->trim()->toString()));
        if ($term === '') return ['data' => []];

        return Cache::remember('ateliers:completions:'.Atelier::cacheVersion().":$term", self::TTL, function () use ($term) {
            DB::statement('SELECT set_limit(0.25)');

            // Préfixe du nom ou d'un mot interne (index-backed), repli trigramme pour les fautes de frappe.
            $match = fn (string $col) => Atelier::public()->whereNotNull($col)->where($col, '!=', '')
                ->whereRaw(
                    "f_unaccent(lower($col)) LIKE f_unaccent(lower(?)) || '%' OR f_unaccent(lower($col)) LIKE '% ' || f_unaccent(lower(?)) || '%' OR f_unaccent(lower($col)) % f_unaccent(lower(?))",
                    [$term, $term, $term]
                )
                ->orderByRaw(
                    "(f_unaccent(lower($col)) LIKE f_unaccent(lower(?)) || '%') DESC, similarity(f_unaccent(lower($col)), f_unaccent(lower(?))) DESC",
                    [$term, $term]
                )
                ->limit(6)->pluck($col);

            return ['data' => $match('name')->merge($match('region'))->unique()->take(6)->values()->all()];
        });
    }

    public function show(Request $r, Atelier $atelier)
    {
        abort_unless($atelier->completed_at !== null, 404);
        $atelier = Atelier::withDistance($r->float('lat') ?: null, $r->float('lng') ?: null)
            ->withAvg('reviews', 'rating')->withCount('reviews')
            ->with(['photos', 'reviews' => fn ($q) => $q->with('user:id,name')->latest()->limit(2)])
            ->findOrFail($atelier->id);
        $user = $r->user('api');
        $atelier->is_favorite = $user?->favorites()->where('atelier_id', $atelier->id)->exists() ?? false;
        $atelier->can_review = $user?->contacts()->where('atelier_id', $atelier->id)->exists() ?? false;
        return $atelier;
    }

    public function reviews(Atelier $atelier)
    {
        abort_unless($atelier->completed_at !== null, 404);
        return $atelier->reviews()->with('user:id,name')->latest()->simplePaginate(20);
    }

    /** @return array<int, Promotion> */
    public function promotions()
    {
        // Le store base ne désérialise pas les modèles : on met en cache le tableau, JSON identique.
        return Cache::remember(Promotion::CACHE_KEY, self::TTL, fn () => Promotion::where('active', true)->orderBy('position')->with('atelier:id,name')->get()->toArray());
    }

    public function contact(Request $r, Atelier $atelier)
    {
        abort_unless($atelier->completed_at !== null, 404);
        abort_if($atelier->user_id === $r->user()->id, 403, 'C\'est votre propre atelier.');
        $data = $r->validate(['channel' => 'required|in:phone,whatsapp,request', 'message' => 'nullable|string|max:1000', 'share_phone' => 'boolean']);
        // Un seul contact par canal et par jour : rappeler un atelier ne crée pas de doublon.
        $today = $r->user()->contacts()->where('atelier_id', $atelier->id)->where('channel', $data['channel'])
            ->whereDate('created_at', now()->toDateString())->first();
        return $today ?? $r->user()->contacts()->create($data + ['atelier_id' => $atelier->id]);
    }

    public function review(Request $r)
    {
        $data = $r->validate(['atelier_id' => 'required|exists:ateliers,id', 'rating' => 'required|integer|between:1,5', 'text' => 'nullable|string|max:500']);
        $atelier = Atelier::findOrFail($data['atelier_id']);
        abort_unless($atelier->completed_at !== null, 404);
        abort_if($atelier->user_id === $r->user()->id, 403, 'C\'est votre propre atelier.');
        abort_unless($r->user()->contacts()->where('atelier_id', $atelier->id)->exists(), 403, 'Contactez d\'abord cet atelier.');
        // Un avis modifié sans texte perd l'ancien commentaire.
        return Review::updateOrCreate(['user_id' => $r->user()->id, 'atelier_id' => $atelier->id], $data + ['text' => null]);
    }

    public function report(Request $r)
    {
        $data = $r->validate(['type' => 'required|in:atelier,avis', 'id' => 'required|integer', 'reason' => 'required|string|max:500']);
        $model = $data['type'] === 'atelier' ? Atelier::findOrFail($data['id']) : Review::findOrFail($data['id']);
        return $model->morphMany(Report::class, 'reportable')->create(['user_id' => $r->user()->id, 'reason' => $data['reason']]);
    }

    public function myContacts(Request $r)
    {
        return $r->user()->contacts()->with('atelier:id,name,cover_path,region')
            ->addSelect(['*', 'my_rating' => Review::select('rating')->whereColumn('reviews.atelier_id', 'contacts.atelier_id')->where('user_id', $r->user()->id)->limit(1)])
            ->latest()->simplePaginate($this->limit($r));
    }

    public function favorites(Request $r)
    {
        return $r->user()->favorites()->withAvg('reviews', 'rating')->get()->each(fn (Atelier $a) => $a->is_favorite = true);
    }

    public function favorite(Request $r, Atelier $atelier)
    {
        $r->user()->favorites()->syncWithoutDetaching([$atelier->id]);
        return response()->noContent();
    }

    public function unfavorite(Request $r, Atelier $atelier)
    {
        $r->user()->favorites()->detach($atelier->id);
        return response()->noContent();
    }
}
