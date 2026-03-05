# Claude Cowork: Validated Best Practices Guide

## Validation Summary

The article is **largely legitimate** — the core features it describes are real and confirmed in Anthropic's official documentation. However, there are a few inaccuracies and some "secrets" that are really just general good-AI-usage advice dressed up as Cowork discoveries.

| Claim | Verdict | Notes |
|---|---|---|
| Cowork launched January 12, 2026 | ✅ Confirmed | Correct |
| Global & Folder Instructions | ✅ Confirmed | Launched with Windows update |
| Scheduled tasks | ✅ Confirmed | In release notes |
| Plugins and connectors | ✅ Confirmed | Real, in official docs |
| No memory between sessions | ✅ Confirmed | Documented as a current limitation |
| Subagents / parallel processing | ✅ Confirmed | Core architecture |
| Deletion protection | ✅ Confirmed | Documented |
| Desktop must stay open | ✅ Confirmed | Sessions end if app closes |
| "Over a million tokens on Opus 4.6" | ⚠️ Inaccurate | The 1M context window is **Sonnet 4.6** in beta — not Opus 4.6 |
| Plugin marketplace for enterprise | ✅ Confirmed | Team & Enterprise plans |
| `/schedule` slash command | ⚠️ Unconfirmed | Scheduled tasks are real; slash command syntax not in official docs |
| "Plugin Management plugin" by that name | ⚠️ Unconfirmed | Not in official documentation |
| S-tier / A-tier plugin rankings | ❌ Not official | Author's own opinion, no official tier list exists |
| `_MANIFEST.md` approach | 💡 Good idea, not a feature | Sound general advice for LLM context management — not a built-in Cowork feature |
| The three context files approach | 💡 Good idea, not a feature | General best practice, not Cowork-specific |

**Bottom line:** Trust the setup advice. Be sceptical of anything implying a specific built-in feature name or UI path that you can't find in Settings.

---

## Part 1: Context Architecture

These are the highest-leverage practices. Do these first.

### 1. Create a `_MANIFEST.md` in every project folder

Cowork reads everything in the folder you give it access to — including outdated drafts and superseded files. A manifest tells it what to prioritise.

**Create a file called `_MANIFEST.md` (underscore keeps it sorted first) with this structure:**

```markdown
# Project Manifest

## Tier 1 — Source of Truth (read first, always)
- `project-brief.md` — Current goals and scope
- `brand-voice.md` — Tone and communication standards
- `strategy-2025.md` — Current strategic direction

## Tier 2 — Domain files (load only when relevant)
- `/pricing/` → Rate cards and pricing models
- `/research/` → Competitor and market analysis
- `/templates/` → Standard document templates

## Tier 3 — Archival (ignore unless explicitly asked)
- `/archive/` → Old drafts and superseded versions
- `/reference/` → Background reading, not active documents
```

**Then add this to your Global Instructions (see Practice 2):**

```
When starting any task, look for _MANIFEST.md first. Load Tier 1 files. 
Only load Tier 2 files when the task explicitly involves that domain. 
Never load Tier 3 files unless I specifically ask.
```

> ℹ️ **When you need this:** Any folder with more than ~10 files, or any project folder that accumulates files over weeks.

---

### 2. Set up Global Instructions as your permanent baseline

**Where to find it:** Settings → Customize (or similar — UI may vary by app version)

Global Instructions load before everything else in every session. Most users leave this blank. Filling it in is the single biggest quality-of-life improvement.

**Starter template — adapt to yourself:**

```
I'm [Your Name], a [Your Role] at [Organisation].

Before starting any task:
- Look for _MANIFEST.md and read Tier 1 files first
- Show me a brief plan before executing anything
- Ask clarifying questions if the task is ambiguous

Output defaults:
- Format: .docx unless I specify otherwise
- Style: Direct, no filler language, no padding
- Quality bar: deliverable should be usable without major editing

When uncertain:
- Flag it rather than guessing
- If confidence is below ~80%, say so and ask
```

> ✏️ Refine this over time. Every session that produces output you don't like is a signal to add one line here.

---

### 3. Build three persistent context files

Create a folder called `00_Claude Context` (so it sorts to the top) with these three files. Grant Cowork access to this folder in every session.

**`about-me.md`**
```markdown
# About Me

**Role:** [Your actual role, not your job title]
**Organisation:** [Name and what it does]
**Current priorities:** [2-3 things you're working on right now]
**Who I serve:** [Your audience, clients, or stakeholders]

## Example of my best work
[Paste a paragraph from something you wrote that you're proud of]
```

**`brand-voice.md`**
```markdown
# My Communication Style

## Tone
[3-4 descriptors: e.g. "Direct, warm, evidence-led, never jargon-heavy"]

## Words I use
[Examples of phrasing you reach for naturally]

## Words I never use
[AI clichés, corporate speak, phrases that feel wrong]

## Formatting preferences
- Headings: [yes/no, what level]
- Lists: [when to use them vs prose]
- Length: [how long is a typical piece from me]

## Reference sample
[Paste 2-3 paragraphs of your actual writing]
```

**`working-style.md`**
```markdown
# How I Work with Claude

## Collaboration rules
- Always show a plan before executing
- Ask before making irreversible changes
- If I say "draft this", give me a first pass — don't ask 10 questions first

## Things to avoid
- Filler phrases like "Certainly!", "Great question!", "Of course!"
- Padding to hit a word count
- Summaries that just repeat what I said

## Standard output formats
- Reports: .docx with headings, executive summary at top
- Emails: Plain text, max 150 words unless specified
- Research: Bullet points with source noted
```

---

### 4. Use Folder Instructions for project-specific context

When you select a folder in Cowork, you can set Folder Instructions specific to that project. These layer on top of Global Instructions.

**Example for a client project:**

```
Client: [Client Name]
Project: [Project Name] — due [Date]
Goal: [One sentence on what we're trying to achieve]
Terminology: Use "learners" not "students". Use "unit" not "module".
Deliverable format: All outputs go to /deliverables/ subfolder.
Stakeholders: [Names and roles if relevant]
```

> ℹ️ Think of it as the briefing document you'd give a new team member starting on the project today.

---

## Part 2: Task Design

### 5. Define the end state, not the process

Cowork is an autonomous agent, not a chatbot. Give it the destination, not turn-by-turn directions.

**❌ Weak prompt:**
```
Help me organise my files.
```

**✅ Strong prompt:**
```
Organise all files in this folder into subfolders by client name. 
Use the format YYYY-MM-DD-descriptive-name for all filenames. 
Create a log.md documenting every change made. 
Don't delete anything. 
If a file could belong to multiple clients, move it to /needs-review/.
```

Every strong task prompt answers three questions:
1. What does **done** look like?
2. What are the **constraints**?
3. What should Claude do when it's **uncertain**?

---

### 6. Always request a plan before execution

Add to your Global Instructions:
```
Show me a brief plan before taking action on any task. 
Wait for my approval before executing.
```

This adds a 30-second review window before anything happens to your files. It costs almost nothing and prevents mistakes that take 20 minutes to undo.

**What a good plan response looks like:**
```
Plan:
1. Create subfolders: /clients/AcmeCorp, /clients/Globodyne, /needs-review
2. Move 34 files based on filename patterns
3. Rename 12 files with generic names using content analysis
4. Write log.md with a record of every action

Proceed?
```

---

### 7. Build uncertainty handling into every task

Tell Claude what to do at the edges, not just the middle.

**Add to any file organisation task:**
```
If a file could belong to multiple categories, put it in /needs-review.
If a date can't be determined, use UNKNOWN-DATE in the filename.
If you're less than 80% confident in a classification, flag it rather than guessing.
```

**Add to any data extraction task:**
```
If a value is missing or unclear, write [VERIFY] rather than leaving it blank or guessing.
If a field has multiple plausible interpretations, note both and ask me.
```

**Add to any research task:**
```
If a source is behind a paywall or unavailable, note it and continue with what's accessible.
If you find conflicting information, present both versions with sources rather than resolving the conflict yourself.
```

---

### 8. Batch related work into single sessions

Each session has a startup cost. Run related tasks together.

**❌ Five separate sessions:**
- Session 1: Process expense receipts
- Session 2: Update budget spreadsheet
- Session 3: Write summary report
- Session 4: Draft email to finance
- Session 5: File everything

**✅ One batched session:**
```
I need to process this month's expenses. Do all of the following in one session:
1. Extract amounts and dates from the receipt images in /receipts/feb/
2. Update the budget spreadsheet with the new entries
3. Generate a one-page summary report
4. Draft a short email to finance@org.com attaching the report
5. Save all outputs to /monthly-reports/feb-2026/
```

Context from step 1 feeds step 2. Step 2 feeds step 3. Everything is connected.

---

### 9. Use subagents for genuinely parallel work

For tasks with independent parts, you can prompt Cowork to work on them simultaneously.

**How to trigger it:**
Include "work on these in parallel" or describe clearly independent subtasks.

**Example:**
```
I'm evaluating three vendors for our LMS platform. 
Research each one independently and in parallel:
- Vendor A: pricing, support reputation, integration with Moodle
- Vendor B: pricing, support reputation, integration with Moodle  
- Vendor C: pricing, support reputation, integration with Moodle

Produce a comparison table when done.
```

**Good uses for parallel processing:**
- Competitive/vendor analysis (multiple independent subjects)
- Processing batches of similar files
- Researching multiple angles on one question (financial, operational, user experience)
- Running the same analysis across multiple data sources

> ⚠️ **Note:** The article claims subagents work best on "Opus 4.6" with over a million token context. The 1M context window is actually confirmed for **Sonnet 4.6** in beta — not Opus. Use whichever model your plan gives you access to.

---

## Part 3: Automation and Scheduling

These are confirmed real features — Anthropic's own release notes document scheduled tasks.

### 10. Set up scheduled tasks

Scheduled tasks are available in Cowork. Find the scheduling option in the task interface or Customize section.

**Good candidates for scheduling:**

**Monday morning briefing:**
```
Every Monday at 8 AM:
- Check my /inbox-processed/ folder for any new items flagged last week
- Summarise what's on my calendar this week (if calendar connector is active)
- List any tasks marked [TODO] across my active project folders
- Save a briefing to /weekly-briefings/YYYY-MM-DD-briefing.md
```

**Weekly status report:**
```
Every Friday at 4 PM:
- Review /deliverables/ for anything created this week
- Draft a 5-bullet status update summarising what was completed
- Save to /reports/weekly/YYYY-MM-DD-status.md
```

**Recurring research digest:**
```
Every Tuesday at 9 AM:
- Search for news about [topic] from the past week
- If there's anything new and substantive, write a 200-word summary
- Save to /research/digests/ only if something noteworthy was found
```

> ⚠️ **Limitation confirmed in official docs:** The desktop app must be **open and awake** for scheduled tasks to run. If your machine is asleep, Cowork will catch up when you're back.

---

### 11. Combine scheduling with connectors

Connectors extend Cowork's reach to external tools (Gmail, Slack, Google Drive, Notion, and others). Find them in Settings → Connectors.

**Useful combinations:**

*Gmail + Schedule:*
```
Every morning at 8:30 AM:
- Check Gmail for any emails with invoice attachments received in the last 24 hours
- Extract the vendor name, amount, and due date from each
- Add a row to /finance/invoices-2026.xlsx for each one
```

*Slack + Schedule:*
```
Every Friday at 3 PM:
- Pull all messages from the #project-feedback Slack channel from this week
- Group them by theme (bug reports, feature requests, praise, confusion)
- Write a summary to /reports/feedback/YYYY-MM-DD.md
```

> Start with Gmail and Slack. Those two connectors cover most recurring knowledge-work tasks.

---

## Part 4: Plugins and Skills

Plugins are real — confirmed in official docs and release notes.

### 12. Install relevant plugins

Plugins add domain-specific capabilities. Find them in the Customize section of Claude Desktop.

**Starting recommendations by role:**

| Role | Suggested plugins |
|---|---|
| Teacher / EdTech | Productivity + Research (data analysis for student results) |
| Web designer | Productivity + any design/content plugin |
| Project manager | Productivity + any project management integration |
| Researcher | Research/Data Analysis plugins |

> ⚠️ The article references a specific "tier list" of plugins — this is the author's personal opinion, not an official Anthropic ranking. Browse the actual marketplace and judge by your use case.

---

### 13. Build custom skill files for repeatable workflows

A skill file is a markdown document that encodes how Claude should approach a specific, repeatable task. Save it in your working folder.

**Template:**

```markdown
# Skill: [Name]

## Purpose
[One sentence: what this skill produces]

## When to use
[Trigger condition: "Use this when I ask for a..."]

## Inputs needed
- [What information Claude needs before starting]
- [Files, data, or context required]

## Process
1. [Step one]
2. [Step two]
3. [Step three]

## Output
- Format: [file type and location]
- Length: [approximate]
- Quality bar: [what "done" looks like]

## Constraints
- [Things to never do]
- [Style rules]
- [Edge case handling]
```

**Example: Course content skill file for CIT units**

```markdown
# Skill: VET Learning Content Page

## Purpose
Creates a Moodle-ready HTML learning content page for a VET unit.

## When to use
When I say "create a content page for [unit code/topic]"

## Inputs needed
- Unit code and title
- Topic or element of competency
- Key concepts to cover (bullet points fine)
- Any source documents in the folder

## Process
1. Read _MANIFEST.md and Tier 1 files first
2. Identify the target learner level and context
3. Structure content: intro → key concepts → examples → summary
4. Apply Bootstrap v4 / Font Awesome v4 inline styling
5. Include at least one practical example relevant to Australian VET context
6. Save to /content-pages/[unit-code]-[topic].html

## Output
- Format: .html file, Moodle-ready
- Style: Bootstrap v4 cards, Font Awesome icons, CIT colour scheme
- Length: Equivalent to 15-25 min reading

## Constraints
- Use "learners" not "students"
- Use "unit" not "subject" or "module"
- No filler paragraphs — every section earns its place
- Always include a practical VET industry example
```

---

## Part 5: Safety Practices

These are all confirmed in official Anthropic documentation.

### 14. The non-negotiables

**Always back up before experimenting**
```
Before running any file organisation, renaming, or restructuring task:
cp -r /path/to/folder /path/to/folder-backup-YYYY-MM-DD
```
Or use Time Machine / your preferred backup tool. Cowork is accurate most of the time. "Most of the time" isn't enough for important files.

**Scope folder access tightly**
Don't grant access to your entire Documents directory. Create a working folder, put only what's needed for the task in it, and grant access to that folder.

**Add "don't delete anything" as a default**
Add to Global Instructions:
```
Never delete files unless I explicitly say "you may delete" in this specific task.
```

**Monitor the first few runs of any new workflow**
New workflow → watch the first 2-3 runs. Check the plan. Check the output. Only step away once you trust it.

**Be aware of prompt injection**
If Cowork reads an external website or untrusted document, malicious hidden instructions in that content could theoretically alter its behaviour. Don't point Cowork at untrusted URLs or unknown file sources without reviewing them.

---

## Quick-Start Checklist

### Today (30 minutes)
- [ ] Create `00_Claude Context/` folder with `about-me.md`, `brand-voice.md`, `working-style.md`
- [ ] Set Global Instructions in Settings → Customize
- [ ] Add "show a plan before executing" and "don't delete anything" to Global Instructions

### This week
- [ ] Add `_MANIFEST.md` to your most-used project folder
- [ ] Browse the plugin marketplace — install 1-2 that match your role
- [ ] Set up one scheduled task (even a simple weekly summary)

### This month
- [ ] Write your first custom skill file for your most repeated workflow
- [ ] Try a parallel subagent task (competitor research, vendor comparison, etc.)
- [ ] Refine your context files based on output quality — add one line whenever Claude gets something wrong

---

## What the Article Gets Right (Summary)

The core insight holds up: **invest in setup, reduce prompting**. The people who get great results from Cowork aren't better prompters — they've built a system of context files, instructions, and skill files that front-loads their standards and preferences. Every session then starts from a high baseline.

The practices that deliver the most impact, confirmed by official docs:

1. **Global Instructions** — sets your baseline for every session
2. **Folder Instructions** — adds project context on top
3. **Plan before execute** — prevents irreversible mistakes
4. **Define end state + uncertainty handling** — the two things that make a prompt actually work
5. **Scheduled tasks + connectors** — where Cowork becomes genuinely autonomous

The context files and `_MANIFEST.md` approach aren't built-in Cowork features — they're good general practice for working with any LLM agent that has file access. Still worth doing.
