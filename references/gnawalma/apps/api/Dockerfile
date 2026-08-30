FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
# L'image composer n'a ni intl ni gd ; l'image d'exécution les installe.
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --ignore-platform-req=ext-intl --ignore-platform-req=ext-gd --ignore-platform-req=php
COPY . .
RUN mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views bootstrap/cache \
    && composer dump-autoload --optimize --no-dev

FROM dunglas/frankenphp:1-php8.4-alpine
RUN install-php-extensions pdo_pgsql gd intl opcache pcntl
# Le bac à sable de Render refuse d'exécuter un binaire porteur de capabilities : on les retire (port > 1024).
RUN apk add --no-cache libcap && setcap -r /usr/local/bin/frankenphp
COPY --from=vendor /app /app
COPY opcache.ini "$PHP_INI_DIR/conf.d/zz-opcache.ini"
RUN cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
    && php artisan storage:link --force
ENV PORT=8000 OCTANE_SERVER=frankenphp
EXPOSE 8000
# Les caches Laravel figent les valeurs d'env : Render ne les injecte qu'au démarrage, pas au build.
# deploy:fresh vide et resème la base seulement si le commit déployé a changé ; migrate couvre les redémarrages.
CMD php artisan optimize \
    && php artisan filament:optimize \
    && php artisan deploy:fresh \
    && php artisan migrate --force \
    && exec php artisan octane:frankenphp --host=0.0.0.0 --port=$PORT --workers=2 --max-requests=250
