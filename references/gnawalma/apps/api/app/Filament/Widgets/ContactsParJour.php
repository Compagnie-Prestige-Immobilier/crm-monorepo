<?php

namespace App\Filament\Widgets;

use App\Models\Contact;
use Filament\Widgets\ChartWidget;

class ContactsParJour extends ChartWidget
{
    protected static ?int $sort = 1;

    protected ?string $heading = 'Contacts sur 30 jours';

    protected ?string $maxHeight = '260px';

    protected function getType(): string
    {
        return 'line';
    }

    protected function getData(): array
    {
        $start = now()->subDays(29)->startOfDay();
        $counts = Contact::where('created_at', '>=', $start)
            ->selectRaw('created_at::date as jour, count(*) as total')
            ->groupBy('jour')
            ->pluck('total', 'jour');

        $labels = [];
        $data = [];
        for ($day = $start->copy(); $day->lte(now()); $day->addDay()) {
            $labels[] = $day->format('d/m');
            $data[] = (int) ($counts[$day->toDateString()] ?? 0);
        }

        return [
            'datasets' => [['label' => 'Contacts', 'data' => $data, 'fill' => 'start']],
            'labels' => $labels,
        ];
    }

    protected function getOptions(): array
    {
        return ['scales' => ['y' => ['beginAtZero' => true, 'ticks' => ['precision' => 0]]]];
    }
}
