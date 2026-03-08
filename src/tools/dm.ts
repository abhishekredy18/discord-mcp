import { ChannelType } from "discord.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DiscordActionContext } from "../discord/context.js";
import { ok, err } from "../mcp/response.js";

export function registerDmTools(mcp: McpServer, ctx: DiscordActionContext) {

  /* ─── get_dm_channels ───────────────────────────────────────────── */

  mcp.tool(
    "discord_get_dm_channels",
    "List the bot's open DM channels",
    {},
    async () => {
      const dms = ctx.client.channels.cache.filter(
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
      const g = ctx.getGuild();
      const member = await ctx.resolveMember(g, user);
      if (!member) return err(`Member "${user}" not found`, "NOT_FOUND");
      const dm = await member.createDM();
      return ok({ id: dm.id, user: member.user.username });
    }
  );
}
