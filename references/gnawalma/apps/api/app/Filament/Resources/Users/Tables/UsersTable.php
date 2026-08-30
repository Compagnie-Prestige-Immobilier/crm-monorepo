<?php

namespace App\Filament\Resources\Users\Tables;

use App\Filament\Resources\Ateliers\AtelierResource;
use App\Models\User;
use App\Support\CsvExport;
use Filament\Actions\Action;
use Filament\Actions\EditAction;
use Filament\Notifications\Notification;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Hash;

class UsersTable
{
    public const ROLES = ['admin' => 'Administration', 'atelier' => 'Atelier', 'client' => 'Client'];

    public static function configure(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->modifyQueryUsing(fn (Builder $query) => $query->with('atelier:id,user_id,name'))
            ->columns([
                TextColumn::make('name')
                    ->label('Nom')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('phone')
                    ->label('Téléphone')
                    ->placeholder('—')
                    ->searchable(),
                TextColumn::make('email')
                    ->label('Courriel')
                    ->placeholder('—')
                    ->searchable(),
                TextColumn::make('role')
                    ->label('Rôle')
                    ->badge()
                    ->formatStateUsing(fn (string $state): string => self::ROLES[$state] ?? $state)
                    ->color(fn (string $state): string => match ($state) {
                        'admin' => 'danger',
                        'atelier' => 'info',
                        default => 'gray',
                    }),
                TextColumn::make('atelier.name')
                    ->label('Atelier')
                    ->placeholder('—')
                    ->url(fn (User $record): ?string => $record->atelier ? AtelierResource::getUrl('view', ['record' => $record->atelier]) : null),
                TextColumn::make('created_at')
                    ->label('Inscrit le')
                    ->dateTime('d/m/Y')
                    ->sortable(),
            ])
            ->filters([
                SelectFilter::make('role')
                    ->label('Rôle')
                    ->options(self::ROLES),
            ])
            ->recordActions([
                EditAction::make()->label('Modifier'),
                Action::make('reinitialiserCode')
                    ->label('Réinitialiser le code')
                    ->icon(Heroicon::OutlinedKey)
                    ->requiresConfirmation()
                    ->modalHeading('Réinitialiser le code de connexion')
                    ->modalDescription('Un nouveau code à 4 chiffres est généré et affiché une seule fois.')
                    ->modalSubmitActionLabel('Réinitialiser')
                    ->action(function (User $record): void {
                        $pin = str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
                        $record->update(['password' => Hash::make($pin)]);

                        Notification::make()
                            ->success()
                            ->title('Nouveau code : '.$pin)
                            ->body('Communiquez-le à '.$record->name.'. Il ne sera plus affiché.')
                            ->persistent()
                            ->send();
                    }),
            ])
            ->toolbarActions([
                CsvExport::action('utilisateurs', [
                    'Nom' => fn (User $u): string => $u->name,
                    'Téléphone' => fn (User $u): ?string => $u->phone,
                    'Courriel' => fn (User $u): ?string => $u->email,
                    'Rôle' => fn (User $u): string => self::ROLES[$u->role] ?? $u->role,
                    'Atelier' => fn (User $u): ?string => $u->atelier?->name,
                    'Inscrit le' => fn (User $u): string => $u->created_at->format('d/m/Y'),
                ]),
            ]);
    }
}
