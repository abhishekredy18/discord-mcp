# Discord MCP — Security review runbook

When and how to run security reviews for this project.

## When to run `/security-review`

- New data-access logic (Discord API calls, message handling).
- Auth/permissions changes (bot token handling, guild access).
- Input parsing and validation changes (user-supplied params, URLs).
- External service integration (new API endpoints, webhooks).
- Dependency updates with behavior impact.
- Any code touching `discord_download_attachment` or URL handling (SSRF risk).

## What it finds

- Injection risks (command injection, template injection).
- SSRF and unsafe URL handling.
- Broken authz/authn flows.
- Unsafe input handling and validation gaps.
- Dangerous shell or filesystem usage patterns.
- Secrets-handling mistakes (hardcoded tokens, leaked credentials).

## Local workflow (required for non-trivial changes)

1. Implement change in a small patch.
2. Run `npm run build` and `npm test`.
3. Run `/security-review`.
4. Classify findings by severity.
5. Fix high/critical immediately.
6. Re-run `/security-review` after fixes.
7. Document any accepted residual risk.

## PR workflow

Before merge:

1. Local `/security-review` pass completed.
2. CI checks complete (if configured).
3. High-severity issues resolved.
4. Reviewer note added for any deferred medium/low issues.

## Triage template

Use this structure for findings:

```
Finding: [description]
Severity: [critical/high/medium/low]
Exploit path: [how it could be exploited]
Fix applied: [what was changed]
Verification: [how to confirm the fix]
Residual risk: [remaining exposure, if any]
Follow-up issue: [link, if deferred]
```

## High-value prompts after a finding

- "Generate a minimal patch that removes this vulnerability without changing public behavior."
- "Show why the fix blocks the exploit path and what tests prove it."
- "List regression risks introduced by this fix."
- "Add focused tests for this exact class of vulnerability."

## Security hard rules

1. Do not merge with unresolved high-severity findings.
2. Do not suppress findings without written rationale.
3. Do not rely on security review alone; keep manual review.
4. Re-run security review after major rebases or conflict resolution.
5. Never commit API keys, tokens, or secrets.

## MCP-specific security concerns

- **SSRF**: Validate all URLs before fetching (see `discord_download_attachment` fix).
- **Bot token exposure**: Never log or return the bot token in tool responses.
- **Rate limit abuse**: Respect Discord rate limits to avoid bot bans.
- **Permission escalation**: Validate `confirm` param for destructive operations.
- **Input sanitization**: Validate channel IDs, message IDs, and user inputs.

## Pre-merge checklist

- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] `/security-review` run locally
- [ ] Critical/high issues fixed
- [ ] Deferred risks documented
- [ ] Final `/review` completed
