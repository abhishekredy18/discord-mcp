import {
  AttachmentBuilder,
  ChannelType,
  ForumLayoutType,
  SortOrderType,
  type ForumChannel,
  type Guild,
  type ThreadChannel,
} from "discord.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DiscordActionContext } from "../discord/context.js";
import { fmtEmbed, fmtThread } from "../discord/formatters.js";
import { ok, err } from "../mcp/response.js";
import { fileAttachmentSchema } from "./messages.js";

/* ── Thread resolution helper ──────────────────────────────────── */

async function resolveThread(
  g: Guild,
  threadIdOrName: string
): Promise<ThreadChannel | undefined> {
  // Try by ID first
  try {
    const ch = await g.channels.fetch(threadIdOrName);
    if (ch?.isThread()) return ch as ThreadChannel;
  } catch { /* not found by ID */ }

  // Try by name in active threads
  const active = await g.channels.fetchActiveThreads();
  const lower = threadIdOrName.toLowerCase();
  return active.threads.find((t) => t.name.toLowerCase() === lower);
}

/* ── Auto-archive duration type helper ─────────────────────────── */

const archiveDurationSchema = z
  .enum(["60", "1440", "4320", "10080"])
  .optional()
  .describe(
    "Auto-archive after minutes of inactivity: 60 (1h), 1440 (1d), 4320 (3d), 10080 (7d)"
  );

type ArchiveDuration = 60 | 1440 | 4320 | 10080;

function parseArchiveDuration(v: string | undefined): ArchiveDuration | undefined {
  if (!v) return undefined;
  return Number(v) as ArchiveDuration;
}

/* ── Tool registration ─────────────────────────────────────────── */

export function registerThreadTools(mcp: McpServer, ctx: DiscordActionContext) {

  /* ─── list_threads ──────────────────────────────────────────────── */

  mcp.tool(
    "discord_list_threads",
    "List active threads in the server, optionally filtered to a specific channel",
    {
      channel: z
        .string()
        .optional()
        .describe("Parent channel name or ID to filter threads"),
    },
    async ({ channel }) => {
      const g = ctx.getGuild();
      const active = await g.channels.fetchActiveThreads();
      let threads = [...active.threads.values()];

      if (channel) {
        await g.channels.fetch();
        const parent = ctx.resolveChannel(g, channel);
        if (!parent) return err(`Channel "${channel}" not found`, "NOT_FOUND");
        threads = threads.filter((t) => t.parentId === parent.id);
      }

      return ok(threads.map(fmtThread));
    }
  );

  /* ─── get_thread ────────────────────────────────────────────────── */

  mcp.tool(
    "discord_get_thread",
    "Get thread details by ID or name",
    {
      thread: z.string().describe("Thread ID or name"),
    },
    async ({ thread }) => {
      const g = ctx.getGuild();
      const t = await resolveThread(g, thread);
      if (!t) return err(`Thread "${thread}" not found`, "NOT_FOUND");
      return ok(fmtThread(t));
    }
  );

  /* ─── start_thread_from_message ─────────────────────────────────── */

  mcp.tool(
    "discord_start_thread_from_message",
    "Start a new thread from an existing message",
    {
      channel: z
        .string()
        .describe("Channel name or ID containing the message"),
      message_id: z.string().describe("Message ID to start the thread from"),
      name: z.string().describe("Thread name"),
      auto_archive_duration: archiveDurationSchema,
    },
    async ({ channel, message_id, name, auto_archive_duration }) => {
      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.getTextChannel(g, channel);
      const msg = await ch.messages.fetch(message_id);
      const thread = await msg.startThread({
        name,
        ...(auto_archive_duration
          ? { autoArchiveDuration: parseArchiveDuration(auto_archive_duration) }
          : {}),
      });
      return ok(fmtThread(thread));
    }
  );

  /* ─── start_thread ──────────────────────────────────────────────── */

  mcp.tool(
    "discord_start_thread",
    "Start a new thread in a channel (without a starter message)",
    {
      channel: z.string().describe("Channel name or ID"),
      name: z.string().describe("Thread name"),
      type: z
        .enum(["public", "private"])
        .optional()
        .describe("Thread type (default: public)"),
      auto_archive_duration: archiveDurationSchema,
    },
    async ({ channel, name, type, auto_archive_duration }) => {
      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.getTextChannel(g, channel);
      const threadType =
        type === "private"
          ? ChannelType.PrivateThread
          : ChannelType.PublicThread;
      const thread = await ch.threads.create({
        name,
        type: threadType,
        ...(auto_archive_duration
          ? { autoArchiveDuration: parseArchiveDuration(auto_archive_duration) }
          : {}),
      });
      return ok(fmtThread(thread));
    }
  );

  /* ─── create_forum_post ─────────────────────────────────────────── */

  mcp.tool(
    "discord_create_forum_post",
    "Create a new post in a forum channel. Supports file attachments. " +
      "Returns the created thread and starter message with attachment metadata.",
    {
      channel: z.string().describe("Forum channel name or ID"),
      name: z.string().describe("Post title"),
      content: z.string().describe("Post body (starter message content)"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Tag names or IDs to apply to the post"),
      files: z
        .array(fileAttachmentSchema)
        .max(10)
        .optional()
        .describe("File attachments for the starter message (max 10)"),
      auto_archive_duration: archiveDurationSchema,
    },
    async ({ channel, name, content, tags, files, auto_archive_duration }) => {
      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.resolveChannel(g, channel);
      if (!ch || ch.type !== ChannelType.GuildForum) {
        return err(`Forum channel "${channel}" not found`, "NOT_FOUND");
      }
      const forum = ch as unknown as ForumChannel;

      // Resolve tag names to IDs
      let appliedTags: string[] | undefined;
      if (tags?.length) {
        const availableTags = forum.availableTags;
        appliedTags = tags
          .map((t) => {
            const found = availableTags.find(
              (at) =>
                at.id === t || at.name.toLowerCase() === t.toLowerCase()
            );
            return found?.id ?? t;
          })
          .filter(Boolean);
      }

      // Build file attachments
      let builtFiles: AttachmentBuilder[] | undefined;
      if (files?.length) {
        builtFiles = files.map((f) => {
          const buf = Buffer.from(f.content_base64, "base64");
          const safeName = f.name.replace(/[/\\]/g, "_");
          return new AttachmentBuilder(buf, {
            name: safeName,
            description: f.description,
          });
        });
      }

      const thread = await forum.threads.create({
        name,
        message: {
          content,
          ...(builtFiles ? { files: builtFiles } : {}),
        },
        ...(appliedTags?.length ? { appliedTags } : {}),
        ...(auto_archive_duration
          ? { autoArchiveDuration: parseArchiveDuration(auto_archive_duration) }
          : {}),
      });

      const starter = await thread.fetchStarterMessage();

      // Format attachment metadata from starter message
      const attachments = starter?.attachments.size
        ? [...starter.attachments.values()].map((a) => ({
            id: a.id,
            name: a.name,
            url: a.url,
            size: a.size,
            content_type: a.contentType,
          }))
        : undefined;

      return ok({
        thread: fmtThread(thread),
        starter_message: starter
          ? {
              id: starter.id,
              content: starter.content,
              author: starter.author.username,
              timestamp: starter.createdAt.toISOString(),
              ...(attachments ? { attachments } : {}),
              ...(starter.embeds.length > 0
                ? { embeds: starter.embeds.map(fmtEmbed) }
                : {}),
            }
          : null,
      });
    }
  );

  /* ─── list_archived_threads ─────────────────────────────────────── */

  mcp.tool(
    "discord_list_archived_threads",
    "List archived threads in a channel (public, private, or joined-private)",
    {
      channel: z.string().describe("Channel name or ID"),
      type: z
        .enum(["public", "private", "joined_private"])
        .optional()
        .describe("Archive type to list (default: public)"),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Max threads to return (default 25)"),
      before: z
        .string()
        .optional()
        .describe("Thread ID for pagination (fetch threads archived before this)"),
    },
    async ({ channel, type, limit, before }) => {
      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.resolveChannel(g, channel);

      // Accept text, announcement, and forum channels
      const threadableTypes = [
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.GuildForum,
        ChannelType.GuildMedia,
      ];
      if (!ch || !threadableTypes.includes(ch.type)) {
        return err(
          `Channel "${channel}" not found or does not support threads`,
          "INVALID_CHANNEL"
        );
      }

      const archiveType = type ?? "public";

      // Build fetch options
      let fetchType: "public" | "private";
      let fetchAll: boolean;
      if (archiveType === "public") {
        fetchType = "public";
        fetchAll = false;
      } else if (archiveType === "private") {
        fetchType = "private";
        fetchAll = true;
      } else {
        // joined_private
        fetchType = "private";
        fetchAll = false;
      }

      const archived = await (ch as any).threads.fetchArchived({
        type: fetchType,
        fetchAll,
        limit: limit ?? 25,
        ...(before ? { before } : {}),
      });

      return ok({
        channel: ch.name,
        type: archiveType,
        count: archived.threads.size,
        has_more: archived.hasMore,
        threads: [...archived.threads.values()].map((t: ThreadChannel) =>
          fmtThread(t)
        ),
      });
    }
  );

  /* ─── join_thread ───────────────────────────────────────────────── */

  mcp.tool(
    "discord_join_thread",
    "Make the bot join a thread",
    {
      thread: z.string().describe("Thread ID or name"),
    },
    async ({ thread }) => {
      const g = ctx.getGuild();
      const t = await resolveThread(g, thread);
      if (!t) return err(`Thread "${thread}" not found`, "NOT_FOUND");
      await t.join();
      return ok({ joined: true, thread: t.name, id: t.id });
    }
  );

  /* ─── leave_thread ──────────────────────────────────────────────── */

  mcp.tool(
    "discord_leave_thread",
    "Make the bot leave a thread",
    {
      thread: z.string().describe("Thread ID or name"),
    },
    async ({ thread }) => {
      const g = ctx.getGuild();
      const t = await resolveThread(g, thread);
      if (!t) return err(`Thread "${thread}" not found`, "NOT_FOUND");
      await t.leave();
      return ok({ left: true, thread: t.name, id: t.id });
    }
  );

  /* ─── add_thread_member ─────────────────────────────────────────── */

  mcp.tool(
    "discord_add_thread_member",
    "Add a user to a thread",
    {
      thread: z.string().describe("Thread ID or name"),
      user: z.string().describe("Username, display name, or user ID"),
    },
    async ({ thread, user }) => {
      const g = ctx.getGuild();
      const t = await resolveThread(g, thread);
      if (!t) return err(`Thread "${thread}" not found`, "NOT_FOUND");
      const member = await ctx.resolveMember(g, user);
      if (!member) return err(`Member "${user}" not found`, "NOT_FOUND");
      await t.members.add(member.id);
      return ok({
        added: true,
        thread: t.name,
        user: member.user.username,
      });
    }
  );

  /* ─── remove_thread_member ──────────────────────────────────────── */

  mcp.tool(
    "discord_remove_thread_member",
    "Remove a user from a thread",
    {
      thread: z.string().describe("Thread ID or name"),
      user: z.string().describe("Username, display name, or user ID"),
    },
    async ({ thread, user }) => {
      const g = ctx.getGuild();
      const t = await resolveThread(g, thread);
      if (!t) return err(`Thread "${thread}" not found`, "NOT_FOUND");
      const member = await ctx.resolveMember(g, user);
      if (!member) return err(`Member "${user}" not found`, "NOT_FOUND");
      await t.members.remove(member.id);
      return ok({
        removed: true,
        thread: t.name,
        user: member.user.username,
      });
    }
  );

  /* ─── list_thread_members ───────────────────────────────────────── */

  mcp.tool(
    "discord_list_thread_members",
    "List members of a thread",
    {
      thread: z.string().describe("Thread ID or name"),
    },
    async ({ thread }) => {
      const g = ctx.getGuild();
      const t = await resolveThread(g, thread);
      if (!t) return err(`Thread "${thread}" not found`, "NOT_FOUND");
      const members = await t.members.fetch();
      return ok({
        thread: t.name,
        count: members.size,
        members: [...members.values()].map((m) => ({
          id: m.id,
          user_id: m.user?.id ?? m.id,
          username: m.user?.username,
          joined_at: m.joinedAt?.toISOString(),
        })),
      });
    }
  );

  /* ─── update_thread ─────────────────────────────────────────────── */

  mcp.tool(
    "discord_update_thread",
    "Update thread settings (name, archived, locked, auto-archive, slowmode)",
    {
      thread: z.string().describe("Thread ID or name"),
      name: z.string().optional().describe("New thread name"),
      archived: z.boolean().optional().describe("Set archived state"),
      locked: z.boolean().optional().describe("Set locked state"),
      auto_archive_duration: archiveDurationSchema,
      slowmode: z
        .number()
        .min(0)
        .max(21600)
        .optional()
        .describe("Slowmode in seconds (0 to disable, max 21600)"),
    },
    async ({ thread, name, archived, locked, auto_archive_duration, slowmode }) => {
      const g = ctx.getGuild();
      const t = await resolveThread(g, thread);
      if (!t) return err(`Thread "${thread}" not found`, "NOT_FOUND");

      await t.edit({
        ...(name !== undefined ? { name } : {}),
        ...(archived !== undefined ? { archived } : {}),
        ...(locked !== undefined ? { locked } : {}),
        ...(auto_archive_duration
          ? { autoArchiveDuration: parseArchiveDuration(auto_archive_duration) }
          : {}),
        ...(slowmode !== undefined ? { rateLimitPerUser: slowmode } : {}),
      });

      // Re-fetch to get updated state
      const updated = await resolveThread(g, t.id);
      return ok(fmtThread(updated ?? t));
    }
  );

  /* ─── update_forum_channel ──────────────────────────────────────── */

  mcp.tool(
    "discord_update_forum_channel",
    "Update forum channel settings (tags, default reaction, sort order, layout, thread slowmode)",
    {
      channel: z.string().describe("Forum channel name or ID"),
      tags: z
        .array(
          z.object({
            name: z.string().describe("Tag name"),
            moderated: z
              .boolean()
              .optional()
              .describe("Whether only moderators can apply this tag"),
            emoji: z
              .string()
              .optional()
              .describe("Emoji character or custom emoji ID"),
          })
        )
        .optional()
        .describe("Replace available tags (set the full list)"),
      default_reaction_emoji: z
        .string()
        .optional()
        .describe("Default reaction emoji for new posts"),
      sort_order: z
        .enum(["latest_activity", "creation_date"])
        .optional()
        .describe("Default sort order for posts"),
      layout: z
        .enum(["not_set", "list", "gallery"])
        .optional()
        .describe("Default forum layout"),
      default_thread_slowmode: z
        .number()
        .min(0)
        .max(21600)
        .optional()
        .describe("Default slowmode for new threads in seconds"),
    },
    async ({
      channel,
      tags,
      default_reaction_emoji,
      sort_order,
      layout,
      default_thread_slowmode,
    }) => {
      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.resolveChannel(g, channel);
      if (!ch || ch.type !== ChannelType.GuildForum) {
        return err(`Forum channel "${channel}" not found`, "NOT_FOUND");
      }
      const forum = ch as unknown as ForumChannel;

      const sortMap: Record<string, SortOrderType> = {
        latest_activity: SortOrderType.LatestActivity,
        creation_date: SortOrderType.CreationDate,
      };

      const layoutMap: Record<string, ForumLayoutType> = {
        not_set: ForumLayoutType.NotSet,
        list: ForumLayoutType.ListView,
        gallery: ForumLayoutType.GalleryView,
      };

      const editData: Record<string, unknown> = {};

      if (tags) {
        editData.availableTags = tags.map((t) => ({
          name: t.name,
          moderated: t.moderated ?? false,
          ...(t.emoji
            ? {
                emoji: t.emoji.match(/^\d+$/)
                  ? { id: t.emoji, name: null }
                  : { id: null, name: t.emoji },
              }
            : {}),
        }));
      }

      if (default_reaction_emoji) {
        editData.defaultReactionEmoji = default_reaction_emoji.match(/^\d+$/)
          ? { id: default_reaction_emoji, name: null }
          : { id: null, name: default_reaction_emoji };
      }

      if (sort_order) {
        editData.defaultSortOrder = sortMap[sort_order];
      }

      if (layout) {
        editData.defaultForumLayout = layoutMap[layout];
      }

      if (default_thread_slowmode !== undefined) {
        editData.defaultThreadRateLimitPerUser = default_thread_slowmode;
      }

      await forum.edit(editData);

      return ok({
        id: forum.id,
        name: forum.name,
        tags: forum.availableTags.map((t) => ({
          id: t.id,
          name: t.name,
          moderated: t.moderated,
          emoji: t.emoji,
        })),
        default_sort_order: forum.defaultSortOrder,
        default_layout: forum.defaultForumLayout,
        default_thread_slowmode: forum.defaultThreadRateLimitPerUser,
      });
    }
  );
}
