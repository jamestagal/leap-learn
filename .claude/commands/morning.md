# Morning Standup

Load current project state to start the day.

## Instructions

Gather and display:

1. **Git Status**
   - Current branch
   - Uncommitted changes
   - Files staged for commit

2. **Recent Commits** (last 5)
   - Show recent work on the current branch
   - `git log --oneline -5`

3. **Open TODOs**
   - Check for any TODO comments added recently
   - Grep for `TODO` or `FIXME` in recently modified files

4. **Active Feature Notes**
   - Check `.claude/notes/` for any active task folders
   - Read recent learnings and gotchas

5. **Branch Context**
   - If on a feature branch, show what it's for (from branch name)
   - Show commits ahead/behind main

## Output Format

```
## Good Morning! Here's where we left off:

### Current Branch
`feature/xxx` - X commits ahead of main

### Recent Commits
- abc1234 commit message 1
- def5678 commit message 2
...

### Uncommitted Changes
[git status output or "Clean working tree"]

### Active Notes
Reading from `.claude/notes/[feature]/`:
- Key learnings: ...
- Watch out for: ...

### Ready to Continue
[Suggest what to work on based on branch name and recent commits]
```

## Tips

- If there are uncommitted changes, ask if user wants to commit first
- If on main branch, ask what feature to work on
- Reference any open PRs if relevant
