# Text Field & Rich Text Editor Improvement Plan

## Context

Two issues prompted this:
1. **Proposal checklist truncation** — "Current Issues We'll Solve" and "Next Steps" use `<input type="text">` which truncates long text
2. **Quotation textarea sizing** — Options/Additional Notes (`rows="3"`) and Internal Notes (`rows="2"`) are too small

TipTap v3 is already integrated at `src/lib/components/RichTextEditor.svelte` but only used in contract templates/schedules. Expanding it to other document types + creating an auto-resize textarea for simpler fields covers both issues.

**No database migrations needed** — all affected columns are `text` type, which can store HTML.

## Phase 1: Quick Wins (AutoResize + Truncation Fix)

### New Component: `AutoResizeTextarea.svelte`
- Location: `src/lib/components/AutoResizeTextarea.svelte`
- Auto-grows with content, min-height configurable
- Replaces fixed-row textareas where rich text is overkill

### Fix Proposal Checklist Truncation
- **File:** `src/routes/(app)/[agencySlug]/proposals/[proposalId]/+page.svelte`
- `currentIssues` array items: change `<input type="text">` → `AutoResizeTextarea`
- `nextSteps` array items: same change
- These are short checklist items — rich text is overkill, auto-resize is sufficient

### Fix Quotation Textarea Sizing
- **File:** `src/routes/(app)/[agencySlug]/quotations/[quotationId]/+page.svelte`
- `optionsNotes`: replace `<textarea rows="3">` → `AutoResizeTextarea`
- `notes` (internal): replace `<textarea rows="2">` → `AutoResizeTextarea`

## Phase 2: RichTextEditor Rollout

Expand existing `RichTextEditor.svelte` to longer-form content fields. Group by document type:

### Proposals
- **File:** `src/routes/(app)/[agencySlug]/proposals/[proposalId]/+page.svelte`
- Fields to upgrade: `executiveSummary`, `opportunityContent`, `localAdvantageContent`, `closingContent`
- These are multi-paragraph content blocks that benefit from formatting

### Quotations
- **File:** `src/routes/(app)/[agencySlug]/quotations/[quotationId]/+page.svelte`
- Fields: `optionsNotes` (upgrade from Phase 1 AutoResize → RichText), terms block `content` fields
- Terms blocks already store structured text — rich formatting is natural

### Invoices
- **File:** `src/routes/(app)/[agencySlug]/invoices/[invoiceId]/+page.svelte`
- Fields: `publicNotes`, `notes` (internal)

### Contracts (already done)
- Contract templates and schedules already use RichTextEditor — no changes needed

## Phase 3: View Mode + PDF Rendering

### View Mode Updates
- Anywhere these fields are displayed read-only, use `{@html sanitizeHtml(content)}` instead of plain text
- `sanitizeHtml()` already exists at `src/lib/utils/sanitize.ts` (DOMPurify-based)
- Affects: proposal view/preview, quotation view/preview, invoice view/preview

### PDF Template Updates
- **Files:**
  - `src/lib/templates/proposal-pdf.ts`
  - `src/lib/templates/quotation-pdf.ts`
  - `src/lib/templates/invoice-pdf.ts`
  - `src/lib/templates/contract-pdf.ts` (already handles HTML)
- Change: render HTML content directly instead of wrapping in `<p>` tags
- Use `escapeHtml()` only for non-rich fields (names, emails, etc.)
- Rich content fields pass through as-is (already sanitized on save)

## Key Files

| File | Role |
|------|------|
| `src/lib/components/RichTextEditor.svelte` | Existing TipTap v3 editor (reuse as-is) |
| `src/lib/components/AutoResizeTextarea.svelte` | NEW — auto-growing textarea |
| `src/lib/utils/sanitize.ts` | Existing DOMPurify sanitizer (reuse) |
| `src/routes/(app)/[agencySlug]/proposals/[proposalId]/+page.svelte` | Proposal edit page |
| `src/routes/(app)/[agencySlug]/quotations/[quotationId]/+page.svelte` | Quotation edit page |
| `src/routes/(app)/[agencySlug]/invoices/[invoiceId]/+page.svelte` | Invoice edit page |
| `src/lib/templates/*-pdf.ts` | PDF templates (4 files) |

## Verification

1. `npm run check` — no type errors after each phase
2. Phase 1: Open a proposal, type long text in "Current Issues" items — should wrap instead of truncate
3. Phase 1: Open a quotation, type in notes fields — should auto-grow
4. Phase 2: Open proposal edit, verify RichTextEditor renders with toolbar for content fields
5. Phase 2: Save rich content, reload page — formatting preserved
6. Phase 3: View proposal/quotation preview — HTML renders correctly (bold, lists, etc.)
7. Phase 3: Generate PDF — rich content renders with formatting in PDF output
8. Check no XSS: verify `sanitizeHtml()` strips dangerous tags in view mode
