# Discord MCP Server

MCP (Model Context Protocol) server that gives Claude full access to a Discord server via a bot token. **46 tools** covering channels, messages, threads, forums, reactions, permissions, members, attachments, and DMs — all by **name** with ID fallback.

## Prerequisites

- **Node.js** >= 18
- A **Discord bot** with the correct intents and permissions enabled (see below)

## Discord Bot Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and create a **New Application**.
2. Go to **Bot** → click **Reset Token** → copy the token (this is your `DISCORD_BOT_TOKEN`).
3. Under **Privileged Gateway Intents**, enable:
   - **Server Members Intent**
   - **Message Content Intent**
4. Go to **OAuth2 → URL Generator**:
   - Scopes: `bot`
   - Bot Permissions:
     - **General:** View Channels, Manage Channels, Manage Roles
     - **Text:** Send Messages, Manage Messages, Read Message History, Add Reactions, Embed Links, Attach Files, Create Public Threads, Create Private Threads, Send Messages in Threads, Manage Threads
     - **Voice:** Connect, Speak (if needed)
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

# Run tests
npm test
```

## Wire into Claude Code

Add to `claude_desktop_config.json` or `.claude.json`:

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

> **Tip:** Use `npx tsx /path/to/discord-mcp/src/index.ts` as the command to skip the build step during development.

## Available Tools (46)

All tools accept channel and member **names** (e.g. `"general"`, `"#announcements"`, `"Alice"`) with ID fallback.

### Channels (9)

| Tool | Description |
|------|-------------|
| `discord_list_channels` | List all channels (optional type filter: text, voice, category, announcement, forum, stage, thread) |
| `discord_get_channel` | Get channel details by name or ID |
| `discord_create_channel` | Create a new channel (text, voice, category, announcement, forum, stage) |
| `discord_modify_channel` | Modify channel settings (name, topic, nsfw, slowmode, position, parent, bitrate, user limit) |
| `discord_delete_channel` | Delete a channel (requires `confirm=true`) |
| `discord_reorder_channels` | Reorder channels by setting their positions |
| `discord_set_channel_permissions` | Set permission overwrites on a channel for a role or user |
| `discord_delete_channel_permissions` | Remove permission overwrites for a role or user (requires `confirm=true`) |
| `discord_clone_channel` | Clone an existing channel (copies settings and permission overwrites) |

### Messages (11)

| Tool | Description |
|------|-------------|
| `discord_get_message_history` | Fetch recent messages with pagination and optional author filter |
| `discord_get_message` | Fetch a single message by ID |
| `discord_search_messages` | Search messages by text content (optional author filter) |
| `discord_send_message` | Send a message with text, embeds, mention controls, and notification suppression |
| `discord_edit_message` | Edit a bot message (text and/or embeds) |
| `discord_delete_message` | Delete a message |
| `discord_pin_message` | Pin a message (max 50 per channel) |
| `discord_unpin_message` | Unpin a message |
| `discord_list_pins` | List all pinned messages in a channel |
| `discord_bulk_delete_messages` | Bulk delete 2–100 messages (requires `confirm=true`) |
| `discord_crosspost_message` | Publish a message in an announcement channel to followers |

### Threads & Forums (13)

| Tool | Description |
|------|-------------|
| `discord_list_threads` | List active threads (optional channel filter) |
| `discord_get_thread` | Get thread details by name or ID |
| `discord_start_thread_from_message` | Start a thread from an existing message |
| `discord_start_thread` | Start a standalone thread in a channel |
| `discord_create_forum_post` | Create a forum post with tags, auto-archive, and slowmode |
| `discord_list_archived_threads` | List archived threads (public/private/joined) with pagination |
| `discord_join_thread` | Bot joins a thread |
| `discord_leave_thread` | Bot leaves a thread |
| `discord_add_thread_member` | Add a user to a thread |
| `discord_remove_thread_member` | Remove a user from a thread |
| `discord_list_thread_members` | List members of a thread |
| `discord_update_thread` | Update thread settings (name, archived, locked, slowmode, auto-archive) |
| `discord_update_forum_channel` | Update forum channel settings (tags, default reaction, sort, layout, slowmode) |

### Reactions (4)

| Tool | Description |
|------|-------------|
| `discord_add_reaction` | React to a message with an emoji |
| `discord_remove_reaction` | Remove the bot's reaction |
| `discord_list_reactions` | List reactions on a message with counts (optionally fetch users for a specific emoji) |
| `discord_clear_reactions` | Clear all reactions or a specific emoji (requires `confirm=true`) |

### Permissions (3)

| Tool | Description |
|------|-------------|
| `discord_check_permissions` | Check what permissions a user/role has in a channel (defaults to the bot) |
| `discord_get_effective_overwrites` | List all permission overwrites on a channel with allowed/denied permissions |
| `discord_explain_permission_denial` | Step-by-step explanation of the permission hierarchy for a user in a channel |

### Members (1)

| Tool | Description |
|------|-------------|
| `discord_list_members` | List server members (optional name search) |

### Attachments (2)

| Tool | Description |
|------|-------------|
| `discord_list_attachments` | List file attachments in a channel |
| `discord_download_attachment` | Download and return text content of an attachment |

### DMs (2)

| Tool | Description |
|------|-------------|
| `discord_get_dm_channels` | List the bot's open DM channels |
| `discord_create_dm` | Open a DM with a server member and send a message |

### Server (1)

| Tool | Description |
|------|-------------|
| `discord_get_server_capabilities` | Report bot permissions, guild features, intents, and missing recommended permissions |

## Required Intents

| Intent | Why |
|--------|-----|
| Guilds | Channel and guild cache |
| GuildMessages | Message events and history |
| GuildMembers (privileged) | Member resolution by name |
| MessageContent (privileged) | Read message text for search/filter |
| DirectMessages | DM channel support |

## Mention Safety

`discord_send_message` and `discord_edit_message` use a **mention-safe default**: `@everyone` and `@here` are suppressed unless you explicitly pass `allowed_mentions: { parse: ["everyone"] }`. User and role mentions work normally.

## Destructive Operation Guards

Tools that delete or bulk-modify data require `confirm: true`:

- `discord_delete_channel`
- `discord_delete_channel_permissions`
- `discord_delete_message` (single delete, no confirm needed)
- `discord_bulk_delete_messages` (requires confirm)
- `discord_clear_reactions` (requires confirm)

Moderation tools accept `audit_log_reason` for the Discord audit log.

## Rate Limiting

The server uses discord.js with 5 automatic retries and 15s timeout per request. Discord rate limits (429) are handled transparently with backoff. If retries are exhausted, a structured error is returned with `retry_after_ms` when available.

## Example Prompts

**Channels:**
- *"List all channels"*
- *"Create a text channel called project-updates under the Projects category"*
- *"What permissions does the Moderator role have in #general?"*

**Messages:**
- *"What's the latest in #general?"*
- *"What did Alice send in #random?"*
- *"Search #docs for 'API key'"*
- *"Send to #standup: Today I worked on the MCP server"*
- *"Send an embed to #announcements with title 'Release v2.0' and description 'New features...'"*
- *"Pin the last message in #important"*

**Threads & Forums:**
- *"List all active threads"*
- *"Create a forum post in #help titled 'Setup question' with the bug tag"*
- *"What are the archived threads in #discussions?"*

**Permissions:**
- *"Can the bot send messages in #locked-channel?"*
- *"Why can't Alice view #private-channel?"*
- *"What are the permission overwrites on #admin-only?"*

**Attachments:**
- *"Fetch the docs from #onboarding"* (lists messages + attachments)
- *"Download the latest file from #resources"*

## Project Structure

```
src/
├── index.ts              # Entry point — MCP server + startup
├── discord/
│   ├── client.ts         # Discord client setup, login, guild accessor
│   ├── context.ts        # Shared context (DI) for tool handlers
│   ├── formatters.ts     # Channel/message/thread formatting
│   └── resolvers.ts      # Name-to-ID resolution helpers
├── mcp/
│   └── response.ts       # Standardized ok/err response builders
└── tools/
    ├── index.ts           # Tool registration barrel
    ├── channels.ts        # Channel CRUD + permissions
    ├── messages.ts        # Message read/write + pins + bulk ops
    ├── reactions.ts       # Reaction add/remove/list/clear
    ├── threads.ts         # Thread + forum tools
    ├── members.ts         # Member listing
    ├── attachments.ts     # Attachment list + download
    ├── dm.ts              # DM channels
    ├── permissions.ts     # Permission checks + diagnostics
    └── server.ts          # Server capabilities
tests/
├── response.test.ts      # Response builder unit tests
└── formatters.test.ts    # Formatter unit tests
```

## License

MIT
