module.exports = {
  apps: [
    {
      name: 'Test.ts',
      interpreter: 'bash',
      script: 'yarn',
      args: 'test',
      watch: false,
      autorestart: false,
    },
  ],
};
