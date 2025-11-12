module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['lib/**/*.ts', '!lib/config/**/*.ts', '!lib/types/**/*.ts'],
  coverageDirectory: 'coverage',
  modulePathIgnorePatterns: ['dist', 'cdk.out']
};
