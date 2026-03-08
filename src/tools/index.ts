import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DiscordActionContext } from "../discord/context.js";
import { registerChannelTools } from "./channels.js";
import { registerMessageTools } from "./messages.js";
import { registerReactionTools } from "./reactions.js";
import { registerMemberTools } from "./members.js";
import { registerAttachmentTools } from "./attachments.js";
import { registerDmTools } from "./dm.js";
import { registerThreadTools } from "./threads.js";
import { registerPermissionTools } from "./permissions.js";
import { registerServerTools } from "./server.js";

export function registerAllTools(mcp: McpServer, ctx: DiscordActionContext) {
  registerChannelTools(mcp, ctx);
  registerMessageTools(mcp, ctx);
  registerReactionTools(mcp, ctx);
  registerMemberTools(mcp, ctx);
  registerAttachmentTools(mcp, ctx);
  registerDmTools(mcp, ctx);
  registerThreadTools(mcp, ctx);
  registerPermissionTools(mcp, ctx);
  registerServerTools(mcp, ctx);
}
