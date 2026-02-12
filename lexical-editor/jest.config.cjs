const tsJestPath = require.resolve('ts-jest');

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
  ],
  transform: {
    '^.+\\.tsx?$': [tsJestPath, {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
      diagnostics: false,
      isolatedModules: true,
    }],
  },
};
