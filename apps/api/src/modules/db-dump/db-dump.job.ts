/**
 * L'état d'un export intégral de la base, et les règles qui le font vieillir.
 *
 * Tout est écrit ici, en fonctions PURES, séparément du service : ce sont ces
 * règles-là qui décident si un fichier contenant la totalité de la clientèle
 * est encore servi ou déjà détruit, et elles doivent pouvoir être exercées sans
 * base, sans `pg_dump` et sans horloge réelle.
 */

/**
 * Les cinq états, et rien d'autre.
 *
 * `queued`  la demande est enregistrée, le processus n'a pas démarré
 * `running` `pg_dump` tourne
 * `ready`   le fichier existe, il est téléchargeable
 * `failed`  l'export a échoué, ou a été interrompu ; le motif est porté
 * `expired` le fichier a été détruit, par échéance ou après téléchargement
 *
 * `expired` n'est PAS une erreur, et l'écran ne doit pas le présenter comme
 * telle : c'est l'aboutissement normal du cycle. Un export qu'on a téléchargé
 * finit expiré, comme un export qu'on a laissé passer.
 */
export type DumpStatus = 'queued' | 'running' | 'ready' | 'failed' | 'expired';

export interface DumpJob {
  readonly id: string;
  readonly status: DumpStatus;
  /** Qui a demandé. Le journal d'audit porte la même valeur. */
  readonly requestedById: string;
  readonly requestedByName: string;
  readonly requestedAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  /** Nom du fichier SUR LE VOLUME. Jamais construit depuis une entrée client. */
  readonly fileName: string | null;
  readonly fileSize: number | null;
  readonly sha256: string | null;
  readonly expiresAt: string | null;
  readonly downloadedAt: string | null;
  readonly failureReason: string | null;
  /**
   * Ce que l'avis de fin est devenu. `null` tant qu'il n'a pas été tenté.
   *
   * Il n'y a PAS de valeur « tout va bien » implicite : quand aucun compte
   * Brevo n'est branché, la valeur dit `NOT_CONFIGURED` et l'écran l'affiche.
   * Un export prêt dont personne n'a été prévenu, sans que rien ne le signale,
   * est exactement la panne silencieuse qu'on refuse ici.
   */
  readonly noticeStatus: string | null;
  readonly noticeDetail: string | null;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SIX HEURES, ET LE CHIFFRE EST UN ARBITRAGE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ce fichier est la base entière : le nom et le téléphone de chaque prospect,
 * le montant en francs CFA de chaque dossier bancaire, et les empreintes de
 * mots de passe. Tant qu'il est sur le volume, il est un second exemplaire de
 * la clientèle, hors de la base, sans chiffrement et sans contrôle d'accès
 * propre : quiconque obtient une image du volume, une sauvegarde du VPS ou un
 * accès au conteneur le lit intégralement.
 *
 * Deux bornes encadrent le choix :
 *
 *  - TROP COURT, l'export ne sert à rien. L'avis de fin part par e-mail, et
 *    l'administrateur qui l'a demandé peut être en réunion, en déplacement, ou
 *    simplement parti déjeuner. Sous deux heures, il retrouverait
 *    régulièrement un export déjà détruit et le relancerait, ce qui remet un
 *    exemplaire complet sur le disque : la règle trop stricte produit alors
 *    PLUS de copies, pas moins.
 *  - TROP LONG, le fichier traverse la nuit. Les sauvegardes du fournisseur,
 *    les instantanés de volume et les redéploiements ont lieu la nuit ; un
 *    export qui dure douze heures finit recopié dans des endroits que personne
 *    n'a décidés et que la purge ne connaît pas.
 *
 * Six heures couvrent une demi-journée de bureau à Dakar sans jamais franchir
 * la nuit. C'est la plus petite valeur qui évite le cycle « expiré, je
 * relance ».
 *
 * ET SURTOUT, l'échéance n'est pas le mécanisme principal : le fichier est
 * détruit dès qu'il a été TÉLÉCHARGÉ. Dans le cas nominal il ne vit que
 * quelques minutes, et six heures ne sont que la borne du cas où personne ne
 * vient le chercher.
 */
export const DUMP_TTL_MS = 6 * 60 * 60 * 1_000;

/**
 * Au-delà, un `running` est réputé MORT.
 *
 * L'état vit en base, le processus vit dans le conteneur : un redéploiement au
 * milieu d'un `pg_dump` laisse une ligne `running` que plus rien ne fera
 * avancer. Sans cette borne, elle bloquerait DÉFINITIVEMENT toute nouvelle
 * demande, puisqu'une seule est autorisée à la fois. Trente minutes sont très
 * au-delà de ce que demande une base de cette taille, et très en deçà d'une
 * journée de travail perdue à se demander pourquoi le bouton ne répond plus.
 */
export const DUMP_MAX_RUNTIME_MS = 30 * 60 * 1_000;

/** Un état encore en cours : il interdit d'en démarrer un second. */
export const isInFlight = (status: DumpStatus): boolean =>
  status === 'queued' || status === 'running';

/**
 * L'état RÉEL du travail, horloge en main.
 *
 * La ligne enregistrée peut mentir de deux façons, toutes deux dues au fait que
 * le temps passe sans que personne n'écrive : un `ready` dont l'échéance est
 * dépassée, et un `running` dont le processus est mort avec le conteneur. Cette
 * fonction est le SEUL endroit qui tranche, et tout le reste l'appelle : le
 * sondage de l'écran, le téléchargement, et la demande d'un nouvel export.
 *
 * Elle ne touche à rien : elle DIT. La destruction du fichier est faite par
 * l'appelant, à partir de ce verdict.
 */
export function effectiveStatus(job: DumpJob, now: Date): DumpStatus {
  if (job.status === 'ready') {
    if (job.expiresAt !== null && Date.parse(job.expiresAt) <= now.getTime()) return 'expired';
    return 'ready';
  }
  if (job.status === 'running' && job.startedAt !== null) {
    if (now.getTime() - Date.parse(job.startedAt) > DUMP_MAX_RUNTIME_MS) return 'failed';
  }
  return job.status;
}

/**
 * Le motif à afficher pour un travail que le temps a tué.
 *
 * Écrit à part parce qu'il ne doit PAS être confondu avec une erreur de
 * `pg_dump` : « interrompu » et « échoué » envoient l'administrateur vers deux
 * gestes différents, relancer d'un côté, appeler de l'autre.
 */
export const STALLED_REASON =
  'L’export a été interrompu, probablement par un redémarrage du serveur. ' +
  'Aucun fichier n’a été produit. Vous pouvez le relancer.';

/**
 * Nom du fichier produit, DÉRIVÉ DE L'HORLOGE ET DE L'IDENTIFIANT DU TRAVAIL.
 *
 * Aucune part de ce nom ne vient d'une entrée utilisateur, et c'est délibéré :
 * la route de téléchargement ne prend AUCUN paramètre, elle sert le fichier que
 * la base nomme. Un nom composé à partir de la requête rouvrirait le chemin
 * classique du `../../etc/passwd`, sur une route qui, elle, est authentifiée
 * administrateur.
 */
export const dumpFileName = (id: string, at: Date): string =>
  `cpi-base-${at.toISOString().slice(0, 19).replace(/[-:T]/gu, '')}-${id}.sql.gz`;
