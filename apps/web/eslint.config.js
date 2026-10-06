import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // shadcn components export their cva variants next to the component
      // (repeats the vite preset's options, which this override replaces)
      'react-refresh/only-export-components': [
        'error',
        { allowConstantExport: true, allowCompoundComponents: true, allowExportNames: ['buttonVariants', 'badgeVariants', 'tabsListVariants'] },
      ],
    },
  },
  {
    // config files run in Node
    files: ['*.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
