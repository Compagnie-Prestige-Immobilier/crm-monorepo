import { DatabaseDumpCard } from '@/components/settings/database-dump-card';

/**
 * L'export intégral, SI ce déploiement-ci l'a demandé.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI UNE ENVELOPPE, ET PAS UN TEST DANS LA PAGE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La page des paramètres est un composant serveur asynchrone qui garde le rôle,
 * précharge le mode démonstration et compose quatre cartes : y glisser un
 * `process.env` de plus enterrerait la décision au milieu du reste, et la
 * rendrait inéprouvable sans monter la page entière. Ici, la décision est une
 * fonction pure d'une variable d'environnement, et `database-dump-section.test.tsx`
 * l'exerce dans les deux positions.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DEUX VARIABLES POUR UN SEUL INTERRUPTEUR, ET C'EST VOULU
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'API porte la MÊME `DB_DUMP_ENABLED`, et c'est elle qui fait autorité : ses
 * trois routes rendent 404 tant qu'elle n'est pas posée, quoi que le panel
 * affiche. Celle-ci ne décide de rien sur les données ; elle évite d'afficher à
 * un administrateur une carte dont chaque requête échouerait, ce qui ressemble
 * à une panne et finit en appel au support.
 *
 * Le sens du désaccord compte donc, et il est sûr dans les deux cas : panel
 * allumé et API éteinte donne une carte en erreur, jamais un export ; panel
 * éteint et API allumée donne une porte fermée à l'écran, que rien n'ouvre.
 * Aucune combinaison ne produit un export que l'API n'aurait pas autorisé.
 *
 * La comparaison est faite sur le littéral `'true'` et non par coercition :
 * `Boolean('false')` vaut `true`, et cette erreur-là allumerait la carte sur la
 * valeur qui l'éteint. C'est la raison d'être de `booleanFlag` côté API.
 */
/**
 * La valeur BRUTE est reçue en propriété, plutôt qu'un objet d'environnement :
 * `NodeJS.ProcessEnv` n'expose pas cette clé sous Next, et la contourner par un
 * transtypage cacherait la seule chose que cette fonction fait. Ici, ce qu'elle
 * lit est dans sa signature.
 */
export function DatabaseDumpSection({
  enabled = process.env.DB_DUMP_ENABLED,
}: {
  readonly enabled?: string;
} = {}): React.ReactElement | null {
  if (enabled !== 'true') return null;
  return <DatabaseDumpCard />;
}
