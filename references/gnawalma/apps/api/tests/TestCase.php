<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Http\Request;
use Laravel\Octane\Events\RequestReceived;
use Laravel\Octane\Listeners\FlushAuthenticationState;
use Laravel\Octane\Listeners\FlushTemporaryContainerInstances;

abstract class TestCase extends BaseTestCase
{
    // Le conteneur est partagé par toutes les requêtes d'un même test, comme sous Octane :
    // le guard et le singleton JWT gardent en cache l'utilisateur et le jeton précédents.
    // On rejoue la purge d'Octane, ce qui fait de toute la suite un filet pour octane.flush.
    public function call($method, $uri, $parameters = [], $cookies = [], $files = [], $server = [], $content = null)
    {
        $event = new RequestReceived($this->app, $this->app, Request::create('/'));
        $this->app->make(FlushAuthenticationState::class)->handle($event);
        $this->app->make(FlushTemporaryContainerInstances::class)->handle($event);

        return parent::call($method, $uri, $parameters, $cookies, $files, $server, $content);
    }
}
