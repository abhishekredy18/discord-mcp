import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DiscordActionContext } from "../discord/context.js";
import { ok } from "../mcp/response.js";

export function registerMemberTools(mcp: McpServer, ctx: DiscordActionContext) {

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
      const g = ctx.getGuild();
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
}
