import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DiscordActionContext } from "../discord/context.js";
import { ok, err } from "../mcp/response.js";

/* ── Helper: find a reaction on a message ─────────────────────── */

function findReaction(
  msg: { reactions: { cache: Map<string, any> & { find: (fn: (r: any) => boolean) => any } } },
  emoji: string
) {
  return msg.reactions.cache.find(
    (r: any) =>
      r.emoji.name === emoji ||
      r.emoji.toString() === emoji ||
      r.emoji.id === emoji
  );
}

export function registerReactionTools(
  mcp: McpServer,
  ctx: DiscordActionContext
) {
  /* ─── add_reaction ──────────────────────────────────────────────── */

  mcp.tool(
    "discord_add_reaction",
    "React to a message with an emoji",
    {
      channel: z.string().describe("Channel name or ID"),
      message_id: z.string().describe("Message ID"),
      emoji: z
        .string()
        .describe(
          "Emoji character (e.g. '\ud83d\udc4d') or custom emoji name/ID"
        ),
    },
    async ({ channel, message_id, emoji }) => {
      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.getTextChannel(g, channel);
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
      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.getTextChannel(g, channel);
      const msg = await ch.messages.fetch(message_id);
      const reaction = findReaction(msg, emoji);
      if (!reaction)
        return err(
          `Reaction "${emoji}" not found on this message`,
          "NOT_FOUND"
        );
      await reaction.users.remove(ctx.client.user!.id);
      return ok({ removed: true, emoji });
    }
  );

  /* ─── list_reactions ────────────────────────────────────────────── */

  mcp.tool(
    "discord_list_reactions",
    "List reactions on a message, with counts and optionally the users who reacted",
    {
      channel: z.string().describe("Channel name or ID"),
      message_id: z.string().describe("Message ID"),
      emoji: z
        .string()
        .optional()
        .describe(
          "Specific emoji to list users for (omit to list all reactions with counts)"
        ),
    },
    async ({ channel, message_id, emoji }) => {
      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.getTextChannel(g, channel);
      const msg = await ch.messages.fetch(message_id);

      if (emoji) {
        const reaction = findReaction(msg, emoji);
        if (!reaction)
          return err(
            `Reaction "${emoji}" not found on this message`,
            "NOT_FOUND"
          );
        const users = await reaction.users.fetch();
        return ok({
          emoji: reaction.emoji.toString(),
          count: reaction.count,
          users: [...users.values()].map((u: any) => ({
            id: u.id,
            username: u.username,
          })),
        });
      }

      const reactions = [...msg.reactions.cache.values()].map(
        (r: any) => ({
          emoji: r.emoji.toString(),
          emoji_name: r.emoji.name,
          count: r.count,
          me: r.me,
        })
      );
      return ok({ message_id, reactions });
    }
  );

  /* ─── clear_reactions ───────────────────────────────────────────── */

  mcp.tool(
    "discord_clear_reactions",
    "Remove all reactions from a message, or all reactions of a specific emoji. Requires confirm=true.",
    {
      channel: z.string().describe("Channel name or ID"),
      message_id: z.string().describe("Message ID"),
      emoji: z
        .string()
        .optional()
        .describe(
          "Specific emoji to clear (omit to remove ALL reactions)"
        ),
      confirm: z
        .boolean()
        .describe("Must be true to confirm clearing reactions"),
    },
    async ({ channel, message_id, emoji, confirm }) => {
      if (!confirm)
        return err(
          "Set confirm=true to clear reactions",
          "CONFIRMATION_REQUIRED"
        );

      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.getTextChannel(g, channel);
      const msg = await ch.messages.fetch(message_id);

      if (emoji) {
        const reaction = findReaction(msg, emoji);
        if (!reaction)
          return err(
            `Reaction "${emoji}" not found on this message`,
            "NOT_FOUND"
          );
        await reaction.remove();
        return ok({ cleared: true, emoji, message_id });
      }

      await msg.reactions.removeAll();
      return ok({ cleared: true, all: true, message_id });
    }
  );
}
