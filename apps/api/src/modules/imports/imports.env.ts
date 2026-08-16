import { z } from 'zod';

/**
 * Contrat d'environnement des imports de masse.
 *
 * DÉLIBÉRÉMENT SÉPARÉ du schéma global de `src/env.ts`, exactement pour la
 * raison écrite en tête de `notifications.env.ts` : rien ici ne doit faire
 * échouer le démarrage. Un répertoire de dépôt mal orthographié doit dégrader
 * l'import, pas éteindre l'API entière, qui sert par ailleurs la prospection,
 * la synchronisation mobile et les dossiers bancaires.
 *
 * `safeParse` et retombée sur les défauts, jamais `parse` : une variable
 * illisible retombe sur sa valeur par défaut et le service continue.
 */

export const importsEnvSchema = z.object({
  /**
   * Répertoire de dépôt des classeurs, sur un volume PERSISTANT.
   *
   * Le fichier survit à l'image, comme les APK et les exports de base, et pour
   * la même raison : le travail est repris par un autre conteneur que celui qui
   * a reçu le téléversement. Un répertoire dans l'image ferait échouer toute
   * reprise après redéploiement, c'est-à-dire précisément le cas que la reprise
   * existe pour couvrir.
   */
  IMPORTS_DIR: z.string().min(1).default('./storage/imports'),

  /**
   * Plafond de taille du classeur téléversé.
   *
   * Cinquante mille lignes de représentants pèsent quelques mégaoctets une fois
   * compressées en `.xlsx`. Vingt-cinq laissent de la marge sans faire du
   * téléversement un moyen d'occuper le volume. Le plafond est appliqué AU FLUX
   * (voir `import-file.store.ts`), jamais après matérialisation.
   */
  IMPORTS_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(268_435_456)
    .default(25 * 1_024 * 1_024),

  /**
   * Taille d'une tranche, en LIGNES CONSOMMÉES.
   *
   * Cinq cents est le compromis : assez pour que l'écriture reste groupée, et
   * assez peu pour qu'une transaction tienne largement sous son délai, même sur
   * une base chargée. Une transaction unique de cinquante mille lignes tiendrait
   * un verrou pendant des minutes et perdrait tout le travail sur la moindre
   * erreur de la dernière ligne.
   */
  IMPORTS_CHUNK_SIZE: z.coerce.number().int().positive().max(5_000).default(500),

  /**
   * Durée de vie du fichier déposé ET du rapport, en heures.
   *
   * Le classeur porte des noms et des téléphones : c'est un second exemplaire,
   * hors base et sans chiffrement, de ce que la base protège. Vingt-quatre
   * heures couvrent une journée de bureau et le lendemain matin, et pas
   * davantage.
   */
  IMPORTS_TTL_HOURS: z.coerce.number().int().positive().max(168).default(24),

  /**
   * Interrupteur du balayage périodique.
   *
   * ALLUMÉ par défaut, à la différence de `DB_DUMP_ENABLED` : sans balayage,
   * aucun travail ne démarre jamais et la fonctionnalité est morte. C'est un
   * levier d'exploitation (éteindre une réplique qui ne doit pas travailler),
   * pas un interrupteur de fonctionnalité.
   */
  IMPORTS_SWEEP_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
});

export type ImportsEnv = z.infer<typeof importsEnvSchema>;

/** Lit l'environnement des imports SANS JAMAIS LEVER. */
export const readImportsEnv = (source: NodeJS.ProcessEnv = process.env): ImportsEnv => {
  const parsed = importsEnvSchema.safeParse(source);
  return parsed.success ? parsed.data : importsEnvSchema.parse({});
};
