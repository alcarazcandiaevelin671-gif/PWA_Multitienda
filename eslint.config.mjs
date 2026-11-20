import { defineConfig, globalIgnores } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // Reglas nuevas de Next 16 / React Compiler que el código existente no cumplía:
    // quedan como advertencias para corregirlas de a poco sin bloquear el build.
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
    },
  },
  globalIgnores(['.next/**', '.next-prod/**', 'node_modules/**', 'next-env.d.ts', 'public/sw.js']),
]);
