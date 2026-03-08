# Discord MCP Server

MCP (Model Context Protocol) server that gives Claude full access to a Discord server via a bot token. Supports listing channels, reading/sending messages, searching, managing members, and more — all by channel and member **name** (with ID fallback).

## Prerequisites

- **Node.js** ≥ 18
- A **Discord bot** with the correct intents enabled (see below)

## Discord Bot Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and create a **New Application**.
2. Go to **Bot** → click **Reset Token** → copy the token (this is your `DISCORD_BOT_TOKEN`).
3. Under **Privileged Gateway Intents**, enable:
   - **Server Members Intent**
   - **Message Content Intent**
4. Go to **OAuth2 → URL Generator**:
   - Scopes: `bot`
   - Bot Permissions: `Send Messages`, `Read Message History`, `Manage Messages`, `Manage Channels`, `Add Reactions`, `View Channels`
   - Open the generated URL to invite the bot to your server.
5. Get your **Server (Guild) ID**: In Discord, enable Developer Mode (Settings → Advanced), right-click your server name → **Copy Server ID**. This is your `DISCORD_GUILD_ID`.

## Install & Build

```bash
git clone <this-repo>
cd discord-mcp
npm install
npm run build
```

## Configuration

Set two environment variables:

```bash
export DISCORD_BOT_TOKEN="your-bot-token"
export DISCORD_GUILD_ID="your-server-id"
```

Or pass them via your MCP client config (see below).

## Run

```bash
# Production (compiled JS)
npm start

# Development (TypeScript via tsx)
npm run dev
```

## Wire into Claude Code (`claude_desktop_config.json` or `claude.json`)

```json
{
  "mcpServers": {
    "discord": {
      "command": "node",
      "args": ["/absolute/path/to/discord-mcp/dist/index.js"],
      "env": {
        "DISCORD_BOT_TOKEN": "your-bot-token",
        "DISCORD_GUILD_ID": "your-server-id"
      }
    }
  }
}
```

> **Tip:** You can also use `npx tsx /path/to/discord-mcp/src/index.ts` as the command to skip the build step during development.

## Available Tools

All tools accept channel and member **names** (e.g. `"general"`, `"#announcements"`, `"Alice"`) with ID fallback.

| Tool | Description |
|------|-------------|
| `discord_list_channels` | List all channels (optional type filter: text, voice, category, etc.) |
| `discord_get_channel` | Get channel details by name or ID |
| `discord_get_message_history` | Fetch recent messages with pagination and optional author filter |
| `discord_get_message` | Fetch a single message by ID |
| `discord_search_messages` | Search messages by text content (optional author filter) |
| `discord_send_message` | Send a message (with optional reply) |
| `discord_edit_message` | Edit a bot message |
| `discord_delete_message` | Delete a message |
| `discord_add_reaction` | React to a message with an emoji |
| `discord_remove_reaction` | Remove the bot's reaction |
| `discord_list_members` | List server members (optional name search) |
| `discord_list_attachments` | List file attachments in a channel |
| `discord_create_channel` | Create a new channel |
| `discord_get_dm_channels` | List the bot's open DM channels |
| `discord_create_dm` | Open a DM with a server member |
| `discord_download_attachment` | Download and return text content of an attachment |

## Example Prompts

- *"List all channels"*
- *"What's the latest in #general?"*
- *"What did Alice send in #random?"*
- *"Search #docs for 'API key'"*
- *"Send to #standup: Today I worked on the MCP server"*
- *"Fetch the docs from #onboarding"* (lists messages + attachments)
