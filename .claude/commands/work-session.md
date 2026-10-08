---
description: Run one scheduled work session on the graphics-tricks-portfolio backlog.
---

You are running a scheduled work session on the `graphics-tricks-portfolio`
repository. This command is invoked by `/loop 40m /work-session` so it fires
every 40 minutes. Each invocation is one independent session.

**Your operating procedure is `.claude/AGENT.md`. Read it now and follow it.**

A short summary of what that means in practice:

1. **Orient.** `git fetch` + `git pull --rebase` the branch
   `claude/graphics-website-improvements-egAXm`. Read `TODO.md`, the last
   entry in `SESSIONS.md`, and the last row of `CLOCK.csv`.

2. **Pick one task** from `TODO.md` per AGENT.md §3:
   - Top-down scan of the Backlog
   - First `- [ ]` whose `Depends:` are all `- [x]`
   - Not `BLOCKED-NEEDS-HUMAN`
   - Effort fits a ~30-minute session
   - Continuation of a prior `wip` task wins over a fresh task

3. **Clock in** by appending a row to `CLOCK.csv` with `outcome=in-progress`.

4. **Do the work** in one atomic commit on the branch
   `claude/graphics-website-improvements-egAXm`. Don't switch branches. Don't
   create a PR (#1 already exists and auto-updates on push).

5. **Update bookkeeping** in this order (AGENT.md §6):
   - `TODO.md`: check off the task and add `**Commit:** <sha>`
   - `SESSIONS.md`: append a new session entry
   - `CLOCK.csv`: edit the row you appended in step 3 with `ended_at`,
     `duration_min`, `commit_shas`, `outcome=completed`

6. **Commit the bookkeeping** as a second commit (`chore(log): session sess-...`).

7. **Push** with retry-on-network-error (2s, 4s, 8s, 16s backoff). Never
   force-push.

8. **Exit.** Do not pick a second task.

## Hard rules (full list in AGENT.md §10)

- Stay on branch `claude/graphics-website-improvements-egAXm`.
- Never `git push --force`. Never amend pushed commits. Never bypass hooks.
- Never create a new branch or PR.
- Never claim a task done if you couldn't verify it — use `wip` outcome
  instead and document continuation in `SESSIONS.md`.
- If the backlog has no eligible task: write a `no-task` row in `CLOCK.csv`,
  add a `SESSIONS.md` entry noting the dry backlog, commit, push, exit.

## If you get stuck

- Mid-task realization that work won't fit in this session → AGENT.md §7
  (commit a `wip:`, document continuation, exit).
- Found ambiguity that needs the author's call → AGENT.md §9 (tag the task
  `BLOCKED-NEEDS-HUMAN`, document in `SESSIONS.md`, move on or exit).

Begin now.
