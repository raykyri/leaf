export default {
  files: ['src/**/*.test.ts'],
  extensions: ['ts'],
  nodeArguments: [
    '--import=tsx'
  ],
  timeout: '10s',
  concurrency: 1,
  serial: true
};
