import type { ReactNode } from 'react';

import { EtapesNavAuto } from '@/components/chues/etapes';

/**
 * La coque du projet CHUES. Elle ne porte AUCUNE garde : chaque écran a la
 * sienne, et un gabarit ne doit pas laisser croire qu'il en tient lieu.
 *
 * Le sélecteur des trois étapes vit ici pour survivre à la navigation : monté
 * dans chaque page, il était démonté puis remonté à chaque clic, et le passage
 * de l'étape 1 à l'étape 3 ressemblait à un rechargement. Il ne se dessine que
 * sur les trois écrans d'étape, que `EtapesNavAuto` reconnaît au segment.
 *
 * Le gabarit commun aux SEULES trois étapes n'existe pas : leurs routes vivent
 * dans trois sous-arbres différents, et les réunir sous un groupe rendrait
 * `/chues/prospects/nouveau` ambigu face à `/chues/prospects/[id]`.
 */
export default function ChuesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <EtapesNavAuto />
      {children}
    </div>
  );
}
