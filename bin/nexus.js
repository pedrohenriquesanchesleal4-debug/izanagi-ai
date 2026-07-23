#!/usr/bin/env node

import { runCLI } from '../dist/cli/index.js';

runCLI(process.argv.slice(2)).catch((err) => {
  console.error('\x1b[31m[NexusAI Error]:\x1b[0m', err.message || err);
  process.exit(1);
});
