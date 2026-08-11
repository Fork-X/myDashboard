import { spawn } from 'node:child_process';

const commands = [
  spawn(process.execPath, ['--env-file-if-exists=.env', 'server/index.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, PORT: '3016' },
  }),
  spawn('npm', ['exec', 'webpack', 'serve'], { stdio: 'inherit', shell: true }),
];
const stop = () => commands.forEach((child) => child.kill('SIGTERM'));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
Promise.race(commands.map((child) => new Promise((resolve) => child.on('exit', resolve))))
  .finally(stop);
