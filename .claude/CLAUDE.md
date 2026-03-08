# Discord MCP — Project instructions

An **MCP (Model Context Protocol) server for Discord** with full server access. Single-file TypeScript implementation in `src/index.ts` using discord.js and the MCP SDK.

## Current state

The **initial build is complete**. The server supports: list channels, get channel, message history (with author filter & pagination), get/search/send/edit/delete messages, reactions, list members, list/download attachments, create channel, DMs.

The next phase is the **expansion roadmap** in `docs/discord-mcp-improvement-plan.md`.

## Configuration

- `DISCORD_BOT_TOKEN` and `DISCORD_GUILD_ID` via env or `claude.json` config.
- No hardcoded credentials. Never commit tokens or secrets.

## Test and verification commands

```bash
npm run build          # TypeScript compilation check
npm test               # Run test suite (when tests exist)
npm run lint           # Lint check (when configured)
```

Verify manually after changes: use `/discord-mcp-verify` or run MCP tools from a client.

## Prompting pattern (for non-trivial tasks)

```
Goal: [what to achieve]
Constraints: [what not to break]
Files in scope: [specific files]
Acceptance criteria: [observable outcomes]
Verification commands: [exact commands to run]
```

See `.claude/prompts/task-templates.md` for bugfix, refactor, and review templates.

## Delivery loop

1. Ask for a short plan before editing.
2. Apply one logical patch at a time.
3. Run verification after each patch.
4. Get concise diff-level summary.
5. Repeat until acceptance criteria are met.

## Key files

| File | Purpose |
|------|---------|
| `src/index.ts` | Monolith MCP server (all tools, helpers, startup) |
| `docs/discord-mcp-improvement-plan.md` | 6-phase expansion roadmap |
| `.claude/rules/discord-mcp-build.md` | Original build plan (complete) |
| `.claude/rules/discord-mcp-expand.md` | Expansion roadmap rule (phases 1–6) |
| `.claude/rules/workflow.md` | Delivery loop, verification, context control |
| `.claude/rules/security-review.md` | Security review runbook |
| `.claude/prompts/opus-discord-mcp.md` | Copy-paste prompt for Opus agent |
| `.claude/prompts/task-templates.md` | Bugfix, refactor, review prompt templates |
| `.claude/skills/discord-mcp-build/` | `/discord-mcp-build` skill |
| `.claude/skills/discord-mcp-verify/` | `/discord-mcp-verify` skill |

## When extending the Discord MCP

- **Expansion plan:** Follow `.claude/rules/discord-mcp-expand.md` for the phased roadmap.
- **Skills:** Use `/discord-mcp-build` (now supports expansion phases) or `/discord-mcp-verify`.
- **Opus prompt:** `.claude/prompts/opus-discord-mcp.md` covers both initial build and expansion.

## Security expectations

- Run `/security-review` before PRs for non-trivial code changes.
- Validate all external input (Discord API responses, user-supplied params).
- No SSRF: validate URLs before fetching (already applied to `discord_download_attachment`).
- See `.claude/rules/security-review.md` for the full runbook.

## Constraints

- Keep existing tool names backward-compatible; add new tools, don't break old ones.
- Add `audit_log_reason` and `confirm` params for destructive operations.
- Respect Discord rate limits (`X-RateLimit-*`, `Retry-After`).
- Every behavior change requires tests. Every non-trivial change requires security review.
- Keep diffs focused; avoid unrelated edits. One logical change per commit.
- Keep `CLAUDE.md` under ~200 lines; use `.claude/rules/` and `.claude/prompts/` for details.

## Definition of done

1. Code compiles (`npm run build`).
2. Tests pass (if applicable).
3. Security review completed for non-trivial changes.
4. Existing tools still work (backward compatibility).
5. Changes documented in relevant files.
