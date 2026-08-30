<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Throwable;

class FreshOnDeploy extends Command
{
    protected $signature = 'deploy:fresh';

    protected $description = 'Repart d\'une base de démonstration neuve quand le commit déployé change';

    public function handle(): int
    {
        $commit = config('app.deploy_id');
        if (! $commit) {
            $this->info('Pas d\'identifiant de déploiement : base conservée.');

            return self::SUCCESS;
        }
        try {
            $last = Cache::get('deploy_commit');
        } catch (Throwable) {
            $last = null;
        }
        if ($last === $commit) {
            $this->info('Même déploiement : base conservée.');

            return self::SUCCESS;
        }
        $this->call('migrate:fresh', ['--seed' => true, '--force' => true]);
        Cache::forever('deploy_commit', $commit);
        $this->info("Base réinitialisée pour le déploiement $commit.");

        return self::SUCCESS;
    }
}
