<?php

namespace Database\Seeders;

use App\Models\{Atelier, Promotion, Report, User};
use App\Models\Order;
use App\Support\Media;
use App\Support\Thumbnail;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class DatabaseSeeder extends Seeder
{
    private const ATELIERS = [
        ['Atelier Ndiaye Couture', 'Dakar', 'Médina, rue 11 x 22', 14.6765, -17.4467, ['homme', 'femme']],
        ['Fatou Style', 'Dakar', 'Parcelles Assainies, unité 12', 14.7645, -17.4185, ['femme', 'enfant']],
        ['Maison Sarr', 'Dakar', 'Plateau, avenue Lamine Guèye', 14.6710, -17.4390, ['homme']],
        ['Couture Diallo & Fils', 'Thiès', 'Quartier Randoulène', 14.7910, -16.9260, ['homme', 'femme', 'enfant']],
        ['Adja Mode', 'Thiès', 'Cité Lamy', 14.8020, -16.9410, ['femme']],
        ['Atelier Sow', 'Saint-Louis', 'Sor, rue Blanchot', 16.0179, -16.4896, ['homme', 'femme']],
        ['Bintou Tailleur', 'Kaolack', 'Léona', 14.1500, -16.0730, ['femme', 'enfant']],
        ['Mbaye Couture Moderne', 'Dakar', 'Pikine, cité Icotaf', 14.7550, -17.3970, ['homme', 'femme']],
    ];

    public function run(): void
    {
        $faker = fake('fr_FR');
        $pin = Hash::make('1234');

        User::create(['name' => 'Administration LIC', 'email' => 'admin@lic.sn', 'password' => $pin, 'role' => 'admin']);
        $client = User::create(['name' => 'Aminata Fall', 'phone' => '+221771234567', 'password' => $pin, 'role' => 'client']);

        $ateliers = [];
        foreach (self::ATELIERS as $i => [$name, $region, $address, $lat, $lng, $specs]) {
            $owner = User::create(['name' => $faker->name(), 'phone' => '+22177'.str_pad((string) (2000000 + $i), 7, '0', STR_PAD_LEFT), 'password' => $pin, 'role' => 'atelier']);
            $atelier = $owner->atelier()->create([
                'name' => $name, 'region' => $region, 'address' => $address, 'latitude' => $lat, 'longitude' => $lng,
                'specialties' => $specs, 'phone' => $owner->phone, 'description' => $faker->sentence(12),
                'wizard_step' => 3, 'completed_at' => now(), 'verified_at' => $i < 5 ? now() : null,
                'hours' => $i < 2 ? 'Lun-Sam, 9h-19h' : null, 'price_from' => $i < 2 ? 5000 : null,
                'verification_note' => $i < 5 ? null : 'Envoyez une photo de votre registre de commerce pour être vérifié.',
                'cover_path' => $this->photo("cover-$i", 1200, 750), 'logo_path' => $this->photo("logo-$i", 400, 400),
            ]);
            foreach (range(0, 2) as $p) {
                if ($path = $this->photo("portfolio-$i-$p", 900, 900)) $atelier->photos()->create(['path' => $path, 'position' => $p]);
            }
            $ateliers[] = $atelier;
            $this->seedActivity($atelier, $faker);

            if ($i < 3) {
                $client->contacts()->create(['atelier_id' => $atelier->id, 'channel' => ['phone', 'whatsapp', 'request'][$i], 'message' => $i === 2 ? 'Bonjour, je cherche une tenue pour la Tabaski.' : null]);
                $client->reviews()->create(['atelier_id' => $atelier->id, 'rating' => 5 - $i, 'text' => $faker->sentence(8)]);
            }
        }
        $client->favorites()->attach([$ateliers[0]->id, $ateliers[1]->id]);

        Promotion::create(['title' => 'Tabaski 2026 : commandez tôt', 'subtitle' => 'Les ateliers homme les mieux notés', 'image_path' => $this->photo('promo-0', 1200, 600), 'search_query' => 'homme', 'position' => 0]);
        Promotion::create(['title' => 'Atelier vérifié du mois', 'subtitle' => $ateliers[0]->name, 'image_path' => $this->photo('promo-1', 1200, 600), 'atelier_id' => $ateliers[0]->id, 'position' => 1]);

        $this->seedModeration($ateliers, $pin);
    }

    // De quoi exercer le back-office : un avis masqué et deux signalements ouverts.
    private function seedModeration(array $ateliers, string $pin): void
    {
        $signaleur = User::create(['name' => 'Moussa Diop', 'phone' => '+221775555555', 'password' => $pin, 'role' => 'client']);
        $signaleur->contacts()->create(['atelier_id' => $ateliers[6]->id, 'channel' => 'phone']);
        $avis = $signaleur->reviews()->create([
            'atelier_id' => $ateliers[6]->id, 'rating' => 1,
            'text' => 'Commentaire hors sujet, masqué par la modération.', 'status' => 'hidden',
        ]);

        $ateliers[7]->morphMany(Report::class, 'reportable')->create([
            'user_id' => $signaleur->id, 'reason' => 'Les photos du portfolio ne sont pas celles de l\'atelier.',
        ]);
        $avis->morphMany(Report::class, 'reportable')->create([
            'user_id' => $signaleur->id, 'reason' => 'Avis injurieux.',
        ]);
    }

    // Photos de démonstration téléchargées une fois ; sans réseau, les fiches restent sans image.
    private function photo(string $name, int $w, int $h): ?string
    {
        $path = "seed/$name.jpg";
        $disk = Storage::disk('public');
        if (! $disk->exists($path)) {
            try {
                $disk->put($path, Http::timeout(15)->get("https://picsum.photos/seed/gn-$name/$w/$h")->throw()->body());
            } catch (\Throwable) {
                return null;
            }
        }
        // Le disque n'est qu'un cache de téléchargement : seule la base est servie, elle survit aux redémarrages.
        $bytes = (string) $disk->get($path);
        Media::put($path, $bytes);
        Media::put(Thumbnail::path($path), Thumbnail::encode($bytes));
        return $path;
    }

    private function seedActivity(Atelier $atelier, $faker): void
    {
        foreach (range(1, 6) as $n) {
            $client = $atelier->clients()->create(['name' => $faker->name(), 'phone' => '+2217'.$faker->numerify('########'), 'address' => $faker->streetName()]);
            $ben = $client->beneficiaries()->create(['label' => $n % 2 ? 'Lui-même' : 'Son fils', 'gender' => $n % 2 ? 'homme' : 'enfant', 'measurements' => '48 / 108 / 90 / 63 / 42 / 96 / 92 / 104 / 60 / 105']);
            foreach (range(1, rand(1, 3)) as $k) {
                $total = rand(15, 80) * 1000;
                $status = $faker->randomElement(['en_cours', 'en_cours', 'pret', 'livre']);
                $order = $atelier->orders()->create([
                    'client_id' => $client->id, 'beneficiary_id' => $ben->id, 'reference' => Order::nextReference($atelier->id),
                    'measurements' => $ben->measurements, 'description' => $faker->randomElement(['Boubou brodé', 'Robe de cérémonie', 'Costume trois pièces', 'Ensemble enfant', 'Retouche pantalon']),
                    'total_cfa' => $total, 'due_at' => now()->addDays(rand(-5, 30)), 'status' => $status,
                    'delivered_at' => $status === 'livre' ? now()->subDays(rand(0, 20)) : null,
                ]);
                if (rand(0, 1)) $order->payments()->create(['amount_cfa' => intdiv($total, 2)]);
            }
        }
    }
}
