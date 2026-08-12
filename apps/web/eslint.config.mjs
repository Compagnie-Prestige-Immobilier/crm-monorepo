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
            '@radix-ui/**',
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
