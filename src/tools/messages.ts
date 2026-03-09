import { AttachmentBuilder, MessageFlags, type Message } from "discord.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DiscordActionContext } from "../discord/context.js";
import { fmtMessage } from "../discord/formatters.js";
import { ok, err } from "../mcp/response.js";
import { isAllowedAttachmentUrl } from "./attachments.js";

/* ── Shared schemas ──────────────────────────────────────────── */

const embedFieldSchema = z.object({
  name: z.string().describe("Field name"),
  value: z.string().describe("Field value"),
  inline: z.boolean().optional().describe("Display inline"),
});

const embedSchema = z.object({
  title: z.string().optional().describe("Embed title"),
  description: z.string().optional().describe("Embed description"),
  url: z.string().optional().describe("URL (makes title a hyperlink)"),
  color: z
    .number()
    .optional()
    .describe("Color as decimal integer (e.g. 16711680 for red, 65280 for green)"),
  timestamp: z.string().optional().describe("ISO 8601 timestamp"),
  footer: z
    .object({
      text: z.string(),
      icon_url: z.string().optional(),
    })
    .optional()
    .describe("Footer"),
  image: z.object({ url: z.string() }).optional().describe("Image"),
  thumbnail: z.object({ url: z.string() }).optional().describe("Thumbnail"),
  author: z
    .object({
      name: z.string(),
      url: z.string().optional(),
      icon_url: z.string().optional(),
    })
    .optional()
    .describe("Author"),
  fields: z
    .array(embedFieldSchema)
    .max(25)
    .optional()
    .describe("Embed fields (max 25)"),
});

const allowedMentionsSchema = z
  .object({
    parse: z
      .array(z.enum(["roles", "users", "everyone"]))
      .optional()
      .describe("Mention types to parse from content"),
    roles: z
      .array(z.string())
      .optional()
      .describe("Specific role IDs to allow mentioning"),
    users: z
      .array(z.string())
      .optional()
      .describe("Specific user IDs to allow mentioning"),
    replied_user: z
      .boolean()
      .optional()
      .describe("Whether to ping the replied-to user"),
  })
  .optional()
  .describe(
    "Mention controls (default: @everyone/@here suppressed for safety)"
  );

/* ── File attachment schema (shared with threads.ts) ───────────── */

export const fileAttachmentSchema = z.object({
  name: z
    .string()
    .describe("Filename with extension (e.g. 'report.pdf')"),
  content_base64: z
    .string()
    .describe("File content as base64-encoded string"),
  description: z
    .string()
    .optional()
    .describe("Alt text / description for the attachment"),
});

/** Sanitize filename: strip path separators to prevent path traversal. */
function sanitizeFilename(name: string): string {
  return name.replace(/[/\\]/g, "_");
}

/** Convert file attachment params to discord.js AttachmentBuilder instances. */
function buildAttachments(
  files: { name: string; content_base64: string; description?: string }[]
): AttachmentBuilder[] {
  return files.map((f) => {
    const buf = Buffer.from(f.content_base64, "base64");
    const safeName = sanitizeFilename(f.name);
    return new AttachmentBuilder(buf, {
      name: safeName,
      description: f.description,
    });
  });
}

/** Format attachment metadata from a sent Discord message. */
function fmtAttachmentMeta(msg: Message) {
  if (!msg.attachments.size) return undefined;
  return [...msg.attachments.values()].map((a) => ({
    id: a.id,
    name: a.name,
    url: a.url,
    size: a.size,
    content_type: a.contentType,
  }));
}

/* ── Mention-safe default ─────────────────────────────────────── */

type MentionInput = {
  parse?: ("roles" | "users" | "everyone")[];
  roles?: string[];
  users?: string[];
  replied_user?: boolean;
};

function safeMentions(custom?: MentionInput) {
  if (custom) {
    return {
      parse: custom.parse,
      roles: custom.roles,
      users: custom.users,
      repliedUser: custom.replied_user,
    };
  }
  // Safe default: allow @user and @role parsing, block @everyone/@here
  return { parse: ["users" as const, "roles" as const] };
}

export function registerMessageTools(
  mcp: McpServer,
  ctx: DiscordActionContext
) {
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
        .describe(
          "Message ID — fetch messages before this (for pagination)"
        ),
      after: z
        .string()
        .optional()
        .describe("Message ID — fetch messages after this"),
      author: z
        .string()
        .optional()
        .describe(
          "Filter by author display name, username, or user ID"
        ),
    },
    async ({ channel, limit, before, after, author }) => {
      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.getTextChannel(g, channel);
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
      const member = await ctx.resolveMember(g, author);
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
          if (ctx.authorMatches(m, author, authorId)) results.push(m);
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
      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.getTextChannel(g, channel);
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
      query: z
        .string()
        .describe("Text to search for (case-insensitive)"),
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
      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.getTextChannel(g, channel);
      const cap = limit ?? 25;
      const q = query.toLowerCase();
      const member = author
        ? await ctx.resolveMember(g, author)
        : undefined;
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
          if (author && !ctx.authorMatches(m, author, authorId))
            continue;
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
    "Send a message to a channel. Supports text, embeds, file attachments, and mention controls. " +
      "By default @everyone/@here mentions are suppressed for safety.",
    {
      channel: z.string().describe("Channel name or ID"),
      content: z
        .string()
        .optional()
        .describe("Message text (required if no embeds or files)"),
      reply_to: z
        .string()
        .optional()
        .describe("Message ID to reply to"),
      embeds: z
        .array(embedSchema)
        .max(10)
        .optional()
        .describe("Rich embeds (max 10)"),
      files: z
        .array(fileAttachmentSchema)
        .max(10)
        .optional()
        .describe("File attachments (max 10). Each file needs name and base64-encoded content."),
      allowed_mentions: allowedMentionsSchema,
      suppress_embeds: z
        .boolean()
        .optional()
        .describe("Suppress link preview embeds in the message"),
      suppress_notifications: z
        .boolean()
        .optional()
        .describe("Send without triggering push notifications"),
    },
    async ({
      channel,
      content,
      reply_to,
      embeds,
      files,
      allowed_mentions,
      suppress_embeds,
      suppress_notifications,
    }) => {
      if (
        !content &&
        (!embeds || embeds.length === 0) &&
        (!files || files.length === 0)
      ) {
        return err(
          "Provide content, at least one embed, or at least one file",
          "INVALID_INPUT"
        );
      }

      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.getTextChannel(g, channel);

      const flagsList: number[] = [];
      if (suppress_embeds)
        flagsList.push(MessageFlags.SuppressEmbeds as number);
      if (suppress_notifications)
        flagsList.push(MessageFlags.SuppressNotifications as number);

      const builtFiles = files?.length ? buildAttachments(files) : undefined;

      const msg = await ch.send({
        ...(content ? { content } : {}),
        ...(embeds?.length ? { embeds } : {}),
        ...(builtFiles ? { files: builtFiles } : {}),
        allowedMentions: safeMentions(allowed_mentions),
        ...(reply_to
          ? { reply: { messageReference: reply_to } }
          : {}),
        ...(flagsList.length ? { flags: flagsList } : {}),
      });

      const attachments = fmtAttachmentMeta(msg);
      return ok({
        sent: true,
        id: msg.id,
        channel: ch.name,
        ...(attachments ? { attachments } : {}),
      });
    }
  );

  /* ─── edit_message ──────────────────────────────────────────────── */

  mcp.tool(
    "discord_edit_message",
    "Edit a message (the bot must be the author). Supports text and embeds.",
    {
      channel: z.string().describe("Channel name or ID"),
      message_id: z.string().describe("Message ID to edit"),
      content: z
        .string()
        .optional()
        .describe("New message text (omit to leave unchanged)"),
      embeds: z
        .array(embedSchema)
        .max(10)
        .optional()
        .describe(
          "New embeds (replaces existing; pass empty array to remove all embeds)"
        ),
      allowed_mentions: allowedMentionsSchema,
    },
    async ({
      channel,
      message_id,
      content,
      embeds,
      allowed_mentions,
    }) => {
      if (content === undefined && embeds === undefined) {
        return err(
          "Provide content or embeds to edit",
          "INVALID_INPUT"
        );
      }

      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.getTextChannel(g, channel);
      const msg = await ch.messages.fetch(message_id);
      await msg.edit({
        ...(content !== undefined ? { content } : {}),
        ...(embeds !== undefined ? { embeds } : {}),
        allowedMentions: safeMentions(allowed_mentions),
      });
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
      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.getTextChannel(g, channel);
      const msg = await ch.messages.fetch(message_id);
      await msg.delete();
      return ok({ deleted: true, id: message_id });
    }
  );

  /* ─── pin_message ───────────────────────────────────────────────── */

  mcp.tool(
    "discord_pin_message",
    "Pin a message in a channel (max 50 pins per channel)",
    {
      channel: z.string().describe("Channel name or ID"),
      message_id: z.string().describe("Message ID to pin"),
    },
    async ({ channel, message_id }) => {
      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.getTextChannel(g, channel);
      const msg = await ch.messages.fetch(message_id);
      await msg.pin();
      return ok({ pinned: true, id: message_id, channel: ch.name });
    }
  );

  /* ─── unpin_message ─────────────────────────────────────────────── */

  mcp.tool(
    "discord_unpin_message",
    "Unpin a message in a channel",
    {
      channel: z.string().describe("Channel name or ID"),
      message_id: z.string().describe("Message ID to unpin"),
    },
    async ({ channel, message_id }) => {
      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.getTextChannel(g, channel);
      const msg = await ch.messages.fetch(message_id);
      await msg.unpin();
      return ok({ unpinned: true, id: message_id, channel: ch.name });
    }
  );

  /* ─── list_pins ─────────────────────────────────────────────────── */

  mcp.tool(
    "discord_list_pins",
    "List all pinned messages in a channel",
    {
      channel: z.string().describe("Channel name or ID"),
    },
    async ({ channel }) => {
      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.getTextChannel(g, channel);
      const pins = await ch.messages.fetchPinned();
      return ok({
        channel: ch.name,
        count: pins.size,
        messages: [...pins.values()].map(fmtMessage),
      });
    }
  );

  /* ─── bulk_delete_messages ──────────────────────────────────────── */

  mcp.tool(
    "discord_bulk_delete_messages",
    "Bulk delete messages in a channel (2–100 messages). Messages older than 14 days " +
      "are silently skipped. Requires confirm=true.",
    {
      channel: z.string().describe("Channel name or ID"),
      message_ids: z
        .array(z.string())
        .min(2)
        .max(100)
        .describe("Message IDs to delete (2–100)"),
      confirm: z
        .boolean()
        .describe("Must be true to confirm bulk deletion"),
      audit_log_reason: z
        .string()
        .optional()
        .describe("Reason (logged locally; Discord bulk-delete has no audit reason)"),
    },
    async ({ channel, message_ids, confirm, audit_log_reason }) => {
      if (!confirm)
        return err(
          "Set confirm=true to bulk delete messages",
          "CONFIRMATION_REQUIRED"
        );

      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.getTextChannel(g, channel);
      // filterOld=true silently skips messages older than 14 days
      const deleted = await ch.bulkDelete(message_ids, true);
      return ok({
        deleted: true,
        count: deleted.size,
        message_ids: [...deleted.keys()],
        ...(audit_log_reason ? { reason: audit_log_reason } : {}),
      });
    }
  );

  /* ─── crosspost_message ─────────────────────────────────────────── */

  mcp.tool(
    "discord_crosspost_message",
    "Crosspost (publish) a message in an announcement channel to all following channels",
    {
      channel: z
        .string()
        .describe("Announcement channel name or ID"),
      message_id: z.string().describe("Message ID to crosspost"),
    },
    async ({ channel, message_id }) => {
      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.getTextChannel(g, channel);
      const msg = await ch.messages.fetch(message_id);
      const published = await msg.crosspost();
      return ok({
        crossposted: true,
        id: published.id,
        channel: ch.name,
      });
    }
  );

  /* ─── forward_message ────────────────────────────────────────────── */

  mcp.tool(
    "discord_forward_message",
    "Forward a message (text + embeds + attachments) from one channel to another within " +
      "Discord. Downloads and re-uploads attachments server-side — no base64 round-trip " +
      "through the context window.",
    {
      source_channel: z
        .string()
        .describe("Source channel name or ID"),
      message_id: z
        .string()
        .describe("ID of the message to forward"),
      target_channel: z
        .string()
        .describe("Destination channel name or ID"),
      comment: z
        .string()
        .optional()
        .describe("Optional comment prepended to the forwarded content"),
    },
    async ({ source_channel, message_id, target_channel, comment }) => {
      const g = ctx.getGuild();
      await g.channels.fetch();
      const srcCh = ctx.getTextChannel(g, source_channel);
      const dstCh = ctx.getTextChannel(g, target_channel);
      const srcMsg = await srcCh.messages.fetch(message_id);

      // Build forwarded content
      const parts: string[] = [];
      if (comment) parts.push(comment);

      const author =
        srcMsg.member?.displayName ??
        srcMsg.author.displayName ??
        srcMsg.author.username;
      parts.push(
        `> **${author}** in #${srcCh.name} (${srcMsg.createdAt.toISOString()}):`
      );
      if (srcMsg.content) parts.push(`> ${srcMsg.content.replace(/\n/g, "\n> ")}`);

      const forwardedContent = parts.join("\n");

      // Re-download attachments from CDN and build AttachmentBuilders
      const reuploadFiles: AttachmentBuilder[] = [];
      for (const att of srcMsg.attachments.values()) {
        if (!isAllowedAttachmentUrl(att.url)) continue;
        const resp = await fetch(att.url);
        if (!resp.ok) continue;
        const buf = Buffer.from(await resp.arrayBuffer());
        reuploadFiles.push(
          new AttachmentBuilder(buf, {
            name: sanitizeFilename(att.name),
            description: att.description ?? undefined,
          })
        );
      }

      // Forward embeds from the original message
      const forwardedEmbeds = srcMsg.embeds.map((e) => e.toJSON());

      const sent = await dstCh.send({
        content: forwardedContent,
        ...(forwardedEmbeds.length ? { embeds: forwardedEmbeds } : {}),
        ...(reuploadFiles.length ? { files: reuploadFiles } : {}),
        allowedMentions: safeMentions(),
      });

      const attachments = fmtAttachmentMeta(sent);
      return ok({
        forwarded: true,
        id: sent.id,
        source_channel: srcCh.name,
        source_message_id: srcMsg.id,
        target_channel: dstCh.name,
        ...(attachments ? { attachments } : {}),
      });
    }
  );
}
