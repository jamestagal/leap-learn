# SvelteKit Data Loading Learnings

## Remote Functions: Two Valid Patterns

SvelteKit remote functions support **two** data loading patterns. Both are valid but have different trade-offs.

### Pattern 1: Top-Level Await (Official SvelteKit Pattern)

```svelte
<script lang="ts">
  import { getPost } from './data.remote';
  const post = $derived(await getPost(params.slug));
</script>
```

- Simpler, less boilerplate
- Queries reactively update via `.refresh()` or `.set()`
- Works well for simple pages
- **Caution:** May cause issues on pages that ALSO have `+page.server.ts` load functions AND call `command()` functions (see gotchas.md)

### Pattern 2: Server Load (Traditional SvelteKit Pattern)

```typescript
// +page.server.ts
export const load: PageServerLoad = async ({ params }) => {
  const items = await getItems();
  return { items };
};
```

```svelte
<!-- +page.svelte -->
<script lang="ts">
  let { data }: PageProps = $props();
  let items = $derived(data.items);
</script>
```

- More boilerplate but more predictable
- Component is synchronous — no async boundary issues
- Use `invalidateAll()` after mutations to refresh data
- **Preferred** when the page has stateful child components (forms, wizards) that call `command()` functions

### When to Use Which

| Scenario | Pattern |
|----------|---------|
| Read-only display page | Either works |
| Page with `command()` mutations + stateful components | Server Load |
| Page already has `+page.server.ts` for auth/context | Server Load (keep all data loading together) |
| Simple page, no `+page.server.ts` needed | Top-Level Await |

## Mutation + Refresh Patterns

### Server Load pages: `invalidateAll()`

```typescript
async function handleDelete(id: string) {
  await deleteItem({ id });
  await invalidateAll(); // Re-runs +page.server.ts load
}
```

### Top-Level Await pages: `.refresh()` or `.updates()`

```typescript
// In the command itself (server-side):
export const addLike = command(v.string(), async (id) => {
  await db.update(...);
  getLikes(id).refresh(); // Single-flight mutation
});

// Or from the client:
await addLike(item.id).updates(getLikes(item.id));
```

## Multi-Step Form Auto-Save

For forms that save on step change without losing state:

1. Load form data in `+page.server.ts`
2. Keep page component synchronous (no top-level `await`)
3. `onStepChange` handler calls `command()` safely — component doesn't remount
4. If save fails, throw to prevent step advancement

```svelte
<DynamicForm
  schema={data.formSchema}
  initialData={data.initialData}
  onStepChange={handleStepChange}
  onSave={handleSave}
  onSubmit={handleSubmit}
/>
```
