<?php

namespace App\Filament\Resources\Reports\Tables;

use App\Filament\Resources\Ateliers\AtelierResource;
use App\Models\Atelier;
use App\Models\Report;
use App\Models\Review;
use Filament\Actions\Action;
use Filament\Forms\Components\Textarea;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class ReportsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->modifyQueryUsing(fn (Builder $query) => $query->with(['user:id,name', 'reportable']))
            ->columns([
                TextColumn::make('reportable_type')
                    ->label('Type')
                    ->badge()
                    ->formatStateUsing(fn (string $state): string => $state === Atelier::class ? 'Atelier' : 'Avis')
                    ->color(fn (string $state): string => $state === Atelier::class ? 'info' : 'warning'),
                TextColumn::make('cible')
                    ->label('Cible')
                    ->state(fn (Report $record): string => self::cibleLabel($record))
                    ->url(fn (Report $record): ?string => self::cibleUrl($record)),
                TextColumn::make('reason')
                    ->label('Motif')
                    ->wrap()
                    ->limit(140)
                    ->searchable(),
                TextColumn::make('user.name')
                    ->label('Signalé par')
                    ->searchable(),
                TextColumn::make('created_at')
                    ->label('Date')
                    ->dateTime('d/m/Y H:i')
                    ->sortable(),
                TextColumn::make('resolved_at')
                    ->label('Statut')
                    ->badge()
                    ->formatStateUsing(fn ($state): string => $state ? 'Résolu' : 'Ouvert')
                    ->color(fn ($state): string => $state ? 'success' : 'danger')
                    ->default(false)
                    ->description(fn (Report $record): ?string => $record->resolution)
                    ->sortable(),
            ])
            ->filters([
                TernaryFilter::make('resolved_at')
                    ->label('Traitement')
                    ->placeholder('Tous')
                    ->trueLabel('Résolus')
                    ->falseLabel('Ouverts')
                    ->queries(
                        true: fn (Builder $query) => $query->whereNotNull('resolved_at'),
                        false: fn (Builder $query) => $query->whereNull('resolved_at'),
                        blank: fn (Builder $query) => $query,
                    ),
            ])
            ->recordActions([
                Action::make('masquerAvis')
                    ->label('Masquer l\'avis')
                    ->icon(Heroicon::OutlinedEyeSlash)
                    ->color('danger')
                    ->requiresConfirmation()
                    ->modalHeading('Masquer l\'avis signalé')
                    ->modalDescription('L\'avis disparaît de la fiche publique et des moyennes.')
                    ->modalSubmitActionLabel('Masquer')
                    ->visible(fn (Report $record): bool => $record->reportable instanceof Review && $record->reportable->status === 'published')
                    ->action(fn (Report $record) => $record->reportable->update(['status' => 'hidden']))
                    ->successNotificationTitle('Avis masqué'),
                Action::make('retirerVerification')
                    ->label('Retirer la vérification')
                    ->icon(Heroicon::OutlinedXCircle)
                    ->color('danger')
                    ->requiresConfirmation()
                    ->modalHeading('Retirer la vérification de l\'atelier')
                    ->modalSubmitActionLabel('Retirer')
                    ->visible(fn (Report $record): bool => $record->reportable instanceof Atelier && $record->reportable->verified_at !== null)
                    ->action(fn (Report $record) => $record->reportable->update(['verified_at' => null]))
                    ->successNotificationTitle('Vérification retirée'),
                Action::make('resoudre')
                    ->label('Résoudre')
                    ->icon(Heroicon::OutlinedCheckCircle)
                    ->color('success')
                    ->schema([
                        Textarea::make('resolution')
                            ->label('Note de résolution')
                            ->required()
                            ->rows(3),
                    ])
                    ->visible(fn (Report $record): bool => $record->resolved_at === null)
                    ->action(fn (Report $record, array $data) => $record->update([
                        'resolved_at' => now(),
                        'resolution' => $data['resolution'],
                    ]))
                    ->successNotificationTitle('Signalement résolu'),
                Action::make('rouvrir')
                    ->label('Rouvrir')
                    ->icon(Heroicon::OutlinedArrowUturnLeft)
                    ->requiresConfirmation()
                    ->modalHeading('Rouvrir ce signalement')
                    ->modalSubmitActionLabel('Rouvrir')
                    ->visible(fn (Report $record): bool => $record->resolved_at !== null)
                    ->action(fn (Report $record) => $record->update(['resolved_at' => null, 'resolution' => null]))
                    ->successNotificationTitle('Signalement rouvert'),
            ])
            ->toolbarActions([]);
    }

    private static function cibleLabel(Report $record): string
    {
        $target = $record->reportable;

        return match (true) {
            $target instanceof Atelier => $target->name,
            $target instanceof Review => 'Avis '.$target->rating.'/5 sur '.$target->atelier->name,
            default => 'Cible supprimée',
        };
    }

    private static function cibleUrl(Report $record): ?string
    {
        $target = $record->reportable;
        $atelierId = match (true) {
            $target instanceof Atelier => $target->id,
            $target instanceof Review => $target->atelier_id,
            default => null,
        };

        return $atelierId ? AtelierResource::getUrl('view', ['record' => $atelierId]) : null;
    }
}
