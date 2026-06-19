'use strict'

const js = require('@eslint/js')
const stylistic = require('@stylistic/eslint-plugin')
const globals = require('globals')
const n = require('eslint-plugin-n')
const promise = require('eslint-plugin-promise')

// Standard-style rules, configured by hand because eslint-config-standard
// does not support flat config. Swap for neostandard once adopted.
module.exports = [
  {
    ignores: ['test/fixtures/', 'coverage/', '.yarn/']
  },
  js.configs.recommended,
  n.configs['flat/recommended'],
  promise.configs['flat/recommended'],
  {
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node
    },
    plugins: {
      '@stylistic': stylistic
    },
    rules: {
      '@stylistic/comma-dangle': ['error', 'never'],
      '@stylistic/eol-last': 'error',
      '@stylistic/indent': ['error', 2],
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      '@stylistic/semi': ['error', 'never'],
      '@stylistic/space-before-function-paren': ['error', 'always'],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-return-assign': ['error', 'except-parens'],
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'error',
      'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
      'no-var': 'error',
      'prefer-const': ['error', { destructuring: 'all' }]
    }
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      globals: globals.mocha
    }
  },
  {
    files: ['example/**/*.js'],
    languageOptions: {
      globals: globals.browser
    },
    settings: {
      // The example app's own dependencies are not installed in this repo
      n: { allowModules: ['electron'] }
    }
  }
]
