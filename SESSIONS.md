# Sessions log

Append-only log of work sessions. Newest at the bottom.

Each entry follows this format:

```
## sess-YYYYMMDD-HHMM  ·  <agent-model-id>

- **Started / ended (UTC):** YYYY-MM-DDTHH:MM:SSZ → YYYY-MM-DDTHH:MM:SSZ (N min)
- **Task:** T-NNN · <one-line title>
- **Outcome:** completed | wip | blocked | no-task | aborted
- **Commit:** <short-sha>

**What I did**
- bullet
- bullet
- bullet

**Files changed**
- `path/to/file`

**Notes / continuation**
Free-form prose. If `wip`, what's left? If `blocked`, what's the question?
If you discovered something a future session should know, write it here.
```

See `.claude/AGENT.md` §6.4 for the full rules.

---

*(No sessions yet. The first scheduled session will append below this line.)*
