<?php

namespace App\OpenApi;

use Dedoc\Scramble\Support\Generator\OpenApi;
use Dedoc\Scramble\Support\Generator\Reference;
use Dedoc\Scramble\Support\Generator\Schema;
use Dedoc\Scramble\Support\Generator\Types\ArrayType;
use Dedoc\Scramble\Support\Generator\Types\BooleanType;
use Dedoc\Scramble\Support\Generator\Types\IntegerType;
use Dedoc\Scramble\Support\Generator\Types\NumberType;
use Dedoc\Scramble\Support\Generator\Types\ObjectType;
use Dedoc\Scramble\Support\Generator\Types\StringType;
use Dedoc\Scramble\Support\Generator\Types\Type;

// Ce que Scramble ne déduit pas des modèles retournés tels quels : accesseurs $appends, relations chargées, agrégats SQL.
class ModelSchemas
{
    public function __invoke(OpenApi $doc): void
    {
        $c = $doc->components;
        $ref = fn (string $name) => new Reference('schemas', $name, $c);
        $list = fn (string $name) => tap(new ArrayType, fn (ArrayType $t) => $t->setItems($ref($name)))->default([]);
        $int0 = fn () => (new IntegerType)->default(0);
        $nullStr = fn () => (new StringType)->nullable(true);
        $date = fn () => (new StringType)->format('date-time');

        $c->addSchema('Payment', Schema::fromType(tap(new ObjectType, fn (ObjectType $t) => $t
            ->addProperty('id', new IntegerType)
            ->addProperty('order_id', new IntegerType)
            ->addProperty('amount_cfa', new IntegerType)
            ->addProperty('correction_of', (new IntegerType)->nullable(true))
            ->addProperty('client_token', $nullStr())
            ->addProperty('created_at', $date())
            ->setRequired(['id', 'order_id', 'amount_cfa', 'correction_of', 'created_at']))));

        $this->patch($c->getSchema('User'), ['atelier' => $ref('Atelier')], required: ['id', 'name']);
        $this->patch($c->getSchema('Atelier'), [
            'logo_url' => $nullStr(), 'cover_url' => $nullStr(),
            'logo_thumb_url' => $nullStr(), 'cover_thumb_url' => $nullStr(), 'share_url' => new StringType,
            'specialties' => tap(new ArrayType, fn (ArrayType $t) => $t->setItems(new StringType))->default([]),
            'wizard_step' => (new IntegerType)->default(1),
            'distance_km' => (new NumberType)->nullable(true),
            'reviews_avg_rating' => $nullStr(), 'reviews_count' => $int0(),
            'is_favorite' => (new BooleanType)->default(false),
            'photos' => $list('PortfolioPhoto'), 'reviews' => $list('Review'),
            // Renvoyée au seul propriétaire de l'atelier.
            'verification_note' => $nullStr(),
        ], required: ['id', 'name']);
        $this->patch($c->getSchema('Client'), [
            'orders_count' => $int0(), 'total_spent_cfa' => $int0(), 'remaining_cfa' => $int0(),
            'last_order_at' => $date()->nullable(true),
            'beneficiaries' => $list('Beneficiary'), 'orders' => $list('Order'),
        ], required: ['id', 'name']);
        $this->patch($c->getSchema('Order'), [
            // Sans montant total saisi, le reste dû est inconnu.
            'paid_cfa' => new IntegerType, 'remaining_cfa' => (new IntegerType)->nullable(true),
            'fabric_photo_url' => $nullStr(), 'measurements_photo_url' => $nullStr(), 'voice_note_url' => $nullStr(),
            'client' => $ref('Client'), 'beneficiary' => $ref('Beneficiary'), 'payments' => $list('Payment'),
            'total_history' => tap(new ArrayType, fn (ArrayType $t) => $t->setItems(tap(new ObjectType, fn (ObjectType $o) => $o
                ->addProperty('at', $date())
                ->addProperty('from', (new IntegerType)->nullable(true))
                ->addProperty('to', (new IntegerType)->nullable(true))
                ->setRequired(['at', 'from', 'to']))))->nullable(true),
        ], optional: ['client_id']);
        $this->patch($c->getSchema('Contact'), [
            'created_at' => $date(), 'my_rating' => (new IntegerType)->nullable(true),
            'user' => $ref('User'), 'atelier' => $ref('Atelier'),
        ], optional: ['atelier_id']);
        $this->patch($c->getSchema('Review'), ['created_at' => $date(), 'user' => $ref('User')]);
        $this->patch($c->getSchema('Promotion'), ['atelier' => $ref('Atelier'), 'image_thumb_url' => $nullStr()]);
        $this->patch($c->getSchema('PortfolioPhoto'), ['url' => new StringType, 'thumb_url' => $nullStr()]);
    }

    /** @param array<string, Type> $props */
    private function patch(Schema $schema, array $props, ?array $required = null, array $optional = []): void
    {
        /** @var ObjectType $type */
        $type = $schema->type;
        foreach ($props as $name => $prop) $type->addProperty($name, $prop);
        $type->setRequired(array_values(array_diff($required ?? $type->required, $optional)));
    }
}
