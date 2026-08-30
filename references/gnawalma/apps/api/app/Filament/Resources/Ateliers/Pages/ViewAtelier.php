<?php

namespace App\Filament\Resources\Ateliers\Pages;

use App\Filament\Resources\Ateliers\AtelierResource;
use Filament\Actions\EditAction;
use Filament\Resources\Pages\ViewRecord;

class ViewAtelier extends ViewRecord
{
    protected static string $resource = AtelierResource::class;

    protected function getHeaderActions(): array
    {
        return [
            AtelierResource::verifierAction(),
            AtelierResource::retirerVerificationAction(),
            EditAction::make()->label('Modifier'),
        ];
    }
}
