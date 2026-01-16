export default {
  files: ['src/**/*.test.ts'],
  extensions: ['ts'],
  nodeArguments: [
    '--experimental-strip-types'
  ],
  timeout: '10s',
  concurrency: 1,
  serial: true
};
