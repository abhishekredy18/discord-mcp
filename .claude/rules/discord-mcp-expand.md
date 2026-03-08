# Discord MCP — Expansion roadmap (rule)

Use this rule when extending the Discord MCP beyond the initial build. The full plan lives in `docs/discord-mcp-improvement-plan.md`. This rule summarizes the phases, tools, and constraints for implementation.

Follow `.claude/rules/workflow.md` for delivery loop and verification discipline.

## Current baseline (in `src/index.ts`)

Existing tools (16): `discord_list_channels`, `discord_get_channel`, `discord_get_message_history`, `discord_get_message`, `discord_search_messages`, `discord_send_message`, `discord_edit_message`, `discord_delete_message`, `discord_add_reaction`, `discord_remove_reaction`, `discord_list_members`, `discord_list_attachments`, `discord_create_channel`, `discord_get_dm_channels`, `discord_create_dm`, `discord_download_attachment`.

## Phase 1 — Refactor for extensibility

- Split monolith `src/index.ts` into:
  - `src/discord/client.ts` — Discord client setup and connection
  - `src/discord/resolvers.ts` — channel/member resolution helpers
  - `src/tools/*.ts` — one file per tool group (channels, messages, threads, etc.)
  - `src/tools/index.ts` — tool registration barrel
- Add shared `DiscordActionContext` for guild cache, resolution, permission pre-checks, rate-limit wrappers.
- Standardize MCP responses: `{ ok, error, code, details, retry_after_ms }`.
- **Verify:** `npm run build` passes. All 16 original tools still work. Standardized response shape confirmed.
- **Risks:** Regressions in existing tools. Run `/discord-mcp-verify` baseline after refactor.

## Phase 2 — Forum and thread support

New tools:
- `discord_list_threads`, `discord_get_thread`
- `discord_start_thread_from_message`, `discord_start_thread`
- `discord_create_forum_post`
- `discord_list_archived_threads` (public/private/joined-private with pagination)
- `discord_join_thread`, `discord_leave_thread`
- `discord_add_thread_member`, `discord_remove_thread_member`, `discord_list_thread_members`
- `discord_update_thread`
- `discord_update_forum_channel` (tags, default reaction, sort order, layout, thread slowmode)
- **Verify:** Forum post creation with tags returns thread + starter. Archived threads paginate. Thread lifecycle works end-to-end.
- **Risks:** Thread permission edge cases. Archived thread API differences across guild features.

## Phase 3 — Channel management parity

New tools:
- `discord_modify_channel`, `discord_delete_channel`, `discord_reorder_channels`
- `discord_set_channel_permissions`, `discord_delete_channel_permissions`
- `discord_clone_channel`

Requirements: `audit_log_reason` for moderation ops, `confirm` for destructive ops.
- **Verify:** Modify/delete/reorder work. Permission overwrites CRUD for role and user targets.
- **Risks:** Destructive ops without `confirm` guard. Run `/security-review` for permission overwrite logic.
- **Security:** Validate `confirm` param is required before destructive actions execute.

## Phase 4 — Message and workflow upgrades

Upgrade `discord_send_message` / `discord_edit_message` to support: `allowed_mentions`, embeds, components, stickers, attachments, polls, flags.

New tools:
- `discord_pin_message`, `discord_unpin_message`, `discord_list_pins`
- `discord_bulk_delete_messages`
- `discord_crosspost_message`
- `discord_clear_reactions`, `discord_list_reactions`

Add mention-safe defaults to prevent accidental mass pings.
- **Verify:** Rich send/edit work. Pins work. Bulk delete requires `confirm`. Default `allowed_mentions` blocks mass pings.
- **Risks:** Accidental @everyone/@here. Bulk delete data loss. Run `/security-review` for mention handling.

## Phase 5 — Permission intelligence

New tools:
- `discord_check_permissions` — simulate user/role/channel/thread action checks
- `discord_get_effective_overwrites`
- `discord_explain_permission_denial`
- **Verify:** Correct results for user/role/channel combos. Human-readable denial explanations.
- **Risks:** Incorrect permission calculations leading to false confidence about access.

## Phase 6 — Reliability, tests, and docs

- Rate-limit retry/backoff with jitter for 429 responses and bucket-aware handling.
- Integration tests for: channel/forum/thread lifecycle, permission denied paths, rate-limit handling.
- Update `README.md` with expanded tool matrix, required intents/permissions, forum/thread examples.
- Add `discord_get_server_capabilities` tool (reports intents, permissions, missing capabilities).
- **Verify:** 429 triggers retry with backoff. All integration tests pass. README complete with examples.
- **Risks:** Retry logic causing cascading failures. Test flakiness from Discord API latency.

## Implementation constraints

- Keep existing tool names backward-compatible.
- Add new tools; don't break old ones.
- Use Discord REST API routes and constraints from official docs.
- Include `audit_log_reason` and `confirm` for destructive/moderation operations.
- Respect rate limits: parse `X-RateLimit-*` and `Retry-After` headers.
- Keep intent requirements explicit (especially privileged intents for members/content).
- Validate all external input (IDs, URLs, user-supplied params).
- Never commit API keys, tokens, or secrets.

## Verification commands

Run after each phase:

```bash
npm run build   # TypeScript compilation — must pass
npm test        # Test suite — must pass
```

Then run `/discord-mcp-verify [phase N]` for manual tool checks.
Run `/security-review` for phases 3, 4, and any input/URL handling changes.

## Definition of done

Per phase:

1. Code compiles (`npm run build`).
2. Tests pass (`npm test`).
3. `/security-review` completed (for non-trivial changes).
4. `/discord-mcp-verify` checklist passes for the phase.
5. Existing tools still work (backward compatibility).
6. Risk callouts documented in PR/commit summary.

Per roadmap:

- Forum post creation supports tags and returns created thread + starter message.
- Archived thread listing works for public, private, and joined-private with pagination.
- Channel permission overwrite CRUD works for role and user targets.
- Rich message send/edit and pin/bulk operations pass tests.
- 429 behavior is controlled and surfaced with retry metadata.
- README includes task-oriented examples for forums, channels, permissions, and moderation.

## Execution

Follow the delivery loop (`.claude/rules/workflow.md`). Implement as phased, PR-sized commits:

1. **Plan** — Review current state, identify phase scope, propose plan before editing.
2. **Implement** — One logical patch at a time. Run `npm run build` after each.
3. **Verify** — `npm test` + `/discord-mcp-verify [phase]`.
4. **Security** — `/security-review` for phases with destructive ops or input handling.
5. **Summary** — Diff-level summary with explicit risk callouts.

Phase order:
1. Refactor structure and shared context/error model.
2. Add forum and thread tools.
3. Add channel management and permission overwrite tools.
4. Upgrade message tooling (rich send/edit, pins, bulk, reactions).
5. Add permission diagnostics.
6. Add integration tests and update README with final capability table.
