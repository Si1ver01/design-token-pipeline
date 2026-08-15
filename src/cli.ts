#!/usr/bin/env node

import { ExitCode } from './cli/exit-codes.js';
import { main } from './cli/main.js';

let interrupted = false;
process.once('SIGINT', () => {
  interrupted = true;
  process.stderr.write(
    `${JSON.stringify({ level: 'WARN', scope: 'design-token-pipeline', message: 'interrupted' })}\n`,
  );
  process.exitCode = ExitCode.interrupted;
});

const exitCode = main(process.argv.slice(2));
if (!interrupted) process.exitCode = exitCode;
