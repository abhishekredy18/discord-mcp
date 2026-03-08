# Discord MCP — Workflow rules

Execution patterns and discipline for working on this project.

## Delivery loop (default for all non-trivial tasks)

1. Ask for a short plan before editing when scope is unclear.
2. Review plan and adjust before any code changes.
3. Apply one logical patch at a time.
4. Run verification after each patch (`npm run build`, `npm test`).
5. Get concise diff-level summary.
6. Repeat until acceptance criteria are met.

## Prompting discipline

Use structured prompts for non-trivial tasks:

```
Goal: [what to achieve]
Constraints: [what not to break]
Files in scope: [specific files]
Acceptance criteria: [observable outcomes]
Verification commands: [exact commands]
Output format: [patch summary + risks]
```

See `.claude/prompts/task-templates.md` for ready-made templates.

## Verification-first discipline

Always require:

- Exact commands to run.
- Expected pass criteria.
- Explicit statement of unresolved risks.

Recommended sequence:

1. TypeScript compilation (`npm run build`)
2. Unit/integration tests (`npm test`)
3. Lint/static checks (`npm run lint`)
4. Security review (`.claude/rules/security-review.md`)
5. Final code review

## Context control

- Use `/compact` when the thread grows noisy but you need continuity.
- Use `/clear` when switching to a different objective.
- Split unrelated work into separate sessions.
- One task per session reduces context drift.

Signals that context should be reset:

- Repetitive mistakes on the same issue.
- Irrelevant file edits.
- Drifting away from acceptance criteria.

## Parallelization patterns

For larger tasks:

1. Split into independent modules or phases.
2. Open parallel Claude sessions (or worktrees) per module.
3. Keep each session narrowly scoped.
4. Consolidate and run full verification pass at the end.

Good split strategies:

- By tool group (channels, messages, threads, permissions).
- By change type (refactor, new feature, tests).
- By risk profile (low-risk cleanup, high-risk logic).

## Failure patterns and corrections

| Failure | Correction |
|---------|------------|
| Vague prompt | Add goal + constraints + verification commands |
| Over-trusting output | Require tests and security review before finalizing |
| Giant one-shot task | Break into small, verifiable patches |
| Context overload | Use `/compact` or restart with `/clear` and tighter instructions |
| No recovery after errors | Propose top 2 root causes and a minimal repair sequence |

## Non-interactive automation

Use headless mode for scripted analysis:

```bash
claude -p "Summarize failing tests and propose minimal fixes"
git diff | claude -p "Review this diff for bugs and missing tests"
claude --print "Audit src/index.ts for dead code" --output-format json
```
