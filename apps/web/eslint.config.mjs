import config from '@crm/eslint-config/next';

export default [
  ...config,
  {
    rules: {
      // The shared base allows only `**/src/**`, `next/**`, `@nestjs/**` and
      // `@crm/**`. A Next.js app legitimately reaches into subpaths of its own
      // `@/` alias and of a handful of front-end packages that ship their
      // entry points that way.
      'import-x/no-internal-modules': [
        'error',
        {
          allow: [
            '@/**',
            'next/**',
            '@crm/**',
            'chart.js/**',
            // Base UI n'expose QUE des sous-chemins : `@base-ui/react` seul
            // n'est pas un point d'entrée.
            '@base-ui/react/**',
            '@hookform/resolvers/**',
            '@tanstack/**',
            'date-fns/**',
            'react-dom/**',
          ],
        },
      ],
    },
  },
];
