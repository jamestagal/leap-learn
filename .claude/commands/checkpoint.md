# Checkpoint - Save Progress

Save current progress, update learnings, and optionally commit.

## Instructions

1. **Summarize Work Done**
   - List files modified this session
   - Describe what was accomplished
   - Note any patterns or solutions discovered

2. **Update Notes** (if applicable)
   - Check `.claude/notes/` for relevant task folders
   - Add new learnings to `learnings.md`
   - Add new gotchas to `gotchas.md`
   - Create new task folder if working on a new feature area

3. **Check Git Status**
   - Run `git status` to see uncommitted changes
   - Run `git diff --stat` to summarize changes

4. **Propose Commit** (if changes exist)
   - Draft a concise commit message
   - Ask user if they want to commit now

## Output Format

```
## Session Summary
- [Brief description of work done]

## Files Modified
- `file1.ts` - description
- `file2.go` - description

## Learnings Captured
- [Any patterns/learnings added to notes]

## Git Status
[Output of git status]

## Proposed Commit
[Draft commit message if there are uncommitted changes]
```

## Notes Location

Check these directories for existing notes:
- `.claude/notes/billing/` - Billing system patterns
- `.claude/notes/` - Create new folders for new feature areas
