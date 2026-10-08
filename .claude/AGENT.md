# Agent operating procedure

You are running a **scheduled work session** on the `graphics-tricks-portfolio`
repository. A `/loop` job invokes you every 40 minutes via the
`/work-session` slash command. Your job is to pick one well-scoped task from
`TODO.md`, complete it, commit it, and update the bookkeeping files — then
exit. The PR (#1) auto-updates as you push.

This document is the **source of truth** for how that loop works. If you find
yourself unsure, re-read this file.

---

## 1. Who you are

- You are an instance of a Claude model running in Claude Code on the branch
  `claude/graphics-website-improvements-egAXm`.
- You share that branch with every other session. There is no parallel
  scheduling — sessions run one at a time. But you cannot assume anything
  carries over in memory between runs. **The files in this repo are the
  source of truth.**
- Identify your own model when you log a session. The exact model ID is
  available in your system prompt (e.g. `claude-opus-4-7`,
  `claude-sonnet-4-6`). If you can't determine it, use `unknown-claude`.

---

## 2. Orient (do this first, every session)

Run these in parallel where possible:

1. `pwd` — confirm you're in `/home/user/graphics-tricks-portfolio` (or
   whatever the user's working directory is — `git rev-parse --show-toplevel`
   gets you the repo root).
2. `git status` — confirm working tree is clean.
3. `git fetch origin claude/graphics-website-improvements-egAXm` — pull any
   commits a previous session pushed.
4. `git pull --rebase origin claude/graphics-website-improvements-egAXm` —
   stay current.
5. Read `TODO.md` — the backlog.
6. Read the **last entry** in `SESSIONS.md` — what the previous session did
   and any continuation notes.
7. Read the **last row** of `CLOCK.csv` — current state (if `outcome` is
   `in-progress`, see §6).

Do **not** read the whole repo. The catalog is large. Read only what the
task you pick requires.

---

## 3. Pick exactly one task

From `TODO.md`, scan from the top of the **Backlog** section to the bottom.
Pick the first task where **all** of these are true:

1. Status is `- [ ]` (not checked, not in progress).
2. `Depends:` field is empty OR every listed dependency is `- [x]`.
3. Not tagged `BLOCKED-NEEDS-HUMAN`.
4. Estimated effort fits a ~30-minute session: `XS`, `S`, or `M` are fine;
   `L` should be split (see §7) unless you've made a continuation plan.

**Tie-breaker:** earlier phase wins (Phase 1 before Phase 2, etc.).

If you find no eligible task, see §8.

If the task is ambiguous or needs a design decision, see §9.

---

## 4. Clock in

Append a new row to `CLOCK.csv` immediately after picking your task:

```
session_id,agent,started_at,ended_at,duration_min,task_ids,commit_shas,outcome
sess-20260513-1423,claude-opus-4-7,2026-05-13T14:23:00Z,,,T-001,,in-progress
```

- `session_id`: `sess-YYYYMMDD-HHMM` in UTC, derived from the current time.
  Get it via `date -u +sess-%Y%m%d-%H%M`.
- `agent`: your model ID.
- `started_at`: ISO-8601 UTC. `date -u +%FT%TZ`.
- `ended_at`, `duration_min`, `commit_shas`: leave empty for now.
- `task_ids`: the task you picked (e.g. `T-001`). Comma-separated if multiple.
- `outcome`: `in-progress` initially.

**Do not commit CLOCK.csv yet.** You'll update it again at the end.

---

## 5. Do the work

Constraints:

- **One task per commit.** Atomic, scoped, reviewable.
- Read only the files the task actually touches.
- Test in-browser where feasible (UI tasks). If you can't, say so in
  `SESSIONS.md`.
- Keep with the design language: dark theme, accent `#ff7e3d`, serif/mono
  typography, editorial restraint. See `ROADMAP.md` §2 for principles.
- Don't introduce dependencies (npm packages, CDN scripts, fonts) without
  explicit license in the task. The site is single-file by ethos.
- Don't rewrite unrelated code. If you spot something to fix, add it as a
  new task at the bottom of the relevant phase in `TODO.md`. Don't fix it
  in this commit.
- Avoid `cd` between commands; use absolute paths.

When you believe the task meets its `Done when:` criteria, proceed to §6.

---

## 6. Commit and update bookkeeping

**Order matters.** Do these in this sequence:

### 6.1 Stage and commit the actual work

```
git add <files-you-changed>
git commit -m "$(cat <<'EOF'
<type>(<scope>): <subject>

<optional body explaining WHY>

Task: T-NNN
https://claude.ai/code/session_01SxYzBLi2RF4xmTRQ3Dvc4P
EOF
)"
```

Commit types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `chore`.
Scope is optional but use it when natural (`feat(nav): keyboard shortcuts`).
Keep the subject line ≤ 60 chars.

### 6.2 Capture the commit SHA

```
git rev-parse --short HEAD
```

### 6.3 Update `TODO.md`

- Change `- [ ]` to `- [x]` for the task you completed.
- Append `**Commit:** <short-sha>` as a new line at the bottom of the task.
- If you discovered follow-up work, add new `T-NNN` items at the bottom of
  the relevant phase section, marked `- [ ]`.

### 6.4 Update `SESSIONS.md`

Append a new entry following the format in `SESSIONS.md`'s header. Be terse
but include:

- Session ID, started/ended times, model ID
- Task ID + title
- What you did (3–6 bullet points)
- Files changed
- Commit SHA (the one from §6.2)
- Any continuation notes for future sessions

### 6.5 Update `CLOCK.csv`

Edit the row you appended in §4:

- `ended_at`: ISO-8601 UTC now
- `duration_min`: integer minutes since `started_at`
- `commit_shas`: the SHA from §6.2 (short form; comma-separated if multiple)
- `outcome`: `completed`

### 6.6 Commit the bookkeeping update

```
git add TODO.md SESSIONS.md CLOCK.csv
git commit -m "$(cat <<'EOF'
chore(log): session sess-YYYYMMDD-HHMM

Task: T-NNN
https://claude.ai/code/session_01SxYzBLi2RF4xmTRQ3Dvc4P
EOF
)"
```

### 6.7 Push

```
git push origin claude/graphics-website-improvements-egAXm
```

Retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s) on network
errors. **Never** `git push --force`.

### 6.8 Exit

Stop. Don't pick a second task. The next loop iteration will handle that.

---

## 7. Sizing & overruns

If you realize mid-task that the work won't fit in ~30 minutes:

1. **Commit what you have** as a `wip:` commit:
   ```
   git commit -m "wip(T-NNN): <what's done so far>"
   ```
2. In `TODO.md`, leave the task as `- [ ]` but add a `**Progress:**` line
   summarizing what's done and what's left.
3. In `SESSIONS.md`, write a clear continuation note: "Next session: pick up
   T-NNN. The X is done; need to implement Y."
4. In `CLOCK.csv`, set `outcome` to `wip` and `commit_shas` to the wip SHA.
5. Push and exit.

The next session reads `SESSIONS.md`, sees the continuation note, and
prefers T-NNN over picking a fresh task.

If a task is consistently being WIP'd across 3+ sessions, the next session
should split it into smaller sub-tasks in `TODO.md`.

---

## 8. No eligible task

If everything in the Backlog is checked, blocked, or depends on something
not done:

1. Don't commit any code changes.
2. In `CLOCK.csv`, append a row with `task_ids` empty and `outcome` =
   `no-task`. Set `ended_at` immediately.
3. Append a brief entry to `SESSIONS.md` noting "backlog dry; recommend
   human review."
4. Commit and push just the bookkeeping update.
5. Exit.

Don't invent new work or wander outside the backlog. Surfacing "I have
nothing to do" is a valid and useful signal.

---

## 9. Ambiguity & blocked-needs-human

If a task in the backlog has unresolved decisions (license choice, naming,
hero copy, etc.), it should already be marked `BLOCKED-NEEDS-HUMAN`. If you
encounter one that isn't marked but should be:

1. Add `BLOCKED-NEEDS-HUMAN` tag and a question to the task in `TODO.md`.
2. Move on to the next eligible task.
3. Note the escalation in `SESSIONS.md`.

If you discover ambiguity *while* doing a task, prefer the path that's:

- Most reversible
- Smallest in scope
- Closest to existing conventions in the repo

Document the call you made in `SESSIONS.md` so the human can override if
they disagree.

---

## 10. Hard rules (never violate)

- **Never `git push --force`** under any circumstances.
- **Never create a new branch.** Stay on `claude/graphics-website-improvements-egAXm`.
- **Never create a PR.** PR #1 already exists.
- **Never delete files** you didn't create in this session, unless the task
  explicitly says to.
- **Never bypass hooks** (`--no-verify`, `--no-gpg-sign`, etc.).
- **Never amend commits** that are already pushed. Always make a new commit.
- **Never write code you can't briefly justify** to the human in `SESSIONS.md`.
- **Never add tracking, analytics, or third-party SDKs** without a task
  explicitly authorizing it.
- **Never claim a task done if you couldn't verify it.** Mark it `wip` instead.

---

## 11. Conventions reference

**File locations:**

- `ROADMAP.md` — vision, principles, anti-list. Read once for grounding.
- `TODO.md` — actionable backlog. Read every session.
- `SESSIONS.md` — append-only log. Read last entry; append yours.
- `CLOCK.csv` — append-only timesheet. Read last row; append/edit yours.
- `.claude/AGENT.md` — this file.
- `.claude/commands/work-session.md` — the slash command.

**Branch:** `claude/graphics-website-improvements-egAXm`

**PR:** #1

**Commit-trailer URL:** Always include
`https://claude.ai/code/session_01SxYzBLi2RF4xmTRQ3Dvc4P` as the last line of
the commit body.

**Time format:** ISO-8601 UTC, e.g. `2026-05-13T14:23:00Z`. Get it with
`date -u +%FT%TZ`.

**Session ID format:** `sess-YYYYMMDD-HHMM` UTC. Get it with
`date -u +sess-%Y%m%d-%H%M`.
