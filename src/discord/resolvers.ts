import {
  type Guild,
  type GuildBasedChannel,
  type GuildMember,
  type Message,
  type Role,
  TextChannel,
} from "discord.js";

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

function authorMatches(m: Message, author: string, authorId?: string): boolean {
  if (authorId) return m.author.id === authorId;
  const lower = author.toLowerCase();
  return (
    m.author.username.toLowerCase() === lower ||
    (m.member?.displayName ?? m.author.displayName ?? "").toLowerCase() ===
      lower
  );
}

function resolveRole(g: Guild, nameOrId: string): Role | undefined {
  const byId = g.roles.cache.get(nameOrId);
  if (byId) return byId;
  const lower = nameOrId.toLowerCase();
  return g.roles.cache.find((r) => r.name.toLowerCase() === lower);
}

export { resolveChannel, getTextChannel, resolveMember, authorMatches, resolveRole };
