import {
  PermissionFlagsBits,
  PermissionsBitField,
  OverwriteType,
} from "discord.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DiscordActionContext } from "../discord/context.js";
import { ok, err } from "../mcp/response.js";

/* ── Permission metadata ──────────────────────────────────────── */

const PERMISSION_NAMES = Object.keys(
  PermissionFlagsBits
) as (keyof typeof PermissionFlagsBits)[];
const VALID_PERMISSIONS = new Set<string>(PERMISSION_NAMES);

const COMMON_PERMISSIONS_DESC =
  "Permission names (PascalCase): ViewChannel, SendMessages, ManageChannels, " +
  "ManageMessages, EmbedLinks, AttachFiles, ReadMessageHistory, MentionEveryone, " +
  "Connect, Speak, MuteMembers, ManageRoles, ManageWebhooks, Administrator, etc.";

function flagFor(name: string): bigint {
  return PermissionFlagsBits[name as keyof typeof PermissionFlagsBits];
}

export function registerPermissionTools(
  mcp: McpServer,
  ctx: DiscordActionContext
) {
  /* ─── check_permissions ─────────────────────────────────────────── */

  mcp.tool(
    "discord_check_permissions",
    "Check what permissions a user or role has in a specific channel. " +
      "Defaults to checking the bot itself if no user or role is specified.",
    {
      channel: z.string().describe("Channel name or ID"),
      user: z
        .string()
        .optional()
        .describe("User name or ID (default: the bot)"),
      role: z
        .string()
        .optional()
        .describe("Role name or ID (alternative to user)"),
      permissions: z
        .array(z.string())
        .optional()
        .describe(
          `Specific permissions to check (omit for all). ${COMMON_PERMISSIONS_DESC}`
        ),
    },
    async ({ channel, user, role, permissions }) => {
      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.resolveChannel(g, channel);
      if (!ch) return err(`Channel "${channel}" not found`, "NOT_FOUND");
      if (!("permissionsFor" in ch)) {
        return err(
          "This channel type does not support permission checks",
          "INVALID_INPUT"
        );
      }

      if (permissions) {
        for (const p of permissions) {
          if (!VALID_PERMISSIONS.has(p))
            return err(`Unknown permission: "${p}"`, "INVALID_PERMISSION");
        }
      }

      let target: any;
      let targetDesc: string;

      if (role) {
        await g.roles.fetch();
        const r = ctx.resolveRole(g, role);
        if (!r) return err(`Role "${role}" not found`, "NOT_FOUND");
        target = r;
        targetDesc = `role:${r.name}`;
      } else if (user) {
        const m = await ctx.resolveMember(g, user);
        if (!m) return err(`Member "${user}" not found`, "NOT_FOUND");
        target = m;
        targetDesc = `user:${m.user.username}`;
      } else {
        const botMember = await g.members.fetch(ctx.client.user!.id);
        target = botMember;
        targetDesc = `bot:${botMember.user.username}`;
      }

      const computed = (ch as any).permissionsFor(
        target
      ) as PermissionsBitField;

      const permsToCheck = permissions ?? (PERMISSION_NAMES as string[]);
      const results: Record<string, boolean> = {};
      for (const p of permsToCheck) {
        const flag = flagFor(p);
        if (flag !== undefined) {
          results[p] = computed.has(flag);
        }
      }

      const allowed = Object.entries(results)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const denied = Object.entries(results)
        .filter(([, v]) => !v)
        .map(([k]) => k);

      return ok({
        channel: ch.name,
        target: targetDesc,
        allowed,
        denied,
        permissions: results,
      });
    }
  );

  /* ─── get_effective_overwrites ──────────────────────────────────── */

  mcp.tool(
    "discord_get_effective_overwrites",
    "List all permission overwrites on a channel — shows what each role/user has explicitly allowed or denied",
    {
      channel: z.string().describe("Channel name or ID"),
    },
    async ({ channel }) => {
      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.resolveChannel(g, channel);
      if (!ch) return err(`Channel "${channel}" not found`, "NOT_FOUND");
      if (!("permissionOverwrites" in ch)) {
        return err(
          "This channel type does not have permission overwrites",
          "INVALID_INPUT"
        );
      }

      await g.roles.fetch();
      const overwrites = [
        ...(ch as any).permissionOverwrites.cache.values(),
      ];

      const results = overwrites.map((ow: any) => {
        const allowBits = new PermissionsBitField(ow.allow);
        const denyBits = new PermissionsBitField(ow.deny);

        const allowed: string[] = [];
        const denied: string[] = [];
        for (const p of PERMISSION_NAMES) {
          const flag = flagFor(p);
          if (allowBits.has(flag)) allowed.push(p);
          if (denyBits.has(flag)) denied.push(p);
        }

        let targetName: string;
        if (ow.type === OverwriteType.Role) {
          const r = g.roles.cache.get(ow.id);
          targetName = r ? r.name : ow.id;
        } else {
          const m = g.members.cache.get(ow.id);
          targetName = m ? m.user.username : ow.id;
        }

        return {
          target_id: ow.id,
          target_name: targetName,
          target_type:
            ow.type === OverwriteType.Role ? "role" : "user",
          allowed,
          denied,
        };
      });

      return ok({
        channel: ch.name,
        overwrite_count: results.length,
        overwrites: results,
      });
    }
  );

  /* ─── explain_permission_denial ─────────────────────────────────── */

  mcp.tool(
    "discord_explain_permission_denial",
    "Explain step-by-step why a user does or doesn't have a specific permission " +
      "in a channel, walking through the Discord permission hierarchy",
    {
      channel: z.string().describe("Channel name or ID"),
      user: z.string().describe("User name or ID"),
      permission: z
        .string()
        .describe(`Permission to explain. ${COMMON_PERMISSIONS_DESC}`),
    },
    async ({ channel, user, permission }) => {
      if (!VALID_PERMISSIONS.has(permission)) {
        return err(
          `Unknown permission: "${permission}"`,
          "INVALID_PERMISSION"
        );
      }
      const flag = flagFor(permission);

      const g = ctx.getGuild();
      await g.channels.fetch();
      const ch = ctx.resolveChannel(g, channel);
      if (!ch) return err(`Channel "${channel}" not found`, "NOT_FOUND");
      if (
        !("permissionsFor" in ch) ||
        !("permissionOverwrites" in ch)
      ) {
        return err(
          "This channel type does not support permission checks",
          "INVALID_INPUT"
        );
      }

      const member = await ctx.resolveMember(g, user);
      if (!member)
        return err(`Member "${user}" not found`, "NOT_FOUND");

      await g.roles.fetch();

      const steps: string[] = [];

      // Step 1: Owner check
      if (g.ownerId === member.id) {
        steps.push(
          "[OWNER] User is the server owner — all permissions granted"
        );
        return ok({
          channel: ch.name,
          user: member.user.username,
          permission,
          result: true,
          reason: "Server owner has all permissions",
          steps,
        });
      }
      steps.push(
        `[INFO] User "${member.user.username}" is not the server owner`
      );

      // Step 2: Administrator check
      const memberRoles = [...member.roles.cache.values()];
      const hasAdmin = memberRoles.some((r) =>
        r.permissions.has(PermissionFlagsBits.Administrator)
      );
      if (hasAdmin) {
        const adminRole = memberRoles.find((r) =>
          r.permissions.has(PermissionFlagsBits.Administrator)
        );
        steps.push(
          `[ADMIN] Role "${adminRole!.name}" has Administrator — all permissions granted`
        );
        return ok({
          channel: ch.name,
          user: member.user.username,
          permission,
          result: true,
          reason: "Administrator permission grants all permissions",
          steps,
        });
      }
      steps.push("[INFO] User does not have Administrator");

      // Step 3: Server-level role permissions
      const grantingRoles: string[] = [];
      for (const r of memberRoles) {
        if (r.permissions.has(flag)) {
          grantingRoles.push(r.name);
        }
      }
      if (grantingRoles.length > 0) {
        steps.push(
          `[GRANT] Server-level: roles [${grantingRoles.join(", ")}] grant ${permission}`
        );
      } else {
        steps.push(
          `[DENY] Server-level: no role grants ${permission}`
        );
      }

      // Step 4: Channel overwrites
      const overwrites = (ch as any).permissionOverwrites?.cache;
      if (overwrites) {
        // @everyone overwrite
        const everyoneOw = overwrites.get(g.id);
        if (everyoneOw) {
          const evAllow = new PermissionsBitField(everyoneOw.allow);
          const evDeny = new PermissionsBitField(everyoneOw.deny);
          if (evDeny.has(flag)) {
            steps.push(
              `[DENY] @everyone channel overwrite denies ${permission}`
            );
          } else if (evAllow.has(flag)) {
            steps.push(
              `[GRANT] @everyone channel overwrite allows ${permission}`
            );
          } else {
            steps.push(
              `[NEUTRAL] @everyone channel overwrite: no effect on ${permission}`
            );
          }
        }

        // Role overwrites
        for (const r of memberRoles) {
          if (r.id === g.id) continue;
          const ow = overwrites.get(r.id);
          if (!ow) continue;
          const owAllow = new PermissionsBitField(ow.allow);
          const owDeny = new PermissionsBitField(ow.deny);
          if (owAllow.has(flag)) {
            steps.push(
              `[GRANT] Role "${r.name}" channel overwrite allows ${permission}`
            );
          }
          if (owDeny.has(flag)) {
            steps.push(
              `[DENY] Role "${r.name}" channel overwrite denies ${permission}`
            );
          }
        }

        // User-specific overwrite
        const userOw = overwrites.get(member.id);
        if (userOw) {
          const uAllow = new PermissionsBitField(userOw.allow);
          const uDeny = new PermissionsBitField(userOw.deny);
          if (uDeny.has(flag)) {
            steps.push(
              `[DENY] User-specific channel overwrite denies ${permission}`
            );
          } else if (uAllow.has(flag)) {
            steps.push(
              `[GRANT] User-specific channel overwrite allows ${permission}`
            );
          } else {
            steps.push(
              `[NEUTRAL] User-specific channel overwrite: no effect on ${permission}`
            );
          }
        }
      }

      // Final: use discord.js computed result as ground truth
      const computed = (ch as any).permissionsFor(
        member
      ) as PermissionsBitField;
      const finalResult = computed.has(flag);

      steps.push(
        finalResult
          ? `=> RESULT: ${permission} is ALLOWED`
          : `=> RESULT: ${permission} is DENIED`
      );

      return ok({
        channel: ch.name,
        user: member.user.username,
        permission,
        result: finalResult,
        reason: finalResult
          ? `${permission} is granted through the permission hierarchy`
          : `${permission} is denied — see steps for details`,
        steps,
      });
    }
  );
}
