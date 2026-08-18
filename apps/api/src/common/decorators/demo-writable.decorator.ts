import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const DEMO_WRITABLE_KEY = 'demoWritable';

export const DemoWritable = (reason: string): CustomDecorator =>
  SetMetadata(DEMO_WRITABLE_KEY, reason);

export interface DemoExemption {
  readonly reason: string;
  readonly label: string;
}

export const DEMO_EXEMPTIONS: readonly DemoExemption[] = [
  {
    reason: 'sans quoi le mode démonstration ne pourrait plus être éteint',
    label: 'la bascule de démonstration elle-même (sans quoi le mode ne pourrait plus être éteint)',
  },
  {
    reason: 'ouvrir et fermer une session n’écrit aucune donnée métier',
    label: 'l’authentification',
  },
  {
    reason: 'la remontée hors ligne ne doit JAMAIS être refusée',
    label: 'la remontée hors ligne du mobile (`POST /v1/sync/push`, qui n’est JAMAIS refusée)',
  },
  {
    reason: 'acte personnel et inoffensif, sans effet sur les chiffres',
    label: 'le marquage en lu d’une notification personnelle',
  },
  {
    reason: 'aperçu calculé, aucune écriture malgré la méthode POST',
    label:
      'l’aperçu d’un gabarit de notification (`POST /v1/notification-templates/render`, ' +
      'un calcul qui n’écrit rien malgré la méthode POST)',
  },
];

export const DEMO_EXEMPTIONS_SENTENCE: string = DEMO_EXEMPTIONS.map(
  (exemption) => exemption.label,
).reduce((phrase, label, index, labels) =>
  index === labels.length - 1 ? `${phrase}, et ${label}` : `${phrase}, ${label}`,
);
