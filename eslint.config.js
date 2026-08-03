const spfxProfile = require('@microsoft/eslint-config-spfx/lib/flat-profiles/react');

module.exports = [
  ...spfxProfile,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: './tsconfig.json'
      }
    }
  },
  {
    files: ['src/vendor/shared-foundation/monacoResources.ts'],
    rules: {
      // Preserve the upstream contract byte-for-byte; it deliberately rejects ASCII controls.
      'no-control-regex': 'off',
      // Manifest v1 uses explicit nulls to distinguish absent runtime entrypoints in fixtures.
      '@rushstack/no-new-null': 'off'
    }
  }
];
