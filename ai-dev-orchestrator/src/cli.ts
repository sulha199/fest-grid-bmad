#!/usr/bin/env node
import { bootstrapNodeContext } from './bootstrap.js';

async function main() {
  try {
    // Attempt to bootstrap NodeContext. This validates env and project, and instantiates adapters.
    const _ctx = await bootstrapNodeContext();

    const args = process.argv.slice(2);
    if (args.length === 0) {
      console.log('no command given, nothing to run yet');
      process.exit(0);
    }

    // Future subcommand wiring will go here.
  } catch (error: any) {
    console.error(`Initialization failed: ${error.message || String(error)}`);
    process.exit(1);
  }
}

main();
