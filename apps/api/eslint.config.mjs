import base from '@crm/eslint-config/base';

export default [
  ...base,
  {
    rules: {
      // Les décorateurs Nest sont des appels dont la valeur est ignorée.
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
];
