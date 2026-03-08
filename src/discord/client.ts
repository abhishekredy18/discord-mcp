#!/usr/bin/env node

// MCP uses stdout for transport — redirect any stray console.log to stderr
console.log = (...args: unknown[]) => console.error(...args);

import {
  Client,
  GatewayIntentBits,
  type Guild,
} from "discord.js";

/* ── Config ─────────────────────────────────────────────────────── */

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!BOT_TOKEN || !GUILD_ID) {
  console.error(
    "Error: DISCORD_BOT_TOKEN and DISCORD_GUILD_ID environment variables are required."
  );
  process.exit(1);
}

/* ── Discord client ─────────────────────────────────────────────── */

const discord = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  rest: {
    retries: 5,
    timeout: 15_000,
  },
});

/* ── Guild accessor ─────────────────────────────────────────────── */

function getGuild(): Guild {
  const g = discord.guilds.cache.get(GUILD_ID!);
  if (!g) throw new Error(`Guild ${GUILD_ID} not found — is the bot in the server?`);
  return g;
}

/* ── Login and ready gate ───────────────────────────────────────── */

async function loginAndReady(): Promise<void> {
  await discord.login(BOT_TOKEN);
  await new Promise<void>((resolve) => {
    if (discord.isReady()) return resolve();
    discord.once("ready", () => resolve());
  });
  console.error(
    `Discord: logged in as ${discord.user!.tag}, guild ${GUILD_ID}`
  );
  // Pre-populate channel cache
  await getGuild().channels.fetch();
}

export { discord, GUILD_ID, getGuild, loginAndReady };
