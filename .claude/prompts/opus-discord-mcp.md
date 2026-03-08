# Prompt to pass to Claude Opus: Discord MCP

Copy the entire section below the line into your Claude Opus agent (e.g. Claude Code or API).

---

## Your task

Extend the **Discord MCP (Model Context Protocol) server** in this repo (`discord-mcp`). The initial build is complete in `src/index.ts` — a monolith with 16 tools covering channels, messages, members, reactions, attachments, DMs, and channel creation.

Your job is to implement the **expansion roadmap** from `docs/discord-mcp-improvement-plan.md`, following the phased approach in `.claude/rules/discord-mcp-expand.md`.

## Current tools (do not break these)

`discord_list_channels`, `discord_get_channel`, `discord_get_message_history`, `discord_get_message`, `discord_search_messages`, `discord_send_message`, `discord_edit_message`, `discord_delete_message`, `discord_add_reaction`, `discord_remove_reaction`, `discord_list_members`, `discord_list_attachments`, `discord_create_channel`, `discord_get_dm_channels`, `discord_create_dm`, `discord_download_attachment`.

## Expansion phases

### Phase 1 — Refactor
Split `src/index.ts` into `src/discord/client.ts`, `src/discord/resolvers.ts`, `src/tools/*.ts`, `src/tools/index.ts`. Add shared `DiscordActionContext` and standardize responses.

### Phase 2 — Forums and threads
Add: `discord_list_threads`, `discord_get_thread`, `discord_start_thread_from_message`, `discord_start_thread`, `discord_create_forum_post`, `discord_list_archived_threads`, `discord_join_thread`, `discord_leave_thread`, `discord_add_thread_member`, `discord_remove_thread_member`, `discord_list_thread_members`, `discord_update_thread`, `discord_update_forum_channel`.

### Phase 3 — Channel management
Add: `discord_modify_channel`, `discord_delete_channel`, `discord_reorder_channels`, `discord_set_channel_permissions`, `discord_delete_channel_permissions`, `discord_clone_channel`. Include `audit_log_reason` and `confirm` for destructive ops.

### Phase 4 — Rich messages
Upgrade send/edit to support `allowed_mentions`, embeds, components, stickers, attachments, polls, flags. Add: `discord_pin_message`, `discord_unpin_message`, `discord_list_pins`, `discord_bulk_delete_messages`, `discord_crosspost_message`, `discord_clear_reactions`, `discord_list_reactions`. Add mention-safe defaults.

### Phase 5 — Permission intelligence
Add: `discord_check_permissions`, `discord_get_effective_overwrites`, `discord_explain_permission_denial`.

### Phase 6 — Reliability and docs
Add retry/backoff for 429s. Integration tests. Update README with tool matrix, intents, examples. Add `discord_get_server_capabilities`.

## Constraints

- Keep existing tool names backward-compatible.
- Use Discord REST API routes and constraints from official docs.
- `audit_log_reason` and `confirm` for destructive/moderation operations.
- Parse and respect `X-RateLimit-*` and `Retry-After` headers.
- Config via `DISCORD_GUILD_ID` and `DISCORD_BOT_TOKEN` env vars.
- Validate all external input (IDs, URLs, user-supplied params).
- Never commit or log API keys, tokens, or secrets.

## Delivery loop

For each phase, follow this pattern:

1. **Plan first** — Propose a short plan before editing. List files to change, new tools to add, and potential risks.
2. **Small patches** — Apply one logical patch at a time.
3. **Verify after each patch** — Run `npm run build` after every change. Run `npm test` when tests exist.
4. **Security review** — Run `/security-review` for phases with destructive ops (3, 4) or input handling changes.
5. **Phase verification** — Run `/discord-mcp-verify [phase N]` for the manual tool checklist.
6. **Summary with risks** — After each phase, provide a diff-level summary listing tools added, changes made, and explicit risk callouts.

## Verification

After each phase, confirm:

```bash
npm run build   # Must pass
npm test        # Must pass (when tests exist)
```

Then verify per phase:

- **Phase 1:** All 16 original tools still work. Standardized response shape. Module structure exists.
- **Phase 2:** Forum post with tags returns thread + starter. Archived threads paginate. Thread lifecycle end-to-end.
- **Phase 3:** Channel CRUD works. Permission overwrites for role and user targets. `confirm` required for delete.
- **Phase 4:** Rich send/edit with embeds. Pins work. Bulk delete requires `confirm`. Mention-safe defaults block mass pings.
- **Phase 5:** Permission checks correct for user/role/channel combos. Denial explanations readable.
- **Phase 6:** 429 triggers retry with backoff. Integration tests pass. README complete with tool matrix and examples.

## Context management

- Use `/compact` when context grows noisy.
- Use `/clear` between unrelated phases.
- Split independent phases into separate sessions or worktrees.
- If you drift from acceptance criteria or make repetitive mistakes, reset context.
