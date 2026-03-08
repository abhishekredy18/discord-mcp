# Discord MCP — Build plan (rule) — COMPLETE

> **Status: Initial build is complete.** For the expansion roadmap (threads, forums, channel management, rich messages, permissions), see `.claude/rules/discord-mcp-expand.md`.

Original build plan preserved below for reference. For a copy-paste prompt suited to a Claude Opus agent, see `.claude/prompts/opus-discord-mcp.md`.

## Goal

Build a **full-fledged** MCP (Model Context Protocol) server for Discord so users can interact with one Discord server via natural language (e.g. “fetch docs from #channel”, “what did Abhi send in #general?”). Implementation lives in this repo and is driven by configuration, not hardcoded credentials.

## Target user experience (convenience)

Support natural, conversational requests:

- **Fetch content from a channel** — e.g. “Fetch the docs from #onboarding” → recent or all messages (and optional attachment links) from that channel.
- **Messages by member** — e.g. “What did Abhi / Kevin send in #general?” → filter messages in a channel by author (by display name, username, or ID).
- **Latest in channel** — e.g. “What’s the latest in #releases?” → most recent messages.
- **List channels** — e.g. “List all channels” → enumerate text/voice/category channels by name and ID.
- **Send message** — e.g. “Send to #standup: …” → post to a channel by name or ID.
- **Search** — e.g. “Search messages in #docs for ‘API key’” → filter by content (and optionally author/time).

Design tools so the agent can fulfill these using **channel names** and **member names** where possible, with fallback to IDs.

## Requirements

### 1. Configuration

- Read **server ID (guild ID)** and **bot token** from **environment variables** (e.g. `DISCORD_GUILD_ID`, `DISCORD_BOT_TOKEN`) or from MCP/client config (e.g. `claude.json`). No hardcoded credentials. Never commit tokens or secrets.

### 2. Capabilities (full server handling)

- **Channels:** List all channels (text, voice, categories) with names and IDs; get channel by ID or by name (within the configured guild).
- **Messages:** List messages in a channel with pagination; support “recent N” and optional time range; optional filter by author (display name, username, or ID).
- **Search:** Search or filter messages in a channel by content (and optionally author/time).
- **Send:** Send a message to a channel (by ID or by name).
- **Members (desirable):** List server members or resolve member by name for “what did [name] send” flows.
- **Attachments (desirable):** Return attachment URLs or metadata for “fetch docs” (files shared in a channel).
- **DMs (optional):** If the bot is allowed, list DM channels and read/send DMs.
- Operate on the **entire server** (configured guild); no single-channel-only limitation.

### 3. Deliverables

- **MCP server** in this repo (TypeScript/Node, standard MCP SDK).
- **Tools (and resources):** list channels, get channel (by id/name), list messages (filters/pagination), search messages, send message; optionally list members / resolve member by name.
- **README:** Create Discord bot, get token and server ID, set env/config, run MCP server, wire in `claude.json`.
- **Example `claude.json` snippet** for passing server ID and bot token to the MCP.

### 4. Constraints

- Use the existing repo; do not assume another project structure.
- Prefer minimal but **complete** implementation; prioritize the user stories above.
- Validate all external input (URLs, IDs, user-supplied params).

## Verification (before done)

Run these commands and manual checks:

```bash
npm run build   # TypeScript compilation
npm test        # Test suite (when tests exist)
```

Manual verification:

1. List channels → names and types match Discord.
2. Fetch last N messages from a channel → content and authors correct.
3. Filter by author (e.g. “messages by Abhi”) → only that user’s messages.
4. Send message → appears in Discord.
5. “Fetch docs from #channel” → agent receives usable content (and attachment links if implemented).
6. New contributor can follow README to run the server and see tools in the MCP client.

## Execution

Follow the delivery loop (see `.claude/rules/workflow.md`):

1. **Plan** — End-to-end: Discord app/bot setup, config (env + `claude.json`), MCP structure, tools/resources, “by name” resolution (channels, members). Review plan before editing.
2. **Implement** — One logical patch at a time. Run `npm run build` after each patch. MCP server, tools, README, example `claude.json`; add minimal tests where possible.
3. **Security review** — Run `/security-review` for input handling, URL validation, and token management.
4. **Verify** — Run through the verification steps and fix gaps.
5. **Summary** — Provide diff-level summary with explicit risk callouts.
