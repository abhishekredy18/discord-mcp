import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DiscordActionContext } from "../discord/context.js";
import { fmtMessage } from "../discord/formatters.js";
import { ok, err } from "../mcp/response.js";

export function registerAttachmentTools(mcp: McpServer, ctx: DiscordActionContext) {

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
      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.getTextChannel(g, channel);
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
        return err("Only Discord HTTPS attachment URLs are allowed", "INVALID_URL");
      }
      const resp = await fetch(url);
      if (!resp.ok) return err(`Download failed: ${resp.status} ${resp.statusText}`, "DOWNLOAD_FAILED");
      const text = await resp.text();
      return ok({ url, size: text.length, content: text });
    }
  );
}
