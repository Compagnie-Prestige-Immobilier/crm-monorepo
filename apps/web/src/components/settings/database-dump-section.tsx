import { DatabaseDumpCard } from '@/components/settings/database-dump-card';

/** L’API décide si l’export existe ; l’interface doit pouvoir l’expliquer. */
export function DatabaseDumpSection(): React.ReactElement {
  return <DatabaseDumpCard />;
}
