# Gnawalma

Marketplace d'ateliers de couture sénégalais, et outil de gestion pour ces ateliers.

- `SPEC.md` : ce que fait le produit.
- `DESIGN.md` : à quoi il ressemble.
- `apps/api` : API Laravel 13, Postgres, admin Filament sur `/admin`.
- `apps/mobile` : application Flutter, deux espaces (client, atelier).
- `archive/` : versions précédentes, gelées au tag `mobile-v1-final`.

## API

```
cd apps/api
composer install
cp .env.example .env && php artisan key:generate && php artisan jwt:secret
createdb gnawalma_v2
php artisan migrate:fresh --seed
php artisan serve
```

`php artisan octane:frankenphp` remplace `serve` si l'on veut la vitesse de
production en local ; `php artisan octane:install --server=frankenphp` télécharge
alors le binaire (ignoré par git).

Comptes de démonstration, code `1234` : `admin@lic.sn` (admin), `+221771234567`
(client), et les propriétaires d'atelier en `+2217720000xx`.

Packages notables :
- `propaganistas/laravel-phone` : validation et normalisation E.164 des numéros (`SN`, saisie locale ou internationale).
- `intervention/image-laravel` : redimensionne et recompresse les photos uploadées (`POST /media`).
- `sentry/sentry-laravel` : remonte les erreurs si `SENTRY_LARAVEL_DSN` est renseigné, no-op sinon.
- `larastan/larastan` : analyse statique (niveau 6).
- `laravel/octane` : serveur applicatif FrankenPHP, application gardée en mémoire entre les requêtes.

Commandes :
```
php artisan migrate:fresh --seed
php artisan test
vendor/bin/phpstan analyse
vendor/bin/pint --test
```

Déploiement : `render.yaml` à la racine, Docker sur Render, servi par Octane/FrankenPHP. Le conteneur exécute `optimize`, `filament:optimize` puis les migrations au démarrage — pas au build, car les caches figent les variables d'environnement que Render n'injecte qu'à l'exécution. Au démarrage, `deploy:fresh` compare `RENDER_GIT_COMMIT` à la valeur gardée en base : à chaque nouveau déploiement la base est vidée et resemée (photos de démo comprises, le disque du conteneur étant réinitialisé) ; un simple redémarrage conserve les données.

## Mobile

```
cd apps/mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000/api/v1
```

Le build de débogage s'installe sous `com.lic.gnawalma.dev`, à côté de la
version publiée.
