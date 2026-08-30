<?php

namespace App\Filament\Widgets;

use App\Filament\Resources\Ateliers\AtelierResource;
use App\Models\Atelier;
use Filament\Actions\Action;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;

class AteliersAVerifier extends TableWidget
{
    protected static ?int $sort = 2;

    protected int|string|array $columnSpan = 'full';

    public function table(Table $table): Table
    {
        return $table
            ->heading('Ateliers à vérifier')
            ->description('Fiches terminées par leur propriétaire, en attente de vérification par LIC.')
            ->query(AtelierResource::aVerifier()->with('user:id,name'))
            ->defaultSort('completed_at', 'desc')
            ->emptyStateHeading('Aucun atelier en attente')
            ->columns([
                TextColumn::make('name')->label('Nom')->weight('medium'),
                TextColumn::make('region')->label('Région')->placeholder('—'),
                TextColumn::make('user.name')->label('Propriétaire')->description(fn (Atelier $record): ?string => $record->phone),
                TextColumn::make('completed_at')->label('Publié le')->dateTime('d/m/Y'),
            ])
            ->recordUrl(fn (Atelier $record): string => AtelierResource::getUrl('view', ['record' => $record]))
            ->recordActions([
                AtelierResource::verifierAction(),
                Action::make('voir')
                    ->label('Voir la fiche')
                    ->icon(Heroicon::OutlinedEye)
                    ->url(fn (Atelier $record): string => AtelierResource::getUrl('view', ['record' => $record])),
            ]);
    }
}
