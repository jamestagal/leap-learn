# SvelteKit Remote Functions Guide

Remote functions are an experimental SvelteKit feature that lets you write server-side code in `*.remote.ts` files and call them directly from Svelte components - no API routes or `+page.server.ts` needed.

## Setup

Enable in `svelte.config.js`:

```js
export default {
  kit: {
    experimental: {
      remoteFunctions: true
    }
  },
  compilerOptions: {
    experimental: {
      async: true  // Enables top-level await in components
    }
  }
};
```

## File Naming Convention

Remote functions live in files ending with `.remote.ts`:

```
src/routes/
├── user.remote.ts           # Available to all routes
├── admin/
│   ├── posts.remote.ts      # Admin-specific functions
│   └── +page.svelte
```

## Two Function Types

### `query()` - Data Fetching

Import from `$app/server`:

```ts
import { query } from '$app/server';
```

**Simple query (no parameters):**

```ts
export const get_all_posts = query(async () => {
  return db.query.post.findMany();
});
```

**Query with validated parameters:**

```ts
import * as v from 'valibot';

export const get_post_by_id = query(v.string(), async (id) => {
  return db.query.post.findFirst({
    where: (p, { eq }) => eq(p.id, id)
  });
});
```

**Query with multiple parameters:**

```ts
export const search_posts = query(
  v.object({
    term: v.string(),
    limit: v.number()
  }),
  async ({ term, limit }) => {
    // search logic
  }
);
```

### `form()` - Form Submissions

For mutations with built-in validation:

```ts
import { form, getRequestEvent } from '$app/server';
import { redirect, error } from '@sveltejs/kit';
import * as v from 'valibot';

export const create_post = form(
  v.object({
    title: v.pipe(v.string(), v.nonEmpty('Title is required')),
    body: v.pipe(v.string(), v.nonEmpty('Body is required'))
  }),
  async ({ title, body }) => {
    // Access request context
    const event = getRequestEvent();
    const session = await auth.api.getSession({
      headers: event.request.headers
    });

    // Authorization check
    if (session?.user?.role !== 'admin') {
      error(401, 'Unauthorized');
    }

    // Perform mutation
    await db.insert(post).values({
      title,
      body,
      authorId: session.user.id
    });

    // Redirect after success
    redirect(303, '/admin');
  }
);
```

## Using Queries in Components

### In Template with `{#each}` and `{#await}`

```svelte
<script lang="ts">
  import { get_all_posts } from './posts.remote';
</script>

{#each await get_all_posts() as post (post.id)}
  <article>
    <h2>{post.title}</h2>
    <p>{post.body}</p>
  </article>
{/each}
```

### In Script Block (Top-Level Await)

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import { get_post_by_slug } from './posts.remote';

  const post = await get_post_by_slug(page.params.slug!);
</script>

{#if post}
  <h1>{post.title}</h1>
  <p>{post.body}</p>
{/if}
```

### With `$derived` for Reactive Data

```svelte
<script lang="ts">
  import { get_user } from './user.remote';

  const user = $derived(await get_user());
</script>

{#if user.id}
  <p>Welcome, {user.email}</p>
{/if}
```

## Using Forms in Components

### Basic Form Binding

Spread the form function onto the `<form>` element and its fields onto inputs:

```svelte
<script lang="ts">
  import { create_post } from './posts.remote';
</script>

<form {...create_post}>
  <label>
    Title:
    <input {...create_post.fields.title.as('text')} />
  </label>

  <label>
    Body:
    <textarea {...create_post.fields.body.as('text')}></textarea>
  </label>

  <button type="submit">Create Post</button>
</form>
```

### Displaying Validation Errors

Each field has an `issues()` method returning validation errors:

```svelte
<form {...create_post}>
  <label>
    Title:
    <input {...create_post.fields.title.as('text')} />
  </label>

  {#each create_post.fields.title.issues() as issue (issue.message)}
    <p class="error">{issue.message}</p>
  {/each}

  <button type="submit">Submit</button>
</form>
```

### Pre-populating Form Values (Edit Forms)

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import { get_post_by_id, update_post } from './posts.remote';

  const post = await get_post_by_id(page.params.id!);
</script>

<form {...update_post}>
  <input
    {...update_post.fields.id.as('text')}
    readonly
    value={post?.id}
  />

  <input
    {...update_post.fields.title.as('text')}
    value={post?.title}
  />

  <textarea
    {...update_post.fields.body.as('text')}
    value={post?.body}
  ></textarea>

  <button type="submit">Update</button>
</form>
```

## Accessing Request Context

Use `getRequestEvent()` inside remote functions to access the request:

```ts
import { getRequestEvent, query } from '$app/server';

export const get_user = query(async () => {
  const event = getRequestEvent();

  // Access headers, cookies, etc.
  const session = await auth.api.getSession({
    headers: event.request.headers
  });

  return {
    id: session?.user.id || null,
    email: session?.user.email || null
  };
});
```

Available on `event`:
- `event.request` - The Request object (headers, method, etc.)
- `event.cookies` - Cookie access
- `event.locals` - Data from hooks
- `event.params` - Route parameters
- `event.url` - URL object

## Refreshing Data

Queries return objects with a `.refresh()` method to invalidate and refetch:

```svelte
<script lang="ts">
  import { get_user } from './user.remote';
  import { authClient } from '$lib/auth-client';

  const user = $derived(await get_user());

  function logout() {
    authClient.signOut({
      fetchOptions: {
        onSuccess: async () => {
          // Refresh user data after logout
          await get_user().refresh();
        }
      }
    });
  }
</script>
```

## Validation with Valibot

Remote functions use [Valibot](https://valibot.dev/) for schema validation:

```ts
import * as v from 'valibot';

// String validation
v.string()
v.pipe(v.string(), v.nonEmpty('Required'))
v.pipe(v.string(), v.email('Invalid email'))
v.pipe(v.string(), v.minLength(8, 'Min 8 characters'))

// Number validation
v.number()
v.pipe(v.number(), v.minValue(0))

// Object validation
v.object({
  title: v.pipe(v.string(), v.nonEmpty()),
  count: v.pipe(v.number(), v.minValue(1))
})

// Optional fields
v.object({
  name: v.string(),
  bio: v.optional(v.string())
})
```

## Authorization Patterns

### In Remote Functions

```ts
export const create_post = form(
  schema,
  async (data) => {
    const event = getRequestEvent();
    const session = await auth.api.getSession({
      headers: event.request.headers
    });

    if (!session?.user) {
      error(401, 'Not authenticated');
    }

    if (session.user.role !== 'admin') {
      error(403, 'Not authorized');
    }

    // Proceed with mutation...
  }
);
```

### Route-Level Protection (Layout Server)

Protect entire route groups via `+layout.server.ts`:

```ts
// src/routes/admin/+layout.server.ts
import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
  if (locals.user?.role !== 'admin') {
    throw redirect(302, '/');
  }
  return {};
}
```

## Key Benefits

1. **No boilerplate** - Skip `+page.server.ts`, `+server.ts`, and API routes for simple cases
2. **Type-safe** - Full TypeScript inference from server to client
3. **Colocated** - Server logic lives near where it's used
4. **Built-in validation** - Schema validation with automatic error handling
5. **Progressive enhancement** - Forms work without JavaScript
6. **Automatic serialization** - Complex data types handled automatically

## Comparison with Traditional SvelteKit

| Traditional | Remote Functions |
|-------------|------------------|
| `+page.server.ts` with `load()` | `query()` in `*.remote.ts` |
| `+page.server.ts` with `actions` | `form()` in `*.remote.ts` |
| `+server.ts` API routes | `query()` for GET-like operations |
| Manual fetch calls | Direct function imports |
| Manual form handling | Spread syntax with validation |

## When to Use Remote Functions

**Good for:**
- Simple CRUD operations
- Form submissions with validation
- Data fetching that doesn't need complex caching
- Prototyping and rapid development

**Consider traditional patterns for:**
- Complex caching strategies
- Streaming responses
- WebSocket connections
- Fine-grained HTTP control
