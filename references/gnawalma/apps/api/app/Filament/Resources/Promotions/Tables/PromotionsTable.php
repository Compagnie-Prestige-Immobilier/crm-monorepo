<?php

namespace App\Filament\Resources\Promotions\Tables;

use App\Models\Promotion;
use App\Support\Media;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Columns\ToggleColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class PromotionsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->reorderable('position')
            ->defaultSort('position')
            ->modifyQueryUsing(fn (Builder $query) => $query->with('atelier:id,name'))
            ->columns([
                ImageColumn::make('image_path')
                    ->label('Image')
                    ->getStateUsing(fn (Promotion $record): ?string => Media::url($record->image_path))
                    ->imageWidth(128)
                    ->imageHeight(72),
                TextColumn::make('title')
                    ->label('Titre')
                    ->description(fn (Promotion $record): ?string => $record->subtitle)
                    ->searchable(),
                TextColumn::make('cible')
                    ->label('Destination')
                    ->state(function (Promotion $record): string {
                        if ($record->atelier_id !== null) {
                            return $record->atelier->name;
                        }

                        return $record->search_query ? 'Recherche : '.$record->search_query : 'Aucune';
                    }),
                ToggleColumn::make('active')
                    ->label('Active'),
                TextColumn::make('position')
                    ->label('Position')
                    ->sortable(),
            ])
            ->recordActions([
                EditAction::make()->label('Modifier'),
                DeleteAction::make()->label('Supprimer'),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make()->label('Supprimer'),
                ]),
            ]);
    }
}
