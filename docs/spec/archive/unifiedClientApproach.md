## Current Client Data Architecture

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT DATA FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐                                                            │
│  │   clients   │ ◄──── Only formSubmissions links here                      │
│  │   (table)   │       via clientId FK                                      │
│  └──────┬──────┘                                                            │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────┐                                                        │
│  │ formSubmissions │ (has clientId FK + denormalized fields)                │
│  └─────────────────┘                                                        │
│                                                                             │
│  ════════════════════════════════════════════════════════════               │
│  SEPARATE FLOW (No clientId - all denormalized inline):                     │
│  ════════════════════════════════════════════════════════════               │
│                                                                             │
│  ┌──────────────┐      ┌───────────┐      ┌───────────┐                    │
│  │ consultation │ ───► │  proposal │ ───► │ contract  │                    │
│  │  (inline)    │ copy │  (inline) │ copy │  (inline) │                    │
│  └──────────────┘      └─────┬─────┘      └─────┬─────┘                    │
│                              │                  │                           │
│                              ▼                  ▼                           │
│                        ┌───────────┐    ┌──────────────────┐               │
│                        │  invoice  │    │ questionnaire    │               │
│                        │  (inline) │    │ Responses(inline)│               │
│                        └───────────┘    └──────────────────┘               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Storage by Entity

|Entity|Has `clientId` FK?|How Client Data is Stored|Duplicate Prevention|
|---|---|---|---|
|**clients**|N/A (IS the table)|Direct columns|✅ `UNIQUE(agencyId, email)`|
|**formSubmissions**|✅ YES (nullable)|Denormalized + FK|Uses `getOrCreateClient()`|
|**consultations**|❌ NO|Flat inline columns|❌ None|
|**proposals**|❌ NO|Copied from consultation|❌ None|
|**contracts**|❌ NO|Copied from proposal|❌ None|
|**invoices**|❌ NO|Copied from contract|❌ None|
|**questionnaireResponses**|❌ NO|Inline columns|❌ None|

### The Problem

**Two separate systems exist:**

1. **New Forms System** - Uses `clients` table properly with `getOrCreateClient()` pattern
2. **Original Consultation Flow** - Completely bypasses `clients` table, stores everything inline

This means:

- A client can be entered multiple times through different consultations
- No unified client list across Consultation → Proposal → Contract flow
- Can't easily see "all forms/proposals/contracts for client X"

### Current Linkages

```typescript
// Proposal links to Consultation
proposals.consultationId → consultations.id

// Contract REQUIRES Proposal
contracts.proposalId → proposals.id (required)

// Invoice optionally links
invoices.proposalId → proposals.id
invoices.contractId → contracts.id

// Questionnaire optionally links
questionnaireResponses.proposalId → proposals.id
questionnaireResponses.contractId → contracts.id

// FormSubmissions optionally links
formSubmissions.clientId → clients.id
formSubmissions.proposalId → proposals.id
formSubmissions.contractId → contracts.id
```

### Duplicate Prevention (Current State)

**Only in `clients` table:**

```typescript
// clients.remote.ts - createClient
const [existing] = await db.select().from(clients)
  .where(and(
    eq(clients.agencyId, context.agencyId),
    eq(clients.email, data.email.toLowerCase())
  ));
if (existing) throw error(400, "A client with this email already exists");

// clients.remote.ts - getOrCreateClient (idempotent)
if (existing) return { client: existing, created: false };
```

**NOT in consultation/proposal/contract flow** - same email can exist multiple times across consultations.

---

## Recommendation: Unified Client Approach

To fix this inconsistency, you'd need to:

### Option A: Add clientId to All Entities (Backward Compatible)

```sql
-- Add clientId FK to existing tables
ALTER TABLE consultations ADD COLUMN client_id UUID REFERENCES clients(id);
ALTER TABLE proposals ADD COLUMN client_id UUID REFERENCES clients(id);
ALTER TABLE contracts ADD COLUMN client_id UUID REFERENCES clients(id);
```

Then modify each creation flow:

1. Before creating consultation/proposal, call `getOrCreateClient()`
2. Store `clientId` FK + keep denormalized fields (for historical snapshots)
3. Add client search/selection UI to each creation form

### Option B: Create Clients from Existing Data (Migration)

```typescript
// For each consultation without clientId:
const existing = await getClientByEmail(consultation.email);
if (!existing) {
  const client = await createClient({
    businessName: consultation.businessName,
    email: consultation.email,
    contactName: consultation.contactPerson,
    phone: consultation.phone
  });
}
// Link consultation to client
await db.update(consultations).set({ clientId: client.id });
```

### Ideal Flow After Fix

```
User enters client info
       ↓
┌──────────────────┐
│ getOrCreateClient│ ←── Always go through this
└────────┬─────────┘
         ↓
    ┌─────────┐
    │ clients │ (single source of truth)
    └────┬────┘
         │
    ╔════╧════════════════════════════════════════════╗
    ║ All entities link via clientId:                 ║
    ║ consultation.clientId → clients.id              ║
    ║ proposal.clientId → clients.id                  ║
    ║ contract.clientId → clients.id                  ║
    ║ formSubmission.clientId → clients.id            ║
    ║ invoice.clientId → clients.id                   ║
    ╚═════════════════════════════════════════════════╝
         │
    (Keep denormalized fields for historical snapshots)
