<?php

namespace App\Filament\Resources\Promotions\Schemas;

use App\Models\Atelier;
use App\Support\Media;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Illuminate\Database\Eloquent\Builder;

class PromotionForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('Visuel')
                    ->schema([
                        FileUpload::make('image_path')
                            ->label('Image')
                            ->image()
                            ->disk('public')
                            ->directory(Media::UPLOAD_DIR)
                            ->visibility('public')
                            // Le fichier déposé passe en base au moment de l'enregistrement : il n'est plus sur le disque ensuite.
                            ->fetchFileInformation(false)
                            ->getUploadedFileUsing(fn (string $file): array => ['name' => basename($file), 'size' => 0, 'type' => 'image/jpeg', 'url' => Media::url($file)])
                            ->imageEditor()
                            ->imageEditorAspectRatioOptions(['16:9'])
                            ->helperText('Format conseillé : 16:9, 1200 x 675 px.')
                            ->required(),
                    ]),
                Section::make('Contenu')
                    ->columns(2)
                    ->schema([
                        TextInput::make('title')
                            ->label('Titre')
                            ->required()
                            ->maxLength(255),
                        TextInput::make('subtitle')
                            ->label('Sous-titre')
                            ->maxLength(255),
                        Select::make('atelier_id')
                            ->label('Atelier mis en avant')
                            ->relationship('atelier', 'name', fn (Builder $query) => $query->whereNotNull('completed_at'))
                            ->getOptionLabelFromRecordUsing(fn (Atelier $record): string => $record->name.' — '.($record->region ?? 'région inconnue'))
                            ->searchable()
                            ->preload()
                            ->helperText('Laissez vide pour envoyer vers une recherche.'),
                        TextInput::make('search_query')
                            ->label('Recherche')
                            ->maxLength(255)
                            ->helperText('Utilisée si aucun atelier n\'est choisi.'),
                    ]),
                Section::make('Diffusion')
                    ->columns(2)
                    ->schema([
                        Toggle::make('active')
                            ->label('Active')
                            ->default(true),
                        TextInput::make('position')
                            ->label('Position')
                            ->numeric()
                            ->default(0)
                            ->required()
                            ->helperText('Ordre dans le carrousel, du plus petit au plus grand.'),
                    ]),
            ]);
    }
}
