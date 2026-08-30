<?php

use App\Models\Atelier;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Mêmes textes que les écrans Réglages de l'application.
Route::get('/conditions', fn () => view('legal', ['title' => 'Conditions d\'utilisation', 'paragraphs' => [
    'Gnawalma met en relation des clients et des ateliers de couture.',
    'En l\'utilisant, vous vous engagez à fournir des informations exactes et à respecter les autres utilisateurs.',
    'Les commandes, mesures et paiements échangés via l\'application relèvent de l\'accord direct entre le client et l\'atelier ; Gnawalma n\'intervient pas dans cette relation commerciale.',
]]))->name('legal.terms');

Route::get('/confidentialite', fn () => view('legal', ['title' => 'Confidentialité', 'paragraphs' => [
    'Nous conservons votre nom, votre contact, et les informations nécessaires au fonctionnement de l\'application : commandes, clients, avis et favoris.',
    'Ces données ne sont pas revendues à des tiers.',
    'Vous pouvez à tout moment corriger vos informations ou supprimer définitivement votre compte depuis les réglages.',
]]))->name('legal.privacy');

// Page de partage : l'app mobile envoie ce lien, le rendu HTML est mis en cache 60 s.
Route::get('/a/{atelier}', function (Atelier $atelier) {
    abort_if($atelier->completed_at === null, 404);
    return Cache::remember("landing:$atelier->id", 60, fn () => view('atelier', ['atelier' => $atelier])->render());
})->name('atelier.landing');
