#!/usr/bin/env node
/**
 * copper3d-mcp — lets an AI coding assistant read copper3d's API and guides.
 *
 * The server carries no documentation of its own. It locates the `ai-index/`
 * that ships inside the copper3d package installed in the user's project, so
 * what the assistant sees always matches the version that project depends on.
 *
 * Read-only, and it does not render: copper3d is a browser WebGL library and
 * this is a Node process. The tools themselves are in `server.ts`.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createServer, SERVER_VERSION } from "./server.js";

export { fileUriToPath } from "./server.js";

// ---------------------------------------------------------------------------
// argv
// ---------------------------------------------------------------------------

interface CliOptions {
  projectDir?: string;
}

export function parseArgs(argv: readonly string[]): CliOptions {
  const options: CliOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--project" || arg === "-p") {
      const value = argv[++i];
      if (!value) throw new Error("--project needs a path argument.");
      options.projectDir = value;
    } else if (arg.startsWith("--project=")) {
      options.projectDir = arg.slice("--project=".length);
    }
  }
  return options;
}

async function main(): Promise<void> {
  const cli = parseArgs(process.argv.slice(2));
  await createServer({ projectDir: cli.projectDir }).connect(new StdioServerTransport());

  // stderr only: stdout is the protocol channel and anything else there
  // corrupts the stream.
  process.stderr.write(`copper3d-mcp ${SERVER_VERSION} ready\n`);
}

const isDirectRun = process.argv[1] && /copper3d-mcp|index\.[jt]s$/.test(process.argv[1]);
if (isDirectRun) {
  main().catch((err) => {
    process.stderr.write(`copper3d-mcp failed to start: ${err?.message ?? err}\n`);
    process.exit(1);
  });
}
