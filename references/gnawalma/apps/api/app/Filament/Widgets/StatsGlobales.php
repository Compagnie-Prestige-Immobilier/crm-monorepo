<?php

namespace App\Filament\Widgets;

use App\Models\Atelier;
use App\Models\Contact;
use App\Models\Order;
use App\Models\Report;
use App\Models\Review;
use App\Models\User;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class StatsGlobales extends StatsOverviewWidget
{
    protected static ?int $sort = 0;

    protected function getStats(): array
    {
        $aVerifier = Atelier::whereNotNull('completed_at')->whereNull('verified_at')->count();
        $signalements = Report::whereNull('resolved_at')->count();
        $masques = Review::where('status', 'hidden')->count();

        return [
            Stat::make('Ateliers publiés', Atelier::whereNotNull('completed_at')->count())
                ->description('Fiches visibles dans la marketplace')
                ->icon('heroicon-o-building-storefront'),
            Stat::make('Ateliers à vérifier', $aVerifier)
                ->description('Publiés, en attente de vérification')
                ->icon('heroicon-o-check-badge')
                ->color($aVerifier > 0 ? 'warning' : 'success'),
            Stat::make('Clients', User::where('role', 'client')->count())
                ->icon('heroicon-o-users'),
            Stat::make('Commandes en cours', Order::where('status', 'en_cours')->count())
                ->icon('heroicon-o-scissors'),
            Stat::make('Contacts sur 7 jours', Contact::where('created_at', '>=', now()->subDays(7))->count())
                ->description('Appels, WhatsApp et demandes')
                ->icon('heroicon-o-chat-bubble-left-right'),
            Stat::make('Avis masqués', $masques)
                ->description('Retirés des moyennes')
                ->icon('heroicon-o-star')
                ->color($masques > 0 ? 'warning' : 'gray'),
            Stat::make('Signalements ouverts', $signalements)
                ->icon('heroicon-o-flag')
                ->color($signalements > 0 ? 'danger' : 'success'),
        ];
    }
}
