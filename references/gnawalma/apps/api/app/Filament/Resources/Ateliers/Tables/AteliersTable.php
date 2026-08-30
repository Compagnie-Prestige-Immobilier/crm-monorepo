<?php

namespace App\Filament\Resources\Ateliers\Tables;

use App\Filament\Resources\Ateliers\AtelierResource;
use App\Models\Atelier;
use App\Support\CsvExport;
use App\Support\Media;
use Filament\Actions\EditAction;
use Filament\Actions\ViewAction;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class AteliersTable
{
    public const SPECIALTIES = ['homme' => 'Homme', 'femme' => 'Femme', 'enfant' => 'Enfant'];

    public static function configure(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->columns([
                ImageColumn::make('cover_path')
                    ->label('Photo')
                    ->getStateUsing(fn (Atelier $record): ?string => Media::url($record->cover_path))
                    ->imageWidth(72)
                    ->imageHeight(48),
                TextColumn::make('name')
                    ->label('Nom')
                    ->searchable()
                    ->sortable()
                    ->weight('medium'),
                TextColumn::make('region')
                    ->label('Région')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('specialties')
                    ->label('Spécialités')
                    ->badge()
                    ->formatStateUsing(fn (string $state): string => self::SPECIALTIES[$state] ?? $state),
                TextColumn::make('user.name')
                    ->label('Propriétaire')
                    ->description(fn (Atelier $record): ?string => $record->phone)
                    ->searchable(),
                TextColumn::make('phone')
                    ->label('Téléphone')
                    ->searchable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('verified_at')
                    ->label('Vérifié')
                    ->badge()
                    ->formatStateUsing(fn ($state): string => $state ? 'Vérifié' : 'À vérifier')
                    ->color(fn ($state): string => $state ? 'success' : 'warning')
                    ->default(false)
                    ->sortable(),
                TextColumn::make('completed_at')
                    ->label('Publié')
                    ->badge()
                    ->formatStateUsing(fn ($state): string => $state ? 'Publié' : 'Brouillon')
                    ->color(fn ($state): string => $state ? 'success' : 'gray')
                    ->default(false)
                    ->sortable(),
                TextColumn::make('orders_count')
                    ->label('Commandes')
                    ->counts('orders')
                    ->sortable(),
                TextColumn::make('reviews_avg_rating')
                    ->label('Note')
                    ->avg('reviews', 'rating')
                    ->formatStateUsing(fn ($state): string => number_format((float) $state, 1, ',', ' '))
                    ->placeholder('—')
                    ->sortable(),
                TextColumn::make('reviews_count')
                    ->label('Avis')
                    ->counts('reviews')
                    ->sortable(),
                TextColumn::make('created_at')
                    ->label('Inscrit le')
                    ->date('d/m/Y')
                    ->sortable(),
            ])
            ->modifyQueryUsing(fn (Builder $query) => $query->with('user:id,name'))
            ->filters([
                TernaryFilter::make('verified_at')
                    ->label('Vérification')
                    ->placeholder('Tous')
                    ->trueLabel('Vérifiés')
                    ->falseLabel('À vérifier')
                    ->queries(
                        true: fn (Builder $query) => $query->whereNotNull('verified_at'),
                        false: fn (Builder $query) => $query->whereNull('verified_at'),
                        blank: fn (Builder $query) => $query,
                    ),
                TernaryFilter::make('completed_at')
                    ->label('Publication')
                    ->placeholder('Tous')
                    ->trueLabel('Publiés')
                    ->falseLabel('Brouillons')
                    ->queries(
                        true: fn (Builder $query) => $query->whereNotNull('completed_at'),
                        false: fn (Builder $query) => $query->whereNull('completed_at'),
                        blank: fn (Builder $query) => $query,
                    ),
                SelectFilter::make('region')
                    ->label('Région')
                    ->options(fn (): array => Atelier::query()->whereNotNull('region')->distinct()->orderBy('region')->pluck('region', 'region')->all()),
                SelectFilter::make('specialite')
                    ->label('Spécialité')
                    ->options(self::SPECIALTIES)
                    ->query(fn (Builder $query, array $data) => $query->when(
                        filled($data['value']),
                        fn (Builder $query) => $query->whereJsonContains('specialties', $data['value']),
                    )),
            ])
            ->recordActions([
                ViewAction::make()->label('Voir la fiche')->icon(Heroicon::OutlinedEye),
                AtelierResource::verifierAction(),
                AtelierResource::retirerVerificationAction(),
                EditAction::make()->label('Modifier'),
            ])
            ->toolbarActions([
                CsvExport::action('ateliers', [
                    'Nom' => fn (Atelier $a): string => $a->name,
                    'Région' => fn (Atelier $a): ?string => $a->region,
                    'Adresse' => fn (Atelier $a): ?string => $a->address,
                    'Téléphone' => fn (Atelier $a): ?string => $a->phone,
                    'Propriétaire' => fn (Atelier $a): ?string => $a->user?->name,
                    'Spécialités' => fn (Atelier $a): string => implode(', ', $a->specialties ?? []),
                    'Vérifié' => fn (Atelier $a): string => $a->verified_at ? 'oui' : 'non',
                    'Publié' => fn (Atelier $a): string => $a->completed_at ? 'oui' : 'non',
                    'Inscrit le' => fn (Atelier $a): string => $a->created_at->format('d/m/Y'),
                ]),
            ]);
    }
}
