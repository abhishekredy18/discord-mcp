#!/usr/bin/env node

// MCP uses stdout for transport — redirect any stray console.log to stderr
console.log = (...args: unknown[]) => console.error(...args);

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  Client,
  ChannelType,
  GatewayIntentBits,
  type Guild,
  type GuildBasedChannel,
  type GuildMember,
  type Message,
  TextChannel,
} from "discord.js";
import { z } from "zod";

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
});

/* ── Helpers ─────────────────────────────────────────────────────── */

function getGuild(): Guild {
  const g = discord.guilds.cache.get(GUILD_ID!);
  if (!g) throw new Error(`Guild ${GUILD_ID} not found — is the bot in the server?`);
  return g;
}

function resolveChannel(g: Guild, nameOrId: string): GuildBasedChannel | undefined {
  const byId = g.channels.cache.get(nameOrId);
  if (byId) return byId;
  const name = nameOrId.replace(/^#/, "").toLowerCase();
  return g.channels.cache.find((c) => c.name.toLowerCase() === name);
}

function getTextChannel(g: Guild, nameOrId: string): TextChannel {
  const ch = resolveChannel(g, nameOrId);
  if (!ch || !ch.isTextBased())
    throw new Error(`Text channel "${nameOrId}" not found`);
  return ch as unknown as TextChannel;
}

async function resolveMember(
  g: Guild,
  nameOrId: string
): Promise<GuildMember | undefined> {
  // Try direct ID fetch
  try {
    return await g.members.fetch(nameOrId);
  } catch {
    /* not an ID */
  }
  // Search by name
  const hits = await g.members.fetch({ query: nameOrId, limit: 10 });
  const lower = nameOrId.toLowerCase();
  return hits.find(
    (m) =>
      m.displayName.toLowerCase() === lower ||
      m.user.username.toLowerCase() === lower
  );
}

const CHANNEL_TYPE_NAMES: Record<number, string> = {
  [ChannelType.GuildText]: "text",
  [ChannelType.GuildVoice]: "voice",
  [ChannelType.GuildCategory]: "category",
  [ChannelType.GuildAnnouncement]: "announcement",
  [ChannelType.GuildStageVoice]: "stage",
  [ChannelType.GuildForum]: "forum",
  [ChannelType.GuildMedia]: "media",
  [ChannelType.PublicThread]: "thread",
  [ChannelType.PrivateThread]: "private-thread",
  [ChannelType.AnnouncementThread]: "announcement-thread",
};

function fmtChannel(ch: GuildBasedChannel) {
  return {
    id: ch.id,
    name: ch.name,
    type: CHANNEL_TYPE_NAMES[ch.type] ?? `unknown(${ch.type})`,
    ...("topic" in ch && (ch as any).topic ? { topic: (ch as any).topic } : {}),
    ...(ch.parent ? { parent: ch.parent.name } : {}),
  };
}

function fmtMessage(m: Message) {
  return {
    id: m.id,
    author:
      m.member?.displayName ?? m.author.displayName ?? m.author.username,
    author_id: m.author.id,
    content: m.content,
    timestamp: m.createdAt.toISOString(),
    ...(m.attachments.size > 0
      ? {
          attachments: [...m.attachments.values()].map((a) => ({
            name: a.name,
            url: a.url,
            size: a.size,
            type: a.contentType,
          })),
        }
      : {}),
    ...(m.embeds.length > 0 ? { embeds: m.embeds.length } : {}),
  };
}

function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function err(msg: string) {
  return {
    content: [{ type: "text" as const, text: msg }],
    isError: true as const,
  };
}

function authorMatches(m: Message, author: string, authorId?: string): boolean {
  if (authorId) return m.author.id === authorId;
  const lower = author.toLowerCase();
  return (
    m.author.username.toLowerCase() === lower ||
    (m.member?.displayName ?? m.author.displayName ?? "").toLowerCase() ===
      lower
  );
}

/* ── MCP server ─────────────────────────────────────────────────── */

const mcp = new McpServer({
  name: "discord",
  version: "1.0.0",
  description: "Full Discord server access via bot token",
});

/* ─── list_channels ─────────────────────────────────────────────── */

mcp.tool(
  "discord_list_channels",
  "List all channels in the Discord server",
  {
    type: z
      .enum([
        "text",
        "voice",
        "category",
        "announcement",
        "forum",
        "stage",
        "thread",
      ])
      .optional()
      .describe("Filter by channel type"),
  },
  async ({ type }) => {
    const g = getGuild();
    await g.channels.fetch(); // refresh
    let chs = [...g.channels.cache.values()];
    if (type) {
      const map: Record<string, ChannelType[]> = {
        text: [ChannelType.GuildText],
        voice: [ChannelType.GuildVoice],
        category: [ChannelType.GuildCategory],
        announcement: [ChannelType.GuildAnnouncement],
        forum: [ChannelType.GuildForum],
        stage: [ChannelType.GuildStageVoice],
        thread: [
          ChannelType.PublicThread,
          ChannelType.PrivateThread,
          ChannelType.AnnouncementThread,
        ],
      };
      const allow = map[type] ?? [];
      chs = chs.filter((c) => allow.includes(c.type));
    }
    return ok(
      chs
        .sort((a, b) => ((a as any).rawPosition ?? 0) - ((b as any).rawPosition ?? 0))
        .map(fmtChannel)
    );
  }
);

/* ─── get_channel ───────────────────────────────────────────────── */

mcp.tool(
  "discord_get_channel",
  "Get channel details by name or ID",
  {
    channel: z.string().describe("Channel name (e.g. 'general' or '#general') or ID"),
  },
  async ({ channel }) => {
    const g = getGuild();
    await g.channels.fetch();
    const ch = resolveChannel(g, channel);
    if (!ch) return err(`Channel "${channel}" not found`);
    return ok(fmtChannel(ch));
  }
);

/* ─── get_message_history ───────────────────────────────────────── */

mcp.tool(
  "discord_get_message_history",
  "Fetch recent messages from a channel. Supports pagination and optional author filtering.",
  {
    channel: z.string().describe("Channel name or ID"),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .describe("Number of messages (default 50, max 100)"),
    before: z
      .string()
      .optional()
      .describe("Message ID — fetch messages before this (for pagination)"),
    after: z
      .string()
      .optional()
      .describe("Message ID — fetch messages after this"),
    author: z
      .string()
      .optional()
      .describe("Filter by author display name, username, or user ID"),
  },
  async ({ channel, limit, before, after, author }) => {
    const g = getGuild();
    await g.channels.fetch();
    const ch = getTextChannel(g, channel);
    const cap = limit ?? 50;

    if (!author) {
      const msgs = await ch.messages.fetch({
        limit: cap,
        ...(before ? { before } : {}),
        ...(after ? { after } : {}),
      });
      return ok({
        channel: ch.name,
        count: msgs.size,
        messages: [...msgs.values()].map(fmtMessage),
      });
    }

    // Fetch in batches to apply author filter
    const member = await resolveMember(g, author);
    const authorId = member?.id;
    const results: Message[] = [];
    let cursor = before;

    for (let i = 0; i < 5 && results.length < cap; i++) {
      const batch = await ch.messages.fetch({
        limit: 100,
        ...(cursor ? { before: cursor } : {}),
      });
      if (!batch.size) break;
      for (const m of batch.values()) {
        if (authorMatches(m, author, authorId)) results.push(m);
        if (results.length >= cap) break;
      }
      cursor = batch.last()?.id;
    }

    return ok({
      channel: ch.name,
      author,
      count: results.length,
      messages: results.map(fmtMessage),
    });
  }
);

/* ─── get_message ───────────────────────────────────────────────── */

mcp.tool(
  "discord_get_message",
  "Fetch a single message by ID",
  {
    channel: z.string().describe("Channel name or ID"),
    message_id: z.string().describe("Message ID"),
  },
  async ({ channel, message_id }) => {
    const g = getGuild();
    await g.channels.fetch();
    const ch = getTextChannel(g, channel);
    const msg = await ch.messages.fetch(message_id);
    return ok(fmtMessage(msg));
  }
);

/* ─── search_messages ───────────────────────────────────────────── */

mcp.tool(
  "discord_search_messages",
  "Search messages in a channel by text content, with optional author filter",
  {
    channel: z.string().describe("Channel name or ID"),
    query: z.string().describe("Text to search for (case-insensitive)"),
    author: z
      .string()
      .optional()
      .describe("Filter by author name or ID"),
    limit: z
      .number()
      .min(1)
      .max(50)
      .optional()
      .describe("Max results (default 25)"),
  },
  async ({ channel, query, author, limit }) => {
    const g = getGuild();
    await g.channels.fetch();
    const ch = getTextChannel(g, channel);
    const cap = limit ?? 25;
    const q = query.toLowerCase();
    const member = author ? await resolveMember(g, author) : undefined;
    const authorId = member?.id;

    const results: Message[] = [];
    let cursor: string | undefined;

    for (let i = 0; i < 10 && results.length < cap; i++) {
      const batch = await ch.messages.fetch({
        limit: 100,
        ...(cursor ? { before: cursor } : {}),
      });
      if (!batch.size) break;
      for (const m of batch.values()) {
        if (!m.content.toLowerCase().includes(q)) continue;
        if (author && !authorMatches(m, author, authorId)) continue;
        results.push(m);
        if (results.length >= cap) break;
      }
      cursor = batch.last()?.id;
    }

    return ok({
      channel: ch.name,
      query,
      count: results.length,
      messages: results.map(fmtMessage),
    });
  }
);

/* ─── send_message ──────────────────────────────────────────────── */

mcp.tool(
  "discord_send_message",
  "Send a message to a channel",
  {
    channel: z.string().describe("Channel name or ID"),
    content: z.string().describe("Message text"),
    reply_to: z
      .string()
      .optional()
      .describe("Message ID to reply to"),
  },
  async ({ channel, content, reply_to }) => {
    const g = getGuild();
    await g.channels.fetch();
    const ch = getTextChannel(g, channel);
    const msg = await ch.send({
      content,
      ...(reply_to
        ? { reply: { messageReference: reply_to } }
        : {}),
    });
    return ok({ sent: true, id: msg.id, channel: ch.name });
  }
);

/* ─── edit_message ──────────────────────────────────────────────── */

mcp.tool(
  "discord_edit_message",
  "Edit a message (the bot must be the author)",
  {
    channel: z.string().describe("Channel name or ID"),
    message_id: z.string().describe("Message ID to edit"),
    content: z.string().describe("New message text"),
  },
  async ({ channel, message_id, content }) => {
    const g = getGuild();
    await g.channels.fetch();
    const ch = getTextChannel(g, channel);
    const msg = await ch.messages.fetch(message_id);
    await msg.edit(content);
    return ok({ edited: true, id: msg.id });
  }
);

/* ─── delete_message ────────────────────────────────────────────── */

mcp.tool(
  "discord_delete_message",
  "Delete a message",
  {
    channel: z.string().describe("Channel name or ID"),
    message_id: z.string().describe("Message ID to delete"),
  },
  async ({ channel, message_id }) => {
    const g = getGuild();
    await g.channels.fetch();
    const ch = getTextChannel(g, channel);
    const msg = await ch.messages.fetch(message_id);
    await msg.delete();
    return ok({ deleted: true, id: message_id });
  }
);

/* ─── add_reaction ──────────────────────────────────────────────── */

mcp.tool(
  "discord_add_reaction",
  "React to a message with an emoji",
  {
    channel: z.string().describe("Channel name or ID"),
    message_id: z.string().describe("Message ID"),
    emoji: z.string().describe("Emoji character (e.g. '👍') or custom emoji name/ID"),
  },
  async ({ channel, message_id, emoji }) => {
    const g = getGuild();
    await g.channels.fetch();
    const ch = getTextChannel(g, channel);
    const msg = await ch.messages.fetch(message_id);
    await msg.react(emoji);
    return ok({ reacted: true, emoji });
  }
);

/* ─── remove_reaction ───────────────────────────────────────────── */

mcp.tool(
  "discord_remove_reaction",
  "Remove the bot's reaction from a message",
  {
    channel: z.string().describe("Channel name or ID"),
    message_id: z.string().describe("Message ID"),
    emoji: z.string().describe("Emoji to remove"),
  },
  async ({ channel, message_id, emoji }) => {
    const g = getGuild();
    await g.channels.fetch();
    const ch = getTextChannel(g, channel);
    const msg = await ch.messages.fetch(message_id);
    const reaction = msg.reactions.cache.find(
      (r) =>
        r.emoji.name === emoji ||
        r.emoji.toString() === emoji ||
        r.emoji.id === emoji
    );
    if (!reaction) return err(`Reaction "${emoji}" not found on this message`);
    await reaction.users.remove(discord.user!.id);
    return ok({ removed: true, emoji });
  }
);

/* ─── list_members ──────────────────────────────────────────────── */

mcp.tool(
  "discord_list_members",
  "List server members, optionally searching by name",
  {
    limit: z
      .number()
      .min(1)
      .max(1000)
      .optional()
      .describe("Max members to return (default 100)"),
    query: z.string().optional().describe("Search by display name or username"),
  },
  async ({ limit, query }) => {
    const g = getGuild();
    const members = query
      ? await g.members.fetch({ query, limit: limit ?? 100 })
      : await g.members.fetch({ limit: limit ?? 100 });
    return ok(
      [...members.values()].map((m) => ({
        id: m.id,
        username: m.user.username,
        displayName: m.displayName,
        roles: m.roles.cache
          .filter((r) => r.name !== "@everyone")
          .map((r) => r.name),
        joinedAt: m.joinedAt?.toISOString(),
        ...(m.user.bot ? { bot: true } : {}),
      }))
    );
  }
);

/* ─── list_attachments ──────────────────────────────────────────── */

mcp.tool(
  "discord_list_attachments",
  "List file attachments posted in a channel (for 'fetch docs' flows)",
  {
    channel: z.string().describe("Channel name or ID"),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .describe("Messages to scan (default 100)"),
  },
  async ({ channel, limit }) => {
    const g = getGuild();
    await g.channels.fetch();
    const ch = getTextChannel(g, channel);
    const msgs = await ch.messages.fetch({ limit: limit ?? 100 });
    const attachments = [...msgs.values()]
      .filter((m) => m.attachments.size > 0)
      .flatMap((m) =>
        [...m.attachments.values()].map((a) => ({
          name: a.name,
          url: a.url,
          size: a.size,
          type: a.contentType,
          message_id: m.id,
          author:
            m.member?.displayName ?? m.author.displayName ?? m.author.username,
          timestamp: m.createdAt.toISOString(),
        }))
      );
    return ok({ channel: ch.name, count: attachments.length, attachments });
  }
);

/* ─── create_channel ────────────────────────────────────────────── */

mcp.tool(
  "discord_create_channel",
  "Create a new channel in the server",
  {
    name: z.string().describe("Channel name"),
    type: z
      .enum(["text", "voice", "category", "announcement", "forum", "stage"])
      .optional()
      .describe("Channel type (default: text)"),
    topic: z.string().optional().describe("Channel topic"),
    parent: z
      .string()
      .optional()
      .describe("Parent category name or ID"),
  },
  async ({ name, type, topic, parent }) => {
    const g = getGuild();
    const typeMap: Record<string, ChannelType> = {
      text: ChannelType.GuildText,
      voice: ChannelType.GuildVoice,
      category: ChannelType.GuildCategory,
      announcement: ChannelType.GuildAnnouncement,
      forum: ChannelType.GuildForum,
      stage: ChannelType.GuildStageVoice,
    };
    let parentId: string | undefined;
    if (parent) {
      await g.channels.fetch();
      const pCh = resolveChannel(g, parent);
      if (pCh) parentId = pCh.id;
    }
    const chType = typeMap[type ?? "text"] as ChannelType.GuildText;
    const ch = await g.channels.create({
      name,
      type: chType,
      ...(topic ? { topic } : {}),
      ...(parentId ? { parent: parentId } : {}),
    });
    return ok(fmtChannel(ch));
  }
);

/* ─── get_dm_channels ───────────────────────────────────────────── */

mcp.tool(
  "discord_get_dm_channels",
  "List the bot's open DM channels",
  {},
  async () => {
    const dms = discord.channels.cache.filter(
      (c) => c.type === ChannelType.DM
    );
    return ok(
      [...dms.values()].map((c: any) => ({
        id: c.id,
        recipient: c.recipient?.username ?? "unknown",
      }))
    );
  }
);

/* ─── create_dm ─────────────────────────────────────────────────── */

mcp.tool(
  "discord_create_dm",
  "Open a DM channel with a server member",
  {
    user: z.string().describe("Username, display name, or user ID"),
  },
  async ({ user }) => {
    const g = getGuild();
    const member = await resolveMember(g, user);
    if (!member) return err(`Member "${user}" not found`);
    const dm = await member.createDM();
    return ok({ id: dm.id, user: member.user.username });
  }
);

/* ─── download_attachment ───────────────────────────────────────── */

mcp.tool(
  "discord_download_attachment",
  "Download an attachment and return its text content (for text-based files)",
  {
    url: z.string().describe("Attachment URL from a message"),
  },
  async ({ url }) => {
    const parsed = new URL(url);
    const allowedHosts = ["cdn.discordapp.com", "media.discordapp.net"];
    if (!allowedHosts.includes(parsed.hostname) || parsed.protocol !== "https:") {
      return err("Only Discord HTTPS attachment URLs are allowed");
    }
    const resp = await fetch(url);
    if (!resp.ok) return err(`Download failed: ${resp.status} ${resp.statusText}`);
    const text = await resp.text();
    return ok({ url, size: text.length, content: text });
  }
);

/* ── Startup ────────────────────────────────────────────────────── */

async function main() {
  // Connect to Discord gateway
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

  // Start MCP transport
  const transport = new StdioServerTransport();
  await mcp.connect(transport);
  console.error("MCP server running on stdio");
}

// Graceful shutdown
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
