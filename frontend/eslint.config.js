import pluginVue from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    // 旧版 Vanilla 前端（app.js / app.css / data/*）在迁移完成前不参与 lint
    ignores: ['dist/**', 'node_modules/**', 'public/**', 'data/**', 'app.js', 'app.css', 'docs/**'],
  },
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      // 组件名允许单词（views/layout 里多为单名词），与 Vue 官方推荐放宽一致
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  prettier,
)
