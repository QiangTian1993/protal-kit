module.exports = {
  root: true,
  env: { es2022: true, node: true, browser: true },
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['react-hooks', 'react-refresh'],
  extends: ['eslint:recommended'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }]
  }
}

