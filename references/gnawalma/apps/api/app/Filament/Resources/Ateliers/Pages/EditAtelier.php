<?php

namespace App\Filament\Resources\Ateliers\Pages;

use App\Filament\Resources\Ateliers\AtelierResource;
use Filament\Actions\ViewAction;
use Filament\Resources\Pages\EditRecord;

class EditAtelier extends EditRecord
{
    protected static string $resource = AtelierResource::class;

    protected function getHeaderActions(): array
    {
        return [
            ViewAction::make()->label('Voir la fiche'),
        ];
    }
}
