import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Le repli sur localhost n'a de sens qu'en développement. En production il
    // masquerait une variable oubliée : la migration viserait une base absente
    // et l'erreur ne dirait rien de la cause.
    url:
      process.env.DATABASE_URL ??
      (process.env.NODE_ENV === 'production'
        ? (() => {
            throw new Error('DATABASE_URL est obligatoire en production.');
          })()
        : 'postgresql://crm:crm@localhost:5434/crm'),
  },
});
