---
name: discord-mcp-build
description: Build or extend the Discord MCP server. Use when the user wants to implement the Discord MCP, add MCP tools, or get started building the server. Invoke with /discord-mcp-build to run the full plan-and-implement flow.
argument-hint: [optional: "plan only" | "implement only" | "phase 1" | "phase 2" | "phase 3" | "phase 4" | "phase 5" | "phase 6"]
disable-model-invocation: false
---

# Discord MCP — Build skill

The **initial build is complete** (`src/index.ts` with 16 tools). This skill now drives the **expansion roadmap**.

Read `.claude/rules/discord-mcp-expand.md` for the full phased plan. Reference `docs/discord-mcp-improvement-plan.md` for Discord API details. Follow `.claude/rules/workflow.md` for delivery loop discipline.

## Execution

1. **Plan** — Review current tools in `src/index.ts`, identify what the target phase adds, plan the implementation. Propose plan before editing. Include files to change, tools to add, and potential risks.
2. **Implement** — One logical patch at a time per the phase. Keep existing tool names backward-compatible. Run `npm run build` after each patch.
3. **Security review** — Run `/security-review` for phases with destructive ops (3, 4) or input/URL handling changes. See `.claude/rules/security-review.md`.
4. **Verify** — Run through the verification checklist for the phase (see `.claude/skills/discord-mcp-verify/SKILL.md`). Run `npm run build` and `npm test`.
5. **Summary** — Provide diff-level summary with: tools added, files changed, explicit risk callouts.

## Arguments

- **"plan only"**: Output the plan for the next phase and stop.
- **"implement only"**: Skip planning, implement (assume plan exists).
- **"phase N"** (1–6): Target a specific phase from the roadmap:
  - Phase 1: Refactor monolith into modules
  - Phase 2: Forum and thread tools
  - Phase 3: Channel management and permission overwrites
  - Phase 4: Rich messages, pins, bulk delete, reactions
  - Phase 5: Permission intelligence and diagnostics
  - Phase 6: Reliability, tests, and docs
- No argument: Assess current state and implement the next incomplete phase.

## Constraints

- No hardcoded credentials. Use `DISCORD_GUILD_ID` and `DISCORD_BOT_TOKEN` from env. Never commit or log tokens.
- Keep existing tools backward-compatible.
- `audit_log_reason` and `confirm` for destructive operations.
- Respect Discord rate limits.
- Validate all external input (IDs, URLs, user-supplied params).

## Context management

- Use `/compact` when context grows noisy during implementation.
- Use `/clear` between independent phases.
- Split independent phases into separate sessions or worktrees when practical.
