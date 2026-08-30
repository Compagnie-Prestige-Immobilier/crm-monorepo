<?php

namespace App\Filament\Resources\Ateliers\Schemas;

use App\Filament\Resources\Ateliers\Tables\AteliersTable;
use App\Models\Atelier;
use App\Models\PortfolioPhoto;
use App\Support\Media;
use Filament\Infolists\Components\ImageEntry;
use Filament\Infolists\Components\RepeatableEntry;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;

class AtelierInfolist
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make()
                    ->columns(3)
                    ->schema([
                        ImageEntry::make('cover_path')
                            ->label('Couverture')
                            ->getStateUsing(fn (Atelier $record): ?string => Media::url($record->cover_path))
                            ->imageHeight(160)
                            ->columnSpan(2),
                        ImageEntry::make('logo_path')
                            ->label('Logo')
                            ->getStateUsing(fn (Atelier $record): ?string => Media::url($record->logo_path))
                            ->imageHeight(120)
                            ->circular(),
                    ]),
                Section::make('Identité')
                    ->columns(3)
                    ->schema([
                        TextEntry::make('name')->label('Nom'),
                        TextEntry::make('region')->label('Région')->placeholder('Non renseignée'),
                        TextEntry::make('address')->label('Adresse')->placeholder('Non renseignée'),
                        TextEntry::make('specialties')
                            ->label('Spécialités')
                            ->badge()
                            ->formatStateUsing(fn (string $state): string => AteliersTable::SPECIALTIES[$state] ?? $state),
                        TextEntry::make('registre_commerce')->label('Registre de commerce')->placeholder('Non renseigné'),
                        TextEntry::make('hours')->label('Horaires')->placeholder('Non renseignés'),
                        TextEntry::make('price_from')
                            ->label('À partir de')
                            ->placeholder('Non renseigné')
                            ->formatStateUsing(fn (int $state): string => number_format($state, 0, ',', ' ').' FCFA'),
                        ImageEntry::make('registre_commerce_path')
                            ->label('Photo du registre de commerce')
                            ->getStateUsing(fn (Atelier $record): ?string => Media::url($record->registre_commerce_path))
                            ->imageHeight(200)
                            ->visible(fn (Atelier $record): bool => filled($record->registre_commerce_path))
                            ->columnSpanFull(),
                        TextEntry::make('description')
                            ->label('Description')
                            ->placeholder('Aucune description')
                            ->columnSpanFull(),
                    ]),
                Section::make('Compte propriétaire')
                    ->columns(4)
                    ->schema([
                        TextEntry::make('user.name')->label('Propriétaire'),
                        TextEntry::make('phone')->label('Téléphone')->placeholder('Non renseigné'),
                        TextEntry::make('completed_at')->label('Publié le')->dateTime('d/m/Y H:i')->placeholder('Non publié'),
                        TextEntry::make('verified_at')->label('Vérifié le')->dateTime('d/m/Y H:i')->placeholder('Non vérifié'),
                        TextEntry::make('instagram')->label('Instagram')->placeholder('—'),
                        TextEntry::make('facebook')->label('Facebook')->placeholder('—'),
                        TextEntry::make('tiktok')->label('TikTok')->placeholder('—'),
                    ]),
                Section::make('Activité')
                    ->columns(4)
                    ->schema([
                        TextEntry::make('clients_count')->label('Clients')->state(fn (Atelier $record): int => $record->clients()->count()),
                        TextEntry::make('orders_count')->label('Commandes')->state(fn (Atelier $record): int => $record->orders()->count()),
                        TextEntry::make('contacts_count')->label('Contacts')->state(fn (Atelier $record): int => $record->contacts()->count()),
                        TextEntry::make('reviews_count')->label('Avis publiés')->state(fn (Atelier $record): int => $record->reviews()->count()),
                    ]),
                Section::make('Portfolio')
                    ->schema([
                        RepeatableEntry::make('photos')
                            ->hiddenLabel()
                            ->grid(4)
                            ->schema([
                                ImageEntry::make('path')->hiddenLabel()->getStateUsing(fn (PortfolioPhoto $record): ?string => Media::url($record->path))->imageHeight(140),
                            ]),
                    ]),
                Section::make('5 derniers avis')
                    ->schema([
                        RepeatableEntry::make('avis')
                            ->hiddenLabel()
                            ->state(fn (Atelier $record) => $record->reviews()->with('user:id,name')->latest()->limit(5)->get())
                            ->columns(4)
                            ->schema([
                                TextEntry::make('user.name')->label('Client'),
                                TextEntry::make('rating')->label('Note')->badge(),
                                TextEntry::make('created_at')->label('Date')->dateTime('d/m/Y'),
                                TextEntry::make('text')->label('Avis')->placeholder('Sans commentaire')->columnSpanFull(),
                            ]),
                    ]),
                Section::make('5 derniers contacts')
                    ->schema([
                        RepeatableEntry::make('derniers_contacts')
                            ->hiddenLabel()
                            ->state(fn (Atelier $record) => $record->contacts()->with('user:id,name')->latest()->limit(5)->get())
                            ->columns(4)
                            ->schema([
                                TextEntry::make('user.name')->label('Client'),
                                TextEntry::make('channel')->label('Canal')->badge(),
                                TextEntry::make('created_at')->label('Date')->dateTime('d/m/Y H:i'),
                                TextEntry::make('message')->label('Message')->placeholder('Sans message'),
                            ]),
                    ]),
            ]);
    }
}
