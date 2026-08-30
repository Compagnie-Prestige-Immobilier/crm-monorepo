<?php

namespace App\Filament\Resources\Ateliers\Schemas;

use App\Filament\Resources\Ateliers\Tables\AteliersTable;
use App\Models\Atelier;
use Filament\Forms\Components\CheckboxList;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;

class AtelierForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('Fiche publique')
                    ->description('Corrections de la fiche saisie par l\'atelier.')
                    ->columns(2)
                    ->schema([
                        TextInput::make('name')
                            ->label('Nom')
                            ->required()
                            ->maxLength(255),
                        TextInput::make('region')
                            ->label('Région')
                            ->maxLength(40),
                        TextInput::make('address')
                            ->label('Adresse')
                            ->maxLength(255)
                            ->columnSpanFull(),
                        CheckboxList::make('specialties')
                            ->label('Spécialités')
                            ->options(AteliersTable::SPECIALTIES)
                            ->required()
                            ->columns(3)
                            ->columnSpanFull(),
                        Textarea::make('description')
                            ->label('Description')
                            ->rows(4)
                            ->columnSpanFull(),
                    ]),
                Section::make('Modération')
                    ->schema([
                        Toggle::make('verified_at')
                            ->label('Atelier vérifié')
                            ->formatStateUsing(fn ($state): bool => filled($state))
                            // Ne pas écraser la date de vérification existante à chaque enregistrement.
                            ->dehydrateStateUsing(fn ($state, Atelier $record) => $state ? ($record->verified_at ?? now()) : null),
                        Textarea::make('verification_note')
                            ->label('Motif de vérification')
                            ->helperText('Affiché à l\'atelier dans les réglages de l\'application.')
                            // Attribut masqué par le modèle : il n'arrive pas par le remplissage du formulaire.
                            ->formatStateUsing(fn (Atelier $record): ?string => $record->verification_note)
                            ->rows(3)
                            ->maxLength(500),
                    ]),
            ]);
    }
}
