Capture an idea, bug, or improvement to the backlog for later triage.

## Instructions

1. Create `backlog/` directory at project root if it doesn't exist
2. Generate a filename: `YYYY-MM-DD-{slug}.md` where slug is a 3-5 word kebab-case summary
3. Write the file with this format:

```markdown
# {Short title}

**Captured**: {date}
**Type**: {bug | idea | improvement | tech-debt}
**Area**: {area of codebase, e.g. "client/settings", "core/billing", "infra"}

## Description

{The user's input, preserved verbatim}

## Context

{If the user was working on something when they captured this, note what file/feature they were in. Otherwise omit this section.}
```

4. Confirm with a one-line summary: "Captured to `backlog/{filename}`"

## Rules

- Do NOT start working on the captured item
- Do NOT add it to any GSD phase or milestone
- Do NOT read files or explore the codebase
- Keep it fast -- capture and move on
- If the user's input is vague, capture it as-is. Don't ask clarifying questions.

## Arguments

$ARGUMENTS - The idea, bug, or task to capture
