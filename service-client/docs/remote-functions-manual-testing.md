# Manual Testing Guide for Remote Functions

This guide provides step-by-step instructions for manually testing the consultation remote functions.

## Architecture Overview

The remote functions use **direct PostgreSQL access** via drizzle-orm from the SvelteKit server. This means:

- No REST API calls to the Go backend (localhost:4001) for consultation data
- Database queries run server-side in SvelteKit
- Authentication uses `getRequestEvent()` to access `locals.user` from hooks.server.ts
- Network requests go to SvelteKit's internal remote function endpoints (`/_rf/...`)

## Prerequisites

1. **Start All Services**

   ```bash
   docker compose up
   ```

   - PostgreSQL must be accessible (the client connects directly)
   - Frontend runs on http://localhost:3000
   - Core service (localhost:4001) is still needed for authentication/login

2. **Login to Test Account**
   - Navigate to http://localhost:3000/login
   - Login with test credentials (or use magic link from core service logs)
   - Verify `access_token` cookie is set (check DevTools > Application > Cookies)

## Testing Checklist

### Subtask 2.7: Remote Functions Verification

Open browser DevTools (F12) and navigate to the **Network** tab. Keep it open during all tests to observe `/_rf/...` requests.

#### Test 1: getOrCreateConsultation()

**Browser Console:**

```javascript
// Import the remote function
const { getOrCreateConsultation } = await import("/src/lib/api/consultation.remote.ts");

// Call the function
const consultation = await getOrCreateConsultation();
console.log("Created consultation:", consultation);
```

**Expected Network Request:**

- Method: POST
- URL: `http://localhost:3000/_rf/getOrCreateConsultation`
- Content-Type: application/json
- Status: 200 OK

**Expected Response:**

```json
{
	"id": "uuid",
	"userId": "uuid",
	"status": "draft",
	"completionPercentage": 0,
	"createdAt": "2025-10-24T...",
	"updatedAt": "2025-10-24T..."
}
```

**Verification:**

- ✅ Response contains valid consultation object
- ✅ Status is "draft"
- ✅ Authentication handled server-side via `getRequestEvent()`
- ✅ No errors thrown

---

#### Test 2: getConsultation(id)

**Browser Console:**

```javascript
const { getConsultation } = await import("/src/lib/api/consultation.remote.ts");

// Use the ID from previous test
const consultationId = "YOUR_CONSULTATION_ID_HERE";
const consultation = await getConsultation(consultationId);
console.log("Retrieved consultation:", consultation);
```

**Expected Network Request:**

- Method: POST
- URL: `http://localhost:3000/_rf/getConsultation`
- Content-Type: application/json
- Status: 200 OK

**Verification:**

- ✅ Response matches consultation from Test 1
- ✅ Authentication handled server-side
- ✅ All fields properly parsed

---

#### Test 3: getDraft(id)

**Browser Console:**

```javascript
const { getDraft } = await import("/src/lib/api/consultation.remote.ts");

const consultationId = "YOUR_CONSULTATION_ID_HERE";
const draft = await getDraft(consultationId);
console.log("Retrieved draft:", draft);
```

**Expected Network Request:**

- Method: POST
- URL: `http://localhost:3000/_rf/getDraft`
- Content-Type: application/json
- Status: 200 OK

**Verification:**

- ✅ Returns null (no draft exists yet)
- ✅ Authentication handled server-side
- ✅ Null handled gracefully (not an error)

---

#### Test 4: autoSaveDraft()

**Browser Console:**

```javascript
const { autoSaveDraft } = await import("/src/lib/api/consultation.remote.ts");

const consultationId = "YOUR_CONSULTATION_ID_HERE";
const draftData = {
	contact_info: {
		business_name: "Test Corporation",
		email: "test@example.com",
	},
};

const savedDraft = await autoSaveDraft({
	consultationId,
	data: draftData,
});
console.log("Saved draft:", savedDraft);
```

**Expected Network Request:**

- Method: POST
- URL: `http://localhost:3000/_rf/autoSaveDraft`
- Content-Type: application/json
- Status: 200 OK

**Expected Result:**

- Command completes without error
- Draft is saved to database

**Verification:**

- ✅ Draft created successfully
- ✅ Authentication handled server-side
- ✅ Data properly saved

---

#### Test 5: getDraft() with existing draft

**Browser Console:**

```javascript
const { getDraft } = await import("/src/lib/api/consultation.remote.ts");

const consultationId = "YOUR_CONSULTATION_ID_HERE";
const draft = await getDraft(consultationId);
console.log("Retrieved draft:", draft);
```

**Expected Network Request:**

- Method: POST
- URL: `http://localhost:3000/_rf/getDraft`
- Content-Type: application/json
- Status: 200 OK

**Verification:**

- ✅ Returns draft object (not null)
- ✅ Contains data from Test 4
- ✅ Authentication handled server-side

---

#### Test 6: completeConsultation()

**Browser Console:**

```javascript
const { completeConsultation } = await import("/src/lib/api/consultation.remote.ts");

const consultationId = "YOUR_CONSULTATION_ID_HERE";
await completeConsultation({ consultationId });
// Note: This redirects to /consultation/success on completion
```

**Expected Network Request:**

- Method: POST
- URL: `http://localhost:3000/_rf/completeConsultation`
- Content-Type: application/json
- Status: 200 OK (then redirects)

**Expected Behavior:**

- Consultation status updated to "completed" in database
- Version snapshot created in `consultation_versions` table
- Any existing draft deleted
- Browser redirects to `/consultation/success`

**Verification:**

- ✅ Status changed to "completed" in database
- ✅ Completion percentage is 100
- ✅ completedAt timestamp set
- ✅ Version snapshot created
- ✅ **THIS IS THE CRITICAL BUG FIX** - completion logic executes

---

#### Test 7: getUserConsultations()

**Browser Console:**

```javascript
const { getUserConsultations } = await import("/src/lib/api/consultation.remote.ts");

const consultations = await getUserConsultations();
console.log("User consultations:", consultations);
```

**Expected Network Request:**

- Method: POST
- URL: `http://localhost:3000/_rf/getUserConsultations`
- Content-Type: application/json
- Status: 200 OK

**Expected Response:**

```json
[
	{
		"id": "uuid",
		"userId": "uuid",
		"status": "completed",
		"completionPercentage": 100,
		"createdAt": "2025-10-24T...",
		"updatedAt": "2025-10-24T...",
		"completedAt": "2025-10-24T..."
	}
]
```

**Verification:**

- ✅ Returns array of consultations
- ✅ Ordered by updatedAt descending
- ✅ Authentication handled server-side

---

### Subtask 2.8: Error Response Verification

#### Test 8: Unauthorized (No Session)

**Browser Console:**

```javascript
// Open an incognito window (no session) and try:
const { getConsultation } = await import("/src/lib/api/consultation.remote.ts");

try {
	await getConsultation("123e4567-e89b-12d3-a456-426614174000");
} catch (error) {
	console.log("Auth Error handled:", error.message);
}
```

**Expected:**

- ❌ Request fails (redirect to login or error)
- ✅ Error thrown with message
- ✅ Error indicates authentication required (from `getUserId()` throwing)

**Note:** Authentication is handled server-side via `getRequestEvent().locals.user`

---

#### Test 9: Not Found (Invalid ID)

**Browser Console:**

```javascript
const { getConsultation } = await import("/src/lib/api/consultation.remote.ts");

try {
	await getConsultation("00000000-0000-0000-0000-000000000000");
} catch (error) {
	console.log("Not Found Error handled:", error.message);
}
```

**Expected:**

- ❌ Request fails
- ✅ Error thrown with message: "Consultation not found"
- ✅ Error properly propagated to caller

---

#### Test 10: Validation Error (Invalid UUID)

**Browser Console:**

```javascript
const { getConsultation } = await import("/src/lib/api/consultation.remote.ts");

try {
	await getConsultation("not-a-valid-uuid");
} catch (error) {
	console.log("Validation Error handled:", error.message);
}
```

**Expected:**

- ❌ Valibot validation fails before database query
- ✅ Error thrown with validation message
- ✅ No database query executed (pre-validation)

---

#### Test 11: Database Error (Simulated)

This test requires stopping PostgreSQL or simulating a database error.

**Expected:**

- ❌ Request fails with database error
- ✅ Error thrown with message
- ✅ Error properly propagated to caller

---

## Database Verification

After completing all tests, verify in the database:

```sql
-- Check consultation status
SELECT id, status, completion_percentage, completed_at, created_at
FROM consultations
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 5;

-- Check draft (note: draft is deleted on completion)
SELECT id, consultation_id, contact_info, updated_at
FROM consultation_drafts
WHERE consultation_id = 'YOUR_CONSULTATION_ID';

-- Check version snapshot
SELECT id, consultation_id, version_number, status, change_summary
FROM consultation_versions
WHERE consultation_id = 'YOUR_CONSULTATION_ID';
```

**Expected:**

- ✅ Consultation exists with status "completed"
- ✅ completed_at timestamp is set
- ✅ Version snapshot exists with status "completed"
- ✅ Draft deleted after completion (no results)

---

## Success Criteria

All tests should pass with:

- ✅ All remote functions execute server-side via `/_rf/...` endpoints
- ✅ Authentication handled via `getRequestEvent().locals.user`
- ✅ All inputs validated with Valibot schemas
- ✅ All error responses properly handled
- ✅ Critical bug fix verified: completeConsultation() executes completion logic
- ✅ Database reflects expected state changes

## Important Implementation Notes

### Correct Import Path

Remote functions must be imported from `$app/server`, NOT `@sveltejs/kit`:

```ts
// ✅ CORRECT
import { query, command, form } from "$app/server";

// ❌ WRONG - will cause "does not provide an export" error
import { query, form } from "@sveltejs/kit";
```

### Choosing Between `query()`, `command()`, and `form()`

| Function    | Use Case                                         | How to Call                          |
| ----------- | ------------------------------------------------ | ------------------------------------ |
| `query()`   | Read operations (fetching data)                  | `await getConsultation(id)`          |
| `command()` | Programmatic mutations (button clicks, JS calls) | `await saveContactInfo({...data})`   |
| `form()`    | HTML form submissions                            | `<form {...formFunction.enhance()}>` |

**Key Distinction:**

- Use `command()` when calling mutations from JavaScript (e.g., button `onclick` handlers)
- Use `form()` only when the mutation is triggered by an actual HTML `<form>` submission
- `form()` returns an object with `.enhance()`, `.fields`, `.pending` - NOT a callable function!
- `command()` returns a callable async function

### Example Patterns

**Command (programmatic call):**

```ts
// In .remote.ts
export const saveContactInfo = command(ContactInfoSchema, async (data) => {
	// ... mutation logic
	getConsultation(data.consultationId).refresh(); // Refresh related query
});

// In component
await saveContactInfo({ consultationId, ...formData });
```

**Form (HTML form submission):**

```ts
// In .remote.ts
export const createPost = form(CreatePostSchema, async (data) => {
  // ... mutation logic
});

// In component
<form {...createPost.enhance()}>
  <input {...createPost.fields.title.as('text')} />
  <button type="submit">Create</button>
</form>
```

### Refreshing Queries After Mutations

Inside a `command()` or `form()`, you can refresh queries to update cached data:

```ts
export const likePost = command(z.number(), async (id) => {
	await db
		.update(posts)
		.set({ likes: sql`likes + 1` })
		.where(eq(posts.id, id));
	getPostLikes(id).refresh(); // ← Refresh the query
});
```

---

## Troubleshooting

### Authentication Failure

**Symptom:** Error thrown about missing user/authentication
**Solution:**

- Verify you're logged in (check for session in DevTools > Application > Cookies)
- Check `hooks.server.ts` is properly populating `locals.user`
- Verify `getUserId()` in `$lib/server/auth` is correctly reading from `getRequestEvent()`

### Database Connection Error

**Symptom:** Error about database connection or query failure
**Solution:**

- Verify PostgreSQL is running: `docker compose ps`
- Check database credentials in environment variables
- Ensure `$lib/server/db` is properly configured with drizzle-orm

### Import Error

**Symptom:** "does not provide an export named 'form'" or similar
**Solution:**

- Ensure importing from `$app/server`, NOT `@sveltejs/kit`
- Check if using correct function: `command()` for programmatic calls, `form()` for HTML forms
- Verify the `.remote.ts` file is in correct location

### TypeError: X is not a function

**Symptom:** Calling a remote function throws "is not a function"
**Solution:**

- If using HTML forms, use `form()` which returns an object with `.enhance()`
- If calling programmatically (e.g., button onclick), use `command()` which returns a callable function
- See the "Choosing Between query(), command(), and form()" section above

---

## Next Steps

After all manual tests pass:

- ✅ Mark subtasks 2.7 and 2.8 complete in tasks.md
- ➡️ Proceed to Task 3: Implement form step remote functions
- 📝 Document any issues or edge cases discovered during testing
