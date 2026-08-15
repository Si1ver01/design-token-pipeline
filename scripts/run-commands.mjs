import { spawnSync } from 'node:child_process';

const [, , stage = 'unknown', ...rawCommands] = process.argv;
const commands = rawCommands
  .reduce(
    (groups, argument) => {
      if (argument === ':::') groups.push([]);
      else groups.at(-1)?.push(argument);
      return groups;
    },
    [[]],
  )
  .filter((command) => command.length > 0);

const levels = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40 };
const configuredLevel = (process.env.LOG_LEVEL ?? 'INFO').toUpperCase();
const threshold = levels[configuredLevel] ?? levels.INFO;

function log(level, message, context = {}) {
  if (levels[level] < threshold) return;
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    scope: 'command-runner',
    message,
    stage,
    ...context,
  };
  const output = JSON.stringify(payload);
  if (level === 'ERROR') console.error(output);
  else console.log(output);
}

log('INFO', 'stage-start', {
  node: process.version,
  npm: process.env.npm_config_user_agent?.split(' ')[0] ?? 'unknown',
  commandCount: commands.length,
});

for (const [executable, ...args] of commands) {
  log('DEBUG', 'command-start', { executable, args });
  const startedAt = Date.now();
  const result = spawnSync(executable, args, {
    shell: false,
    stdio: 'inherit',
    env: process.env,
  });
  const durationMs = Date.now() - startedAt;
  if (result.status !== 0) {
    log('ERROR', 'command-failed', {
      executable,
      status: result.status,
      signal: result.signal ?? undefined,
      durationMs,
    });
    process.exit(result.status ?? 1);
  }
  log('DEBUG', 'command-complete', { executable, durationMs });
}

log('INFO', 'stage-complete', { commandCount: commands.length });
