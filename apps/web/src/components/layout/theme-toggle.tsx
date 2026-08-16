'use client';

import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const OPTIONS = [
  { value: 'light', label: 'Clair', icon: SunIcon },
  { value: 'dark', label: 'Sombre', icon: MoonIcon },
  { value: 'system', label: 'Système', icon: MonitorIcon },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Le thème résolu n'est connu qu'après hydratation : le rendu serveur ignore
  // la préférence système et `localStorage`. Afficher une icône avant ce point
  // garantit une divergence d'hydratation à chaque chargement en mode sombre.
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Changer de thème" />}
      >
        {mounted ? (
          <>
            <SunIcon className="size-4 dark:hidden" aria-hidden="true" />
            <MoonIcon className="hidden size-4 dark:block" aria-hidden="true" />
          </>
        ) : (
          <MonitorIcon className="size-4 opacity-0" aria-hidden="true" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => {
                setTheme(option.value);
              }}
              className={theme === option.value ? 'bg-secondary' : undefined}
            >
              <Icon aria-hidden="true" />
              {option.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
