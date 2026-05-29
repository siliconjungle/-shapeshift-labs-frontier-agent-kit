#!/usr/bin/env node
import { runCli } from '../dist/node.js';

try {
  const result = await runCli(process.argv.slice(2), process.cwd());
  process.exitCode = result.status;
} catch (error) {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
}

