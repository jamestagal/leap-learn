# Claude Code Power User Strategy Guide

*Source: Boris Cherny (Claude Code creator) - X thread, January 31, 2025*

---

## The 10 Tips from the Claude Code Team

### 1. Parallel Worktrees — The Biggest Productivity Unlock

**What**: Run 3–5 git worktrees simultaneously, each with its own Claude session.

**Setup**:
```bash
# Create worktrees
git worktree add ../project-feature-a feature-a
git worktree add ../project-feature-b feature-b  
git worktree add ../project-analysis main  # Read-only analysis

# Shell aliases for instant switching
echo 'alias za="cd ~/projects/myproject-wt-a && claude"' >> ~/.zshrc
echo 'alias zb="cd ~/projects/myproject-wt-b && claude"' >> ~/.zshrc
echo 'alias zc="cd ~/projects/myproject-wt-c && claude"' >> ~/.zshrc
```

**Patterns to use**:
- **Dedicated analysis worktree**: Keep one session purely for reading logs, running queries, exploring code—never modifies anything
- **Feature isolation**: Each feature gets its own worktree + Claude session
- **Review worktree**: One session reviews PRs while others build

**Why it works**: Each Claude session has full 200k context dedicated to one task. No cross-contamination.

---

### 2. Plan Mode First — Pour Energy Into the Plan

**What**: Start complex tasks in plan mode. Get the plan right, then 1-shot the implementation.

**Workflow**:
```
You: /plan Implement user authentication with OAuth2

Claude: [Creates detailed plan]

You: [Review, ask questions, refine]

You: Now spin up a second Claude to review this plan as a staff engineer

Claude 2: [Reviews plan, finds gaps]

You: [Back to Claude 1] Address these concerns: [paste feedback]

Claude: [Refines plan]

You: Execute the plan
```

**Key insight from Boris's team**: "The moment something goes sideways, switch back to plan mode and re-plan. Don't keep pushing."

**For verification too**: Don't just run tests—tell Claude to enter plan mode for verification steps:
```
You: Enter plan mode. How would you verify this implementation is correct?
```

---

### 3. Self-Evolving CLAUDE.md

**What**: Make Claude write rules for itself after every correction.

**The magic phrase**:
```
"Update your CLAUDE.md so you don't make that mistake again."
```

**Project notes pattern** (from one engineer):
```
.claude/
├── CLAUDE.md                 # Global rules
└── notes/
    └── {task-name}/
        ├── learnings.md      # Updated after every PR
        └── gotchas.md        # Task-specific pitfalls
```

In CLAUDE.md, point to notes:
```markdown
## Project Notes
When working on this codebase, always check `.claude/notes/` for 
task-specific learnings from previous sessions.
```

**Ruthlessly edit over time**: Keep iterating until Claude's mistake rate measurably drops.

---

### 4. Custom Skills & Commands

**What**: If you do something more than once a day, turn it into a skill or command.

**High-value commands to create**:

| Command | Purpose |
|---------|---------|
| `/techdebt` | End of session: find and kill duplicated code |
| `/sync` | Pull 7 days of Slack, GDrive, Asana, GitHub into one context dump |
| `/morning` | Load current state, pending tasks, recent commits |
| `/checkpoint` | Save progress, update state file, commit |

**Example `/techdebt` command**:
```markdown
<!-- .claude/commands/techdebt.md -->
Scan the codebase for:
1. Duplicated code blocks (>10 similar lines)
2. TODO/FIXME comments older than 1 week
3. Functions longer than 50 lines
4. Dead code / unused exports
5. Missing error handling

For each item found, output:
- Location
- Severity (high/medium/low)
- Suggested fix
```

---

### 5. Bug Fixing Automation

**What**: Let Claude fix bugs autonomously with minimal direction.

**Patterns**:

```
# Slack bug → Fix (zero context switching)
[Enable Slack MCP]
You: [paste Slack bug thread] Fix this.

# CI failures
You: Go fix the failing CI tests.

# Distributed systems
You: Here are the docker logs. Troubleshoot why requests are failing.
```

**Key**: Don't micromanage how. Just state the outcome you want.

---

### 6. Level Up Your Prompting

**Three powerful patterns**:

**a) Challenge Claude**:
```
"Grill me on these changes and don't make a PR until I pass your test."
```
```
"Prove to me this works—diff the behavior between main and this branch."
```

**b) The elegant solution prompt**:
```
"Knowing everything you know now, scrap this and implement the elegant solution."
```
Use after a mediocre fix that technically works but feels wrong.

**c) Reduce ambiguity**: Write detailed specs before handing work off. More specific = better output.

---

### 7. Terminal & Environment Setup

**Recommendations from the team**:

- **Terminal**: Ghostty (synchronized rendering, 24-bit color, unicode support)
- **Status bar**: Use `/statusline` to always show context usage + current git branch
- **Tab organization**: Color-code and name terminal tabs (one per task/worktree)
- **tmux**: For persistent sessions across SSH/restarts

**Voice dictation** (underrated):
```
macOS: Hit fn twice to activate dictation
```
You speak 3x faster than you type → prompts get way more detailed.

---

### 8. Use Subagents Strategically

**Three patterns**:

**a) Throw more compute at hard problems**:
```
"Implement this feature. Use subagents."
```

**b) Keep main context clean**:
```
"Offload the test generation to a subagent. Return only the summary."
```

**c) Auto-approve safe permissions** (advanced):
Route permission requests through a hook that uses Opus 4.5 to scan for attacks and auto-approve safe ones.

```python
# hooks/permission-check.py (conceptual)
# Route to Opus 4.5 → approve if safe, deny if suspicious
```

---

### 9. Data & Analytics in Claude Code

**What**: Use CLI tools for ad-hoc analytics without leaving Claude.

**Example with BigQuery**:
```
You: Use the bq CLI to find our top 10 customers by revenue this month.

Claude: [Runs bq query, returns results]
```

**Works for any database with**: CLI, MCP server, or API.

**Create a BigQuery/SQL skill**:
```markdown
<!-- .claude/skills/analytics.md -->
When asked for analytics:
1. Use `bq query` for BigQuery
2. Use `psql` for Postgres  
3. Format results as markdown tables
4. Include the query used for reproducibility
```

Boris: "I haven't written a line of SQL in 6+ months."

---

### 10. Learning with Claude

**Four patterns**:

**a) Enable explanatory mode**:
```
/config → Set output style to "Explanatory" or "Learning"
```
Claude explains the *why* behind changes.

**b) Visual presentations**:
```
"Generate an HTML presentation explaining how the auth system works."
```
Claude makes surprisingly good slides.

**c) ASCII diagrams**:
```
"Draw an ASCII diagram of this protocol flow."
```
Great for understanding unfamiliar codebases.

**d) Spaced repetition skill** (advanced):
Build a skill where you explain your understanding, Claude asks follow-ups to fill gaps, stores the result for later review.

---

## Implementation Checklist

### Week 1: Foundation
- [ ] Set up 3 git worktrees with shell aliases (za, zb, zc)
- [ ] Create `.claude/notes/` directory structure
- [ ] Add the magic phrase to your workflow: "Update CLAUDE.md so you don't make that mistake again"
- [ ] Enable voice dictation (fn fn on macOS)

### Week 2: Commands & Skills
- [ ] Create `/techdebt` command
- [ ] Create `/checkpoint` command  
- [ ] Set up BigQuery/database skill if relevant
- [ ] Configure `/statusline` with context usage + branch

### Week 3: Workflow Refinement
- [ ] Practice the two-Claude planning pattern (planner + staff reviewer)
- [ ] Use "use subagents" for complex implementations
- [ ] Try the elegant solution prompt after mediocre fixes
- [ ] Set up Slack MCP for bug intake

### Ongoing
- [ ] Ruthlessly edit CLAUDE.md based on mistake patterns
- [ ] Turn any repeated task into a skill/command
- [ ] Review and update `.claude/notes/` after each PR

---

## Quick Reference Card

| Situation | Action |
|-----------|--------|
| Starting complex task | `/plan` first, refine before executing |
| Something goes sideways | Stop. Re-enter plan mode. Re-plan. |
| Claude makes a mistake | "Update your CLAUDE.md so you don't make that mistake again" |
| Need more compute | Append "use subagents" to request |
| Bug from Slack | Paste thread + "Fix this" |
| CI failing | "Go fix the failing CI tests" |
| Mediocre solution works | "Knowing everything you know now, scrap this and implement the elegant solution" |
| Want Claude to prove correctness | "Grill me on these changes" or "Prove this works" |
| Repeated task | Turn it into a skill or command |
| Context getting polluted | Spin up new worktree/session |

---

*"There is no one right way to use Claude Code—everyone's setup is different. Experiment to see what works for you."* — Boris Cherny
