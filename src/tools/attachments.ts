import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DiscordActionContext } from "../discord/context.js";
import { ok, err, okWithImages } from "../mcp/response.js";

/* ── SSRF allowlist (shared with forward_message) ─────────────── */

export const DISCORD_CDN_HOSTS = [
  "cdn.discordapp.com",
  "media.discordapp.net",
];

export function isAllowedAttachmentUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      DISCORD_CDN_HOSTS.includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}

/* ── Content-type classification ──────────────────────────────── */

const TEXT_TYPES = new Set([
  "application/json",
  "application/xml",
  "application/javascript",
  "application/typescript",
  "application/xhtml+xml",
  "application/x-yaml",
  "application/toml",
  "application/x-sh",
  "application/sql",
  "application/graphql",
  "application/ld+json",
]);

function isTextContentType(ct: string): boolean {
  const base = ct.split(";")[0].trim().toLowerCase();
  if (base.startsWith("text/")) return true;
  if (TEXT_TYPES.has(base)) return true;
  // Common text suffixes
  if (base.endsWith("+xml") || base.endsWith("+json")) return true;
  return false;
}

function isImageContentType(ct: string): boolean {
  return ct.split(";")[0].trim().toLowerCase().startsWith("image/");
}

/* ── Default max download size: 25 MB ─────────────────────────── */
const DEFAULT_MAX_SIZE = 25 * 1024 * 1024;

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
    "Download an attachment. Returns text for text files, MCP ImageContent for images " +
      "(Claude can see it), or base64 for other binary files (PDF, zip, etc.).",
    {
      url: z.string().describe("Attachment URL from a message"),
      max_size: z
        .number()
        .optional()
        .describe("Max download size in bytes (default 25 MB)"),
    },
    async ({ url, max_size }) => {
      if (!isAllowedAttachmentUrl(url)) {
        return err(
          "Only Discord HTTPS attachment URLs are allowed",
          "INVALID_URL"
        );
      }

      const maxBytes = max_size ?? DEFAULT_MAX_SIZE;
      const resp = await fetch(url);
      if (!resp.ok) {
        return err(
          `Download failed: ${resp.status} ${resp.statusText}`,
          "DOWNLOAD_FAILED"
        );
      }

      // Check Content-Length before reading body
      const clHeader = resp.headers.get("content-length");
      if (clHeader && Number(clHeader) > maxBytes) {
        return err(
          `File too large: ${clHeader} bytes (max ${maxBytes})`,
          "FILE_TOO_LARGE"
        );
      }

      const contentType =
        resp.headers.get("content-type") ?? "application/octet-stream";
      const buf = Buffer.from(await resp.arrayBuffer());

      if (buf.length > maxBytes) {
        return err(
          `File too large: ${buf.length} bytes (max ${maxBytes})`,
          "FILE_TOO_LARGE"
        );
      }

      // Text files: return as readable text
      if (isTextContentType(contentType)) {
        const text = buf.toString("utf8");
        return ok({
          url,
          content_type: contentType,
          encoding: "utf8",
          size: buf.length,
          content: text,
        });
      }

      // Images: return as MCP ImageContent so Claude can see them
      if (isImageContentType(contentType)) {
        const mimeType = contentType.split(";")[0].trim();
        const base64 = buf.toString("base64");
        return okWithImages(
          {
            url,
            content_type: mimeType,
            size: buf.length,
          },
          [{ base64, mimeType }]
        );
      }

      // Other binary (PDF, zip, etc.): return as base64
      const base64 = buf.toString("base64");
      return ok({
        url,
        content_type: contentType,
        encoding: "base64",
        size: buf.length,
        content: base64,
      });
    }
  );
}
