<?php

namespace App\Filament\Resources\Users\Schemas;

use Filament\Forms\Components\TextInput;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use libphonenumber\NumberParseException;

class UserForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('Compte')
                    ->description('L\'identifiant de connexion est le téléphone ou le courriel.')
                    ->columns(2)
                    ->schema([
                        TextInput::make('name')
                            ->label('Nom')
                            ->required()
                            ->maxLength(80)
                            ->columnSpanFull(),
                        TextInput::make('phone')
                            ->label('Téléphone')
                            ->tel()
                            ->requiredWithout('email')
                            ->rules(['phone:SN,INTERNATIONAL'])
                            ->unique(ignoreRecord: true)
                            // Normalisé dès la saisie : l'unicité porte sur le format enregistré.
                            ->live(onBlur: true)
                            ->afterStateUpdated(fn (TextInput $component, ?string $state) => $component->state(self::e164($state)))
                            ->dehydrateStateUsing(fn (?string $state): ?string => self::e164($state)),
                        TextInput::make('email')
                            ->label('Courriel')
                            ->email()
                            ->requiredWithout('phone')
                            ->unique(ignoreRecord: true)
                            ->dehydrateStateUsing(fn (?string $state): ?string => blank($state) ? null : mb_strtolower($state)),
                    ]),
            ]);
    }

    private static function e164(?string $value): ?string
    {
        if (blank($value)) return null;
        try {
            $phone = phone($value, 'SN');
            return $phone->isValid() ? $phone->formatE164() : $value;
        } catch (NumberParseException) {
            return $value;
        }
    }
}
