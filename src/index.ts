#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { discord, loginAndReady } from "./discord/client.js";
import { createContext } from "./discord/context.js";
import { registerAllTools } from "./tools/index.js";

/* ── MCP server ────────────────────────────────────────────────── */

const mcp = new McpServer({
  name: "discord",
  version: "1.0.0",
  description: "Full Discord server access via bot token",
});

/* ── Register all tools ────────────────────────────────────────── */

const ctx = createContext();
registerAllTools(mcp, ctx);

/* ── Startup ───────────────────────────────────────────────────── */

async function main() {
  await loginAndReady();

  const transport = new StdioServerTransport();
  await mcp.connect(transport);
  console.error("MCP server running on stdio");
}

/* ── Graceful shutdown ─────────────────────────────────────────── */

function shutdown() {
  discord.destroy();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
