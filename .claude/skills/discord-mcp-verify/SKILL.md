---
name: discord-mcp-verify
description: Run the Discord MCP verification checklist. Use after building or extending the MCP to confirm tools work. Invoke with /discord-mcp-verify or /discord-mcp-verify [phase].
argument-hint: [optional: "phase 1" | "phase 2" | "phase 3" | "phase 4" | "phase 5" | "phase 6"]
disable-model-invocation: true
---

# Discord MCP — Verify skill

Run verification for the Discord MCP. Covers both the initial build and expansion phases.

## Step 0 — Build and test (always run first)

Run these commands before manual checks:

```bash
npm run build   # Must pass — TypeScript compilation
npm test        # Must pass — test suite (when tests exist)
```

If either fails, fix before proceeding. Do not skip this step.

## Baseline checklist (initial build)

1. **List channels** — Names and types match the Discord client.
2. **Fetch messages** — Last 10 messages from a channel; content and authors correct.
3. **Author filter** — "messages by [name]" returns only that user's messages.
4. **Send message** — Test message appears in Discord.
5. **Fetch docs flow** — "fetch docs from #channel" returns content and attachment links.
6. **README** — New contributor can create bot, set env, run server, see tools.

## Phase 1 — Refactor verification

7. **Module structure** — `src/discord/client.ts`, `src/discord/resolvers.ts`, `src/tools/*.ts` exist.
8. **All 16 original tools still work** — No regressions from refactor.
9. **Standardized responses** — All tools return `{ ok, error, code, details }` shape.

## Phase 2 — Forum and thread verification

10. **Create forum post** — With tags; returns thread + starter message.
11. **List threads** — Active threads listed correctly.
12. **List archived threads** — Public, private, joined-private with pagination.
13. **Thread lifecycle** — Start, join, leave, add/remove member, update, archive.
14. **Thread members** — List thread members returns correct data.

## Phase 3 — Channel management verification

15. **Modify channel** — Update name/topic/settings.
16. **Delete channel** — Requires `confirm` param; includes `audit_log_reason`.
17. **Permission overwrites** — Set and delete for role and user targets.
18. **Reorder channels** — Positions update correctly.
19. **Security** — `/security-review` completed for destructive ops and permission overwrite logic.

## Phase 4 — Rich message verification

20. **Rich send** — Send with embeds, `allowed_mentions`, components.
21. **Pins** — Pin, unpin, list pins.
22. **Bulk delete** — Requires `confirm`; deletes up to 100 messages.
23. **List reactions** — Returns users who reacted with a given emoji.
24. **Mention safety** — Default `allowed_mentions` prevents mass pings.
25. **Security** — `/security-review` completed for mention handling and bulk operations.

## Phase 5 — Permission verification

26. **Check permissions** — Correct result for user/role/channel combos.
27. **Effective overwrites** — Returns merged permission state.
28. **Explain denial** — Human-readable explanation for permission failures.

## Phase 6 — Reliability verification

29. **Rate limit handling** — 429 responses trigger retry with backoff.
30. **Integration tests pass** — Channel, thread, permission, rate-limit tests.
31. **README updated** — Tool matrix, intents, forum/thread examples.
32. **Server capabilities** — `discord_get_server_capabilities` reports intents and permissions.

## How to run

- **Always start with Step 0** (build + test).
- If targeting a specific phase: run Step 0 + that phase's checks + the baseline.
- Otherwise: run all checks applicable to implemented phases.
- Use the MCP tools from Claude Code or another client. Report **pass/fail** for each item.
- Fix failures before marking a phase complete.
- For phases 3 and 4: confirm `/security-review` was run (items 19, 25).

## Output format

Report results as:

```
Step 0: PASS/FAIL (build + test)
Baseline: [1] PASS [2] PASS ...
Phase N: [X] PASS [Y] FAIL — [reason]
Unresolved risks: [list any]
```

$ARGUMENTS
