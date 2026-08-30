<?php

namespace App\Filament\Resources\Ateliers;

use App\Filament\Resources\Ateliers\Pages\EditAtelier;
use App\Filament\Resources\Ateliers\Pages\ListAteliers;
use App\Filament\Resources\Ateliers\Pages\ViewAtelier;
use App\Filament\Resources\Ateliers\Schemas\AtelierForm;
use App\Filament\Resources\Ateliers\Schemas\AtelierInfolist;
use App\Filament\Resources\Ateliers\Tables\AteliersTable;
use App\Models\Atelier;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Forms\Components\Textarea;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use UnitEnum;

class AtelierResource extends Resource
{
    protected static ?string $model = Atelier::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedBuildingStorefront;

    protected static string|UnitEnum|null $navigationGroup = 'Marketplace';

    protected static ?string $recordTitleAttribute = 'name';

    protected static ?int $navigationSort = 1;

    public static function getModelLabel(): string
    {
        return 'atelier';
    }

    public static function getPluralModelLabel(): string
    {
        return 'ateliers';
    }

    public static function getNavigationBadge(): ?string
    {
        $count = static::aVerifier()->count();

        return $count > 0 ? (string) $count : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'warning';
    }

    public static function getNavigationBadgeTooltip(): ?string
    {
        return 'Ateliers publiés en attente de vérification';
    }

    /** @return Builder<Atelier> */
    public static function aVerifier(): Builder
    {
        return Atelier::query()->whereNotNull('completed_at')->whereNull('verified_at');
    }

    // Partagée entre la table des ateliers et le widget du tableau de bord.
    public static function verifierAction(): Action
    {
        return Action::make('verifier')
            ->label('Vérifier')
            ->icon(Heroicon::OutlinedCheckBadge)
            ->color('success')
            ->modalHeading('Vérifier cet atelier')
            ->modalDescription('La fiche sera marquée comme vérifiée et remontera dans les résultats de recherche.')
            ->modalSubmitActionLabel('Vérifier')
            ->schema([self::noteField()])
            ->visible(fn (Atelier $record): bool => $record->verified_at === null)
            ->action(fn (Atelier $record, array $data) => $record->update([
                'verified_at' => now(),
                'verification_note' => $data['verification_note'] ?: null,
            ]))
            ->successNotificationTitle('Atelier vérifié');
    }

    public static function retirerVerificationAction(): Action
    {
        return Action::make('retirerVerification')
            ->label('Retirer la vérification')
            ->icon(Heroicon::OutlinedXCircle)
            ->color('danger')
            ->modalHeading('Retirer la vérification')
            ->modalDescription('L\'atelier reste publié mais perd son badge vérifié.')
            ->modalSubmitActionLabel('Retirer')
            ->schema([self::noteField()])
            ->visible(fn (Atelier $record): bool => $record->verified_at !== null)
            ->action(fn (Atelier $record, array $data) => $record->update([
                'verified_at' => null,
                'verification_note' => $data['verification_note'] ?: null,
            ]))
            ->successNotificationTitle('Vérification retirée');
    }

    private static function noteField(): Textarea
    {
        return Textarea::make('verification_note')
            ->label('Motif affiché à l\'atelier')
            ->helperText('Visible dans les réglages de l\'application, laissez vide pour n\'afficher aucun motif.')
            ->default(fn (Atelier $record): ?string => $record->verification_note)
            ->rows(3)
            ->maxLength(500);
    }

    public static function form(Schema $schema): Schema
    {
        return AtelierForm::configure($schema);
    }

    public static function infolist(Schema $schema): Schema
    {
        return AtelierInfolist::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return AteliersTable::configure($table);
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function getPages(): array
    {
        return [
            'index' => ListAteliers::route('/'),
            'view' => ViewAtelier::route('/{record}'),
            'edit' => EditAtelier::route('/{record}/edit'),
        ];
    }
}
