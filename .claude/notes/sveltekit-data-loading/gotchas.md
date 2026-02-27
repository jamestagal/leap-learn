# SvelteKit Data Loading Gotchas

## Remote Functions + Top-Level Await: Component Remount Issue

**Discovered:** 2026-02-12
**Impact:** Component state (form step index, modals, unsaved inputs) resets unexpectedly after `command()` calls

### Context: SvelteKit's Intended Pattern

The SvelteKit remote functions docs **explicitly encourage** top-level `await` in components:

```svelte
<!-- Official SvelteKit pattern -->
<script>
  const post = $derived(await getPost(params.slug));
</script>
<p>likes: {await getLikes(item.id)}</p>
```

This is the **intended** way to use remote functions with `experimental.async: true`. The framework is designed so that `.refresh()` on a query reactively updates the `await` expression without destroying the component.

### The Problem We Hit

Despite this being the intended pattern, we experienced component remounts when calling `command()` functions from the consultation edit page:

```svelte
<script lang="ts">
  // Top-level await in +page.svelte
  const consultation = await getConsultation(data.consultationId);
  const form = await getFormById(consultation.formId);

  async function handleStepChange(direction, stepIndex, formData) {
    await updateDynamicConsultation({ ... }); // This caused remount
  }
</script>

<DynamicForm onStepChange={handleStepChange} />
<!-- DynamicForm's currentStepIndex resets to 0 after every step save -->
```

**What we confirmed through testing:**
1. Removing `onStepChange` (no command() on step change) → navigation works
2. Removing `.refresh()` from the command → still broken
3. Moving data fetch to `+page.server.ts` → everything works

### The Working Fix

Move data fetching into `+page.server.ts` so the page component has no top-level `await`:

```typescript
// +page.server.ts
export const load: PageServerLoad = async ({ params }) => {
  const consultation = await getConsultation(params.id);
  // ... resolve form schema, build initialData
  return { consultation, formSchema, initialData };
};
```

```svelte
<!-- +page.svelte — synchronous -->
<script lang="ts">
  let { data }: PageProps = $props();
  const consultation = data.consultation;
</script>
```

### Why This Works (Hypothesis)

The page has BOTH a `+page.server.ts` `load` function AND top-level `await` of remote queries. When a `command()` runs, SvelteKit may re-run the server `load` function, which causes the page to re-render. With top-level `await` in the component, this re-render destroys and recreates the async boundary.

By moving all data fetching into `+page.server.ts`, the page component is synchronous. Server load re-runs just update `data` props reactively.

### Important Nuance

**Top-level `await` is NOT universally wrong** — it's the official SvelteKit remote functions pattern. The issue appears specific to pages that:
1. Have BOTH `+page.server.ts` AND top-level `await` in the component
2. Call `command()` functions that interact with the same or related queries
3. Have stateful child components (like multi-step forms) that can't survive remounts

### Recommendation for This Codebase

Since our pages commonly have `+page.server.ts` load functions (for auth, agency context, etc.) AND need to call `command()` functions, **prefer loading data in `+page.server.ts`** rather than using top-level `await` in components. This avoids the interaction between server load re-runs and async boundaries.

For read-only pages with no mutations, top-level `await` is fine.

### `.refresh()` in Commands

`.refresh()` inside a `command()` tells SvelteKit to send the refreshed query data back with the command response. This is the "single-flight mutation" pattern from the docs:

```typescript
export const addLike = command(v.string(), async (id) => {
  await db.sql`UPDATE item SET likes = likes + 1 WHERE id = ${id}`;
  getLikes(id).refresh(); // Updated data sent with command response
});
```

In our case, we removed `.refresh()` from `updateDynamicConsultation` because the edit page doesn't need the consultation data to update reactively during editing — the user is providing the data, not reading it.

### Real Incident

The consultation edit page had `const consultation = await getConsultation(data.consultationId)` at the top level. Every time `updateDynamicConsultation()` was called in `onStepChange`, DynamicForm's `currentStepIndex` reset to 0. Users couldn't advance past step 1.

**Fix:** Moved `getConsultation()`, `getFormById()`, `buildFormSchema()`, and `consultationToFormData()` into `+page.server.ts`.

### Pages Fixed

- `consultation/edit/[id]/+page.svelte` — 2026-02-12
- `consultation/history/+page.svelte` — 2026-02-12
- `proposals/+page.svelte` — 2026-02-12
- `proposals/[proposalId]/+page.svelte` — 2026-02-12

### Pages With Top-Level Await (Monitor)

These pages use top-level `await` and may break if mutations are added:

- `proposals/new/+page.svelte` — `await getCompletedConsultations()`, `await getActivePackages()` (MEDIUM risk)
- `consultation/view/[id]/+page.svelte` — `await getConsultation()` (LOW risk, read-only)
- `super-admin/form-templates/+page.svelte` — `await getFormTemplatesAdmin()` (MEDIUM risk)
- `super-admin/form-templates/[templateId]/+page.svelte` — `await getFormTemplateAdmin()` (MEDIUM risk)
