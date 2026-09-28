import {
  CalendarCheckIcon,
  DoorOpenIcon,
  LandmarkIcon,
  type LucideIcon,
  PhoneCallIcon,
  UserCogIcon,
  TrendingUpIcon,
} from 'lucide-react';

import type { Coque } from '@/components/layout/nav-items';

export const COQUE_ICONS: Record<Coque, LucideIcon> = {
  accueil: DoorOpenIcon,
  rendezvous: CalendarCheckIcon,
  teleconseil: PhoneCallIcon,
  finance: LandmarkIcon,
  ventes: TrendingUpIcon,
  admin: UserCogIcon,
};
