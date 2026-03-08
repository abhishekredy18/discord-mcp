import { ChannelType, OverwriteType, PermissionFlagsBits } from "discord.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DiscordActionContext } from "../discord/context.js";
import { fmtChannel } from "../discord/formatters.js";
import { ok, err } from "../mcp/response.js";

/* ── Permission name validation ────────────────────────────────── */

const VALID_PERMISSIONS = new Set(Object.keys(PermissionFlagsBits));

const COMMON_PERMISSIONS_DESC =
  "Permission names (PascalCase): ViewChannel, SendMessages, ManageChannels, " +
  "ManageMessages, EmbedLinks, AttachFiles, ReadMessageHistory, MentionEveryone, " +
  "Connect, Speak, MuteMembers, ManageRoles, ManageWebhooks, CreatePublicThreads, " +
  "CreatePrivateThreads, SendMessagesInThreads, ManageThreads, AddReactions, Administrator";

function validatePermissionNames(names: string[]): string | null {
  for (const n of names) {
    if (!VALID_PERMISSIONS.has(n)) return `Unknown permission: "${n}"`;
  }
  return null;
}

export function registerChannelTools(mcp: McpServer, ctx: DiscordActionContext) {

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
      const g = ctx.getGuild();
      await g.channels.fetch();
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
      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.resolveChannel(g, channel);
      if (!ch) return err(`Channel "${channel}" not found`, "NOT_FOUND");
      return ok(fmtChannel(ch));
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
      const g = ctx.getGuild();
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
        const pCh = ctx.resolveChannel(g, parent);
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

  /* ─── modify_channel ────────────────────────────────────────────── */

  mcp.tool(
    "discord_modify_channel",
    "Modify a channel's settings (name, topic, nsfw, slowmode, position, parent, bitrate, user limit)",
    {
      channel: z.string().describe("Channel name or ID"),
      name: z.string().optional().describe("New channel name"),
      topic: z
        .string()
        .optional()
        .describe("New channel topic (text/announcement/forum channels)"),
      nsfw: z.boolean().optional().describe("Set NSFW flag"),
      slowmode: z
        .number()
        .min(0)
        .max(21600)
        .optional()
        .describe("Slowmode in seconds (0 to disable)"),
      parent: z
        .string()
        .optional()
        .describe("Move to category (name or ID, or empty string to remove from category)"),
      position: z.number().optional().describe("Channel position"),
      bitrate: z
        .number()
        .optional()
        .describe("Bitrate for voice channels (8000–384000)"),
      user_limit: z
        .number()
        .min(0)
        .max(99)
        .optional()
        .describe("User limit for voice channels (0 = unlimited)"),
      audit_log_reason: z
        .string()
        .optional()
        .describe("Reason for the audit log"),
    },
    async ({
      channel,
      name,
      topic,
      nsfw,
      slowmode,
      parent,
      position,
      bitrate,
      user_limit,
      audit_log_reason,
    }) => {
      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.resolveChannel(g, channel);
      if (!ch) return err(`Channel "${channel}" not found`, "NOT_FOUND");

      const editData: Record<string, unknown> = {};
      if (name !== undefined) editData.name = name;
      if (topic !== undefined) editData.topic = topic;
      if (nsfw !== undefined) editData.nsfw = nsfw;
      if (slowmode !== undefined) editData.rateLimitPerUser = slowmode;
      if (position !== undefined) editData.position = position;
      if (bitrate !== undefined) editData.bitrate = bitrate;
      if (user_limit !== undefined) editData.userLimit = user_limit;
      if (parent !== undefined) {
        if (parent === "") {
          editData.parent = null;
        } else {
          const pCh = ctx.resolveChannel(g, parent);
          editData.parent = pCh?.id ?? parent;
        }
      }
      if (audit_log_reason) editData.reason = audit_log_reason;

      await (ch as any).edit(editData);

      const updated = await g.channels.fetch(ch.id);
      return ok(fmtChannel(updated ?? ch));
    }
  );

  /* ─── delete_channel ────────────────────────────────────────────── */

  mcp.tool(
    "discord_delete_channel",
    "Delete a channel. Requires confirm=true to prevent accidents.",
    {
      channel: z.string().describe("Channel name or ID"),
      confirm: z
        .boolean()
        .describe("Must be true to confirm deletion"),
      audit_log_reason: z
        .string()
        .optional()
        .describe("Reason for the audit log"),
    },
    async ({ channel, confirm, audit_log_reason }) => {
      if (!confirm)
        return err(
          "Set confirm=true to delete the channel",
          "CONFIRMATION_REQUIRED"
        );

      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.resolveChannel(g, channel);
      if (!ch) return err(`Channel "${channel}" not found`, "NOT_FOUND");

      const info = fmtChannel(ch);
      await ch.delete(audit_log_reason);
      return ok({ deleted: true, channel: info });
    }
  );

  /* ─── reorder_channels ──────────────────────────────────────────── */

  mcp.tool(
    "discord_reorder_channels",
    "Reorder channels by setting their positions",
    {
      channels: z
        .array(
          z.object({
            channel: z.string().describe("Channel name or ID"),
            position: z.number().describe("New position"),
            parent: z
              .string()
              .optional()
              .describe("Move into this category (name or ID)"),
          })
        )
        .describe("Array of channel/position pairs"),
    },
    async ({ channels }) => {
      const g = ctx.getGuild();
      await g.channels.fetch();

      const positions = channels.map((c) => {
        const ch = ctx.resolveChannel(g, c.channel);
        if (!ch)
          throw new Error(`Channel "${c.channel}" not found`);
        let parentId: string | undefined;
        if (c.parent) {
          const pCh = ctx.resolveChannel(g, c.parent);
          parentId = pCh?.id ?? c.parent;
        }
        return {
          channel: ch.id,
          position: c.position,
          ...(parentId !== undefined ? { parent: parentId } : {}),
        };
      });

      await g.channels.setPositions(positions);
      return ok({
        reordered: true,
        count: positions.length,
        channels: positions.map((p) => ({
          channel: p.channel,
          position: p.position,
        })),
      });
    }
  );

  /* ─── set_channel_permissions ────────────────────────────────────── */

  mcp.tool(
    "discord_set_channel_permissions",
    "Set permission overwrites on a channel for a role or user",
    {
      channel: z.string().describe("Channel name or ID"),
      target: z
        .string()
        .describe("Role name/ID or user name/ID"),
      target_type: z
        .enum(["role", "user"])
        .describe("Whether the target is a role or user"),
      allow: z
        .array(z.string())
        .optional()
        .describe(`Permissions to allow. ${COMMON_PERMISSIONS_DESC}`),
      deny: z
        .array(z.string())
        .optional()
        .describe("Permissions to deny (same names as allow)"),
      audit_log_reason: z
        .string()
        .optional()
        .describe("Reason for the audit log"),
    },
    async ({ channel, target, target_type, allow, deny, audit_log_reason }) => {
      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.resolveChannel(g, channel);
      if (!ch) return err(`Channel "${channel}" not found`, "NOT_FOUND");

      // Validate permission names
      const allPerms = [...(allow ?? []), ...(deny ?? [])];
      if (allPerms.length === 0) {
        return err("Provide at least one permission in allow or deny", "INVALID_INPUT");
      }
      const invalid = validatePermissionNames(allPerms);
      if (invalid) return err(invalid, "INVALID_PERMISSION");

      // Resolve target
      let targetId: string;
      let targetName: string;
      if (target_type === "role") {
        await g.roles.fetch();
        const role = ctx.resolveRole(g, target);
        if (!role) return err(`Role "${target}" not found`, "NOT_FOUND");
        targetId = role.id;
        targetName = role.name;
      } else {
        const member = await ctx.resolveMember(g, target);
        if (!member) return err(`Member "${target}" not found`, "NOT_FOUND");
        targetId = member.id;
        targetName = member.user.username;
      }

      // Build permission object
      const perms: Record<string, boolean | null> = {};
      for (const p of allow ?? []) perms[p] = true;
      for (const p of deny ?? []) perms[p] = false;

      await (ch as any).permissionOverwrites.edit(targetId, perms, {
        reason: audit_log_reason,
        type:
          target_type === "role"
            ? OverwriteType.Role
            : OverwriteType.Member,
      });

      return ok({
        channel: ch.name,
        target: targetName,
        target_type,
        allowed: allow ?? [],
        denied: deny ?? [],
      });
    }
  );

  /* ─── delete_channel_permissions ─────────────────────────────────── */

  mcp.tool(
    "discord_delete_channel_permissions",
    "Remove all permission overwrites for a role or user on a channel",
    {
      channel: z.string().describe("Channel name or ID"),
      target: z
        .string()
        .describe("Role name/ID or user name/ID"),
      target_type: z
        .enum(["role", "user"])
        .describe("Whether the target is a role or user"),
      confirm: z
        .boolean()
        .describe("Must be true to confirm deletion"),
      audit_log_reason: z
        .string()
        .optional()
        .describe("Reason for the audit log"),
    },
    async ({ channel, target, target_type, confirm, audit_log_reason }) => {
      if (!confirm)
        return err(
          "Set confirm=true to delete the permission overwrite",
          "CONFIRMATION_REQUIRED"
        );

      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.resolveChannel(g, channel);
      if (!ch) return err(`Channel "${channel}" not found`, "NOT_FOUND");

      // Resolve target
      let targetId: string;
      let targetName: string;
      if (target_type === "role") {
        await g.roles.fetch();
        const role = ctx.resolveRole(g, target);
        if (!role) return err(`Role "${target}" not found`, "NOT_FOUND");
        targetId = role.id;
        targetName = role.name;
      } else {
        const member = await ctx.resolveMember(g, target);
        if (!member) return err(`Member "${target}" not found`, "NOT_FOUND");
        targetId = member.id;
        targetName = member.user.username;
      }

      await (ch as any).permissionOverwrites.delete(targetId, audit_log_reason);

      return ok({
        deleted: true,
        channel: ch.name,
        target: targetName,
        target_type,
      });
    }
  );

  /* ─── clone_channel ─────────────────────────────────────────────── */

  mcp.tool(
    "discord_clone_channel",
    "Clone an existing channel (copies settings and permission overwrites)",
    {
      channel: z.string().describe("Channel name or ID to clone"),
      name: z
        .string()
        .optional()
        .describe("Name for the cloned channel (defaults to original name)"),
      audit_log_reason: z
        .string()
        .optional()
        .describe("Reason for the audit log"),
    },
    async ({ channel, name, audit_log_reason }) => {
      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.resolveChannel(g, channel);
      if (!ch) return err(`Channel "${channel}" not found`, "NOT_FOUND");

      const cloned = await (ch as any).clone({
        ...(name ? { name } : {}),
        reason: audit_log_reason,
      });

      return ok({
        cloned: true,
        original: fmtChannel(ch),
        new_channel: fmtChannel(cloned),
      });
    }
  );
}
