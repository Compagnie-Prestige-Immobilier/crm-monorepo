import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const DEMO_WRITABLE_KEY = 'demoWritable';

/**
 * Laisse une route ÉCRIRE alors que le mode démonstration est allumé.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI CE DÉCORATEUR EXISTE, ET POURQUOI IL EXIGE UN MOTIF
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `DemoReadOnlyGuard` refuse toute requête mutante tant que l'interrupteur est
 * allumé. C'est la bonne valeur par défaut : l'interrupteur est GLOBAL, il n'a
 * ni portée par utilisateur ni portée par session, et une écriture faite
 * pendant la fenêtre de démonstration ne sait pas dire si elle vient de
 * l'estrade ou du terrain.
 *
 * Mais un refus universel casserait la plateforme : on ne pourrait plus
 * ÉTEINDRE le mode, ni se connecter, ni remonter une file hors ligne. Les
 * exceptions sont donc inévitables, et c'est exactement pour cela qu'elles
 * sont dangereuses : chacune rouvre le trou que la garde vient de fermer.
 *
 * D'où l'argument obligatoire. Le motif n'est pas un commentaire, c'est un
 * paramètre : on ne peut pas dispenser une route sans écrire pourquoi, et le
 * balayage `demo-read-only.sweep.test.ts` relit ces motifs pour interdire une
 * dispense muette ajoutée à la va-vite.
 *
 * Posé sur une CLASSE, il dispense toutes les routes du contrôleur. C'est le
 * bon niveau pour `DemoController` (le contrôleur entier doit rester
 * manœuvrable) et pour `AuthController` (aucune de ses routes n'écrit de
 * donnée métier), et le mauvais niveau partout ailleurs.
 */
export const DemoWritable = (reason: string): CustomDecorator =>
  SetMetadata(DEMO_WRITABLE_KEY, reason);

/**
 * Une dispense, telle qu'on la NOMME à l'administrateur.
 *
 * `reason` est le motif EXACT passé au décorateur : c'est lui qui lie cette
 * table au code, et `demo-read-only.sweep.test.ts` refuse tout écart entre les
 * deux. `label` est la même dispense dite à quelqu'un qui n'a pas le code sous
 * les yeux.
 */
export interface DemoExemption {
  readonly reason: string;
  readonly label: string;
}

/**
 * LES DISPENSES ÉNUMÉRÉES UNE SEULE FOIS, POUR TOUTE LA PROSE DU CONTRAT.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE DÉFAUT QUE CETTE TABLE FERME
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Trois descriptions OpenAPI énuméraient les exceptions à la main :
 * `DemoStatusDto.enabled`, `enableDemoMode` et `ApiErrorDto.code`. Les trois
 * en annonçaient QUATRE quand le code en portait CINQ, l'aperçu d'un gabarit
 * de notification ayant été dispensé sans que personne pense aux phrases.
 *
 * Ce n'est pas une coquille de documentation. Le panneau d'administration
 * construit sa confirmation à partir du contrat : un administrateur y lisait
 * que l'aperçu du compositeur était suspendu, et l'évitait pendant sa
 * démonstration, alors que l'écran fonctionne parfaitement.
 *
 * Une liste tenue à la main À CÔTÉ d'un décorateur qui porte déjà son motif est
 * exactement la façon dont l'écart s'était créé. On ne peut pas dériver la
 * phrase des décorateurs eux-mêmes, les motifs sont écrits pour un développeur
 * et les contrôleurs ne s'importent pas depuis un DTO. La table est donc
 * ÉPINGLÉE sur eux : chaque entrée cite le motif du décorateur, et le balayage
 * rougit si l'un des deux bouge sans l'autre.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AUCUN COMPTE DANS LA PROSE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La phrase produite plus bas ne dit ni « quatre » ni « cinq ». Un numéral
 * recopié à la main est précisément ce qui s'est démenti ici, et il se
 * démentirait à nouveau à la prochaine dispense.
 */
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

/**
 * Les dispenses en une énumération française, prête à insérer dans une
 * description OpenAPI. Sans point final : l'appelant enchaîne comme il veut.
 */
export const DEMO_EXEMPTIONS_SENTENCE: string = DEMO_EXEMPTIONS.map(
  (exemption) => exemption.label,
).reduce((phrase, label, index, labels) =>
  index === labels.length - 1 ? `${phrase}, et ${label}` : `${phrase}, ${label}`,
);
