module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    '*.js',
    '!*.config.js',
    '!node_modules/**'
  ],
  coverageDirectory: 'coverage',
  verbose: true
};
