'use client';

import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';

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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/15 hover:text-white"
            aria-label="Changer de thème"
          />
        }
      >
        <SunIcon className="size-4 dark:hidden" aria-hidden="true" />
        <MoonIcon className="hidden size-4 dark:block" aria-hidden="true" />
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
