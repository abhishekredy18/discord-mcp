# Task prompt templates

Reusable prompt structures for common Discord MCP tasks. Copy and fill in the blanks.

## Bugfix

```
Goal: Fix [bug description].
Scope: [files, e.g. src/index.ts].
Constraints: No tool name or API signature changes.
Acceptance criteria: [expected behavior after fix].
Verification: npm run build && npm test.
Output: Patch summary + risks.
```

## New tool

```
Goal: Add [tool_name] tool for [purpose].
Scope: src/index.ts (or src/tools/[group].ts after refactor).
Constraints: Keep existing tools backward-compatible. Follow Discord REST API.
Acceptance criteria: Tool registers, accepts correct params, returns expected data.
Verification: npm run build && test via MCP client.
Output: Tool schema + implementation summary.
```

## Refactor

```
Goal: Refactor [target] for [readability/modularity] without behavior changes.
Scope: [files].
Constraints: Keep tests green and all 16+ tools unchanged.
Verification: npm run build && npm test.
Output: Before/after rationale + diff summary.
```

## Code review

```
Review this diff for:
- Bugs and regressions.
- Security issues (SSRF, injection, token exposure).
- Missing tests.
- Discord API constraint violations (rate limits, permissions).
List findings by severity with file:line references.
```

## Expansion phase

```
Goal: Implement Phase [N] of the expansion roadmap.
Scope: See .claude/rules/discord-mcp-expand.md.
Constraints: Backward-compatible. audit_log_reason + confirm for destructive ops.
Acceptance criteria: All new tools register and work per phase definition.
Verification: /discord-mcp-verify phase [N].
Output: List of tools added, changes made, risks.
```
