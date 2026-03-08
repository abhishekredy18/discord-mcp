import { PermissionFlagsBits } from "discord.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DiscordActionContext } from "../discord/context.js";
import { ok } from "../mcp/response.js";

const RECOMMENDED_PERMISSIONS = [
  "ViewChannel",
  "SendMessages",
  "ReadMessageHistory",
  "ManageMessages",
  "ManageChannels",
  "AddReactions",
  "EmbedLinks",
  "AttachFiles",
  "ManageRoles",
  "ManageThreads",
  "CreatePublicThreads",
  "CreatePrivateThreads",
  "SendMessagesInThreads",
  "ManageWebhooks",
];

export function registerServerTools(
  mcp: McpServer,
  ctx: DiscordActionContext
) {
  /* ─── get_server_capabilities ───────────────────────────────────── */

  mcp.tool(
    "discord_get_server_capabilities",
    "Report the bot's capabilities: guild info, bot permissions, enabled intents, " +
      "guild features, and any missing recommended permissions",
    {},
    async () => {
      const g = ctx.getGuild();
      const botMember = await g.members.fetch(ctx.client.user!.id);
      const permissions = botMember.permissions;

      const allPerms: Record<string, boolean> = {};
      for (const [name, flag] of Object.entries(PermissionFlagsBits)) {
        allPerms[name] = permissions.has(flag as bigint);
      }

      const missing = RECOMMENDED_PERMISSIONS.filter(
        (p) => !allPerms[p]
      );

      return ok({
        guild: {
          id: g.id,
          name: g.name,
          member_count: g.memberCount,
          features: [...g.features],
        },
        bot: {
          id: botMember.id,
          username: botMember.user.username,
          display_name: botMember.displayName,
        },
        permissions: allPerms,
        missing_recommended: missing,
        intents: ctx.client.options.intents
          ? (ctx.client.options.intents as any).toArray()
          : [],
      });
    }
  );
}
