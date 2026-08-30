<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class PurgeAccounts extends Command
{
    private const DELAY_DAYS = 7;

    protected $signature = 'accounts:purge';

    protected $description = 'Supprime les comptes dont la suppression a été demandée il y a plus de 7 jours';

    public function handle(): int
    {
        // Atelier, clients, commandes et paiements partent en cascade côté base.
        $deleted = User::whereNotNull('deletion_requested_at')
            ->where('deletion_requested_at', '<', now()->subDays(self::DELAY_DAYS))
            ->delete();

        $this->info("$deleted compte(s) supprimé(s).");

        return self::SUCCESS;
    }
}
