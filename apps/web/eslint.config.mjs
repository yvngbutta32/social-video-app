import { defineConfig, globalIgnores } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    files: ['next.config.js', 'tailwind.config.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'prisma/generated/**',
    'coverage/**',
  ]),
]);
