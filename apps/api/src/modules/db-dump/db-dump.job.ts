/** `expired` n'est pas une erreur : c'est l'aboutissement normal du cycle. */
export type DumpStatus = 'queued' | 'running' | 'ready' | 'failed' | 'expired';

export interface DumpJob {
  readonly id: string;
  readonly status: DumpStatus;
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
  /**
   * Prise exclusive posée par écriture conditionnelle avant le premier octet
   * (`DbDumpService.reserve`), relâchée si l'envoi n'aboutit pas.
   */
  readonly reservedAt: string | null;
  readonly downloadedAt: string | null;
  readonly failureReason: string | null;
  /** Pas de valeur « tout va bien » implicite : sans Brevo la valeur est `NOT_CONFIGURED`. */
  readonly noticeStatus: string | null;
  readonly noticeDetail: string | null;
}

/** Six heures couvrent une demi-journée de bureau sans jamais franchir la nuit. */
export const DUMP_TTL_MS = 6 * 60 * 60 * 1_000;

/**
 * Un processus ne survit pas à un redéploiement, mais sa ligne si : sans cette
 * borne, un `queued` ou `running` orphelin interdit tout export à jamais.
 */
const DUMP_MAX_RUNTIME_MS = 30 * 60 * 1_000;

/**
 * Une horloge qui recule rend l'âge négatif, donc jamais au-delà de la borne.
 * Cinq minutes séparent l'ajustement NTP ordinaire du vrai saut en arrière.
 */
const DUMP_CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1_000;

/** Un état encore en cours : il interdit d'en démarrer un second. */
export const isInFlight = (status: DumpStatus): boolean =>
  status === 'queued' || status === 'running';

// Échéance absente ou illisible: détruire. Garder un exemplaire de la base
// à tort coûte plus cher qu'un export à relancer.
function readyStatus(job: DumpJob, now: Date): DumpStatus {
  const expiresAt = job.expiresAt === null ? Number.NaN : Date.parse(job.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) return 'expired';
  return 'ready';
}

// Un `queued` n'a pas encore de `startedAt`, et c'est lui qu'il ne faut pas
// laisser passer à travers la borne.
function inFlightStatus(job: DumpJob, now: Date): DumpStatus {
  const since = Date.parse(job.startedAt ?? job.requestedAt);
  if (!Number.isFinite(since)) return 'failed';
  const age = now.getTime() - since;
  if (age > DUMP_MAX_RUNTIME_MS) return 'failed';
  if (age < -DUMP_CLOCK_SKEW_TOLERANCE_MS) return 'failed';
  return job.status;
}

/** Dit l'état réel horloge en main; la destruction du fichier revient à l'appelant. */
export function effectiveStatus(job: DumpJob, now: Date): DumpStatus {
  if (job.status === 'ready') return readyStatus(job, now);
  if (isInFlight(job.status)) return inFlightStatus(job, now);
  return job.status;
}

/** « Interrompu » et « échoué » envoient vers deux gestes différents. */
export const STALLED_REASON =
  'L’export a été interrompu, probablement par un redémarrage du serveur. ' +
  'Aucun fichier n’a été produit. Vous pouvez le relancer.';

/** Aucune part du nom ne vient de la requête : la route de téléchargement n'a pas de paramètre. */
export const dumpFileName = (id: string, at: Date): string =>
  `cpi-base-${at.toISOString().slice(0, 19).replace(/[-:T]/gu, '')}-${id}.sql.gz`;
