<?php

namespace App\Support;

use Closure;
use Filament\Actions\Action;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Contracts\HasTable;
use Illuminate\Database\Eloquent\Model;
use Symfony\Component\HttpFoundation\StreamedResponse;

// Export direct en flux : pas de file d'attente ni de disque persistant sur Render.
class CsvExport
{
    /** @param  array<string, Closure>  $columns  en-tête => valeur tirée de l'enregistrement */
    public static function action(string $filename, array $columns): Action
    {
        return Action::make('exporter')
            ->label('Exporter en CSV')
            ->icon(Heroicon::OutlinedArrowDownTray)
            ->color('gray')
            ->action(fn (HasTable $livewire): StreamedResponse => response()->streamDownload(
                function () use ($livewire, $columns): void {
                    $out = fopen('php://output', 'w');
                    // BOM : sans lui Excel affiche les accents en mojibake.
                    fwrite($out, "\xEF\xBB\xBF");
                    fputcsv($out, array_keys($columns), ';', '"', '');
                    $livewire->getFilteredSortedTableQuery()?->lazy()->each(
                        fn (Model $record) => fputcsv($out, array_map(fn (Closure $value) => $value($record), $columns), ';', '"', '')
                    );
                    fclose($out);
                },
                $filename.'-'.now()->format('Y-m-d').'.csv',
                ['Content-Type' => 'text/csv; charset=UTF-8'],
            ));
    }
}
