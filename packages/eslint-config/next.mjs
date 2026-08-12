import base from './base.mjs';

export default [
  ...base,
  {
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
];
