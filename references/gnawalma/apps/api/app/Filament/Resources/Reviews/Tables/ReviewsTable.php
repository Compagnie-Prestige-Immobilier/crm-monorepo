<?php

namespace App\Filament\Resources\Reviews\Tables;

use App\Filament\Resources\Ateliers\AtelierResource;
use App\Models\Review;
use Filament\Actions\Action;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class ReviewsTable
{
    public const STATUSES = ['published' => 'Publié', 'hidden' => 'Masqué'];

    public static function configure(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->modifyQueryUsing(fn (Builder $query) => $query->with(['atelier:id,name', 'user:id,name']))
            ->columns([
                TextColumn::make('atelier.name')
                    ->label('Atelier')
                    ->searchable()
                    ->url(fn (Review $record): string => AtelierResource::getUrl('view', ['record' => $record->atelier_id])),
                TextColumn::make('user.name')
                    ->label('Auteur')
                    ->searchable(),
                TextColumn::make('rating')
                    ->label('Note')
                    ->badge()
                    ->color(fn (int $state): string => $state >= 4 ? 'success' : ($state >= 3 ? 'warning' : 'danger'))
                    ->formatStateUsing(fn (int $state): string => str_repeat('★', $state).str_repeat('☆', 5 - $state))
                    ->sortable(),
                TextColumn::make('text')
                    ->label('Avis')
                    ->placeholder('Sans commentaire')
                    ->wrap()
                    ->limit(120)
                    ->searchable(),
                TextColumn::make('status')
                    ->label('Statut')
                    ->badge()
                    ->formatStateUsing(fn (string $state): string => self::STATUSES[$state] ?? $state)
                    ->color(fn (string $state): string => $state === 'published' ? 'success' : 'danger'),
                TextColumn::make('created_at')
                    ->label('Date')
                    ->dateTime('d/m/Y H:i')
                    ->sortable(),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->label('Statut')
                    ->options(self::STATUSES),
                SelectFilter::make('rating')
                    ->label('Note')
                    ->options([5 => '5 étoiles', 4 => '4 étoiles', 3 => '3 étoiles', 2 => '2 étoiles', 1 => '1 étoile']),
            ])
            ->recordActions([
                Action::make('masquer')
                    ->label('Masquer')
                    ->icon(Heroicon::OutlinedEyeSlash)
                    ->color('danger')
                    ->requiresConfirmation()
                    ->modalHeading('Masquer cet avis')
                    ->modalDescription('L\'avis disparaît de la fiche publique et des moyennes.')
                    ->modalSubmitActionLabel('Masquer')
                    ->visible(fn (Review $record): bool => $record->status === 'published')
                    ->action(fn (Review $record) => $record->update(['status' => 'hidden']))
                    ->successNotificationTitle('Avis masqué'),
                Action::make('publier')
                    ->label('Publier')
                    ->icon(Heroicon::OutlinedEye)
                    ->color('success')
                    ->requiresConfirmation()
                    ->modalHeading('Publier cet avis')
                    ->modalSubmitActionLabel('Publier')
                    ->visible(fn (Review $record): bool => $record->status === 'hidden')
                    ->action(fn (Review $record) => $record->update(['status' => 'published']))
                    ->successNotificationTitle('Avis publié'),
                Action::make('voirAtelier')
                    ->label('Voir l\'atelier')
                    ->icon(Heroicon::OutlinedBuildingStorefront)
                    ->url(fn (Review $record): string => AtelierResource::getUrl('view', ['record' => $record->atelier_id])),
            ])
            ->toolbarActions([]);
    }
}
