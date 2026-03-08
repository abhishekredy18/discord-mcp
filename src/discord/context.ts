import type {
  Client,
  Guild,
  GuildBasedChannel,
  GuildMember,
  Message,
  Role,
} from "discord.js";
import type { TextChannel } from "discord.js";
import { discord, getGuild } from "./client.js";
import { resolveChannel, getTextChannel, resolveMember, authorMatches, resolveRole } from "./resolvers.js";

/**
 * Shared context passed to all tool registration functions.
 * Provides Discord client access, guild resolution, channel/member/role helpers,
 * and a hook point for future permission pre-checks and rate-limit wrappers.
 */
export interface DiscordActionContext {
  client: Client;
  getGuild: () => Guild;
  resolveChannel: (g: Guild, nameOrId: string) => GuildBasedChannel | undefined;
  getTextChannel: (g: Guild, nameOrId: string) => TextChannel;
  resolveMember: (g: Guild, nameOrId: string) => Promise<GuildMember | undefined>;
  resolveRole: (g: Guild, nameOrId: string) => Role | undefined;
  authorMatches: (m: Message, author: string, authorId?: string) => boolean;
}

export function createContext(): DiscordActionContext {
  return {
    client: discord,
    getGuild,
    resolveChannel,
    getTextChannel,
    resolveMember,
    resolveRole,
    authorMatches,
  };
}
