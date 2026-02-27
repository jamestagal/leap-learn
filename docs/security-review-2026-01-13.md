# Webkit Security Review Report

**Date:** January 13, 2026
**Scope:** Full codebase review
**Reviewer:** Automated Security Analysis

---

## Executive Summary

The Webkit codebase demonstrates **strong security fundamentals** with proper multi-tenant isolation patterns (`withAgencyScope()`), role-based access control (`requirePermission()`), and input validation (Valibot schemas). However, **3 HIGH-severity IDOR vulnerabilities** were identified in PDF generation endpoints that bypass all authentication and tenant isolation.

---

## HIGH-SEVERITY FINDINGS

### Vuln 1: IDOR - Unauthenticated Invoice PDF Access

**File:** `service-client/src/routes/api/invoices/[invoiceId]/pdf/+server.ts`
**Lines:** 20-31

| Attribute | Value |
|-----------|-------|
| Severity | HIGH |
| Confidence | 10/10 |

**Description:** The invoice PDF endpoint accepts an `invoiceId` from URL parameters and queries the database without authentication or agency scope validation. Any user (authenticated or not) can download any invoice PDF by knowing or guessing the invoice UUID.

**Vulnerable Code:**
```typescript
export const GET: RequestHandler = async ({ params }) => {
  const { invoiceId } = params;
  const invoice = await db.query.invoices.findFirst({
    where: eq(invoices.id, invoiceId)  // No auth check, no agencyId filter
  });
```

**Exploit Scenario:** An attacker enumerates or guesses invoice UUIDs and downloads invoices belonging to any agency. Invoices contain sensitive business data: client names, addresses, amounts, line items.

**Recommendation:** Add authentication and agency scope verification:
```typescript
import { getAgencyContext } from '$lib/server/agency';

export const GET: RequestHandler = async ({ params }) => {
  const context = await getAgencyContext();
  const invoice = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, invoiceId), eq(invoices.agencyId, context.agencyId))
  });
```

---

### Vuln 2: IDOR - Unauthenticated Contract PDF Access

**File:** `service-client/src/routes/api/contracts/[contractId]/pdf/+server.ts`
**Lines:** 19-34

| Attribute | Value |
|-----------|-------|
| Severity | HIGH |
| Confidence | 10/10 |

**Description:** The contract PDF endpoint fetches contracts by ID without authentication or tenant isolation. Any user can download any contract PDF.

**Vulnerable Code:**
```typescript
export const GET: RequestHandler = async ({ params }) => {
  const { contractId } = params;
  const contract = await db.query.contracts.findFirst({
    where: eq(contracts.id, contractId)  // No auth check, no agencyId filter
  });
```

**Exploit Scenario:** Attacker downloads contracts containing business terms, pricing, client signatures, and confidential agreement details from any agency.

**Recommendation:** Same pattern as Vuln 1 - add `getAgencyContext()` and filter by `context.agencyId`.

---

### Vuln 3: IDOR - Unauthenticated Questionnaire PDF Access

**File:** `service-client/src/routes/api/questionnaires/[questionnaireId]/pdf/+server.ts`
**Lines:** 20-31

| Attribute | Value |
|-----------|-------|
| Severity | HIGH |
| Confidence | 10/10 |

**Description:** The questionnaire PDF endpoint fetches questionnaire responses without authentication or tenant isolation.

**Vulnerable Code:**
```typescript
export const GET: RequestHandler = async ({ params }) => {
  const { questionnaireId } = params;
  const questionnaire = await db.query.questionnaireResponses.findFirst({
    where: eq(questionnaireResponses.id, questionnaireId)  // No auth, no scope
  });
```

**Exploit Scenario:** Attacker downloads questionnaire responses containing client business names, contact info, budgets, challenges, and other sensitive consultation data.

**Recommendation:** Same pattern - add authentication and agency scope verification.

---

## MEDIUM-SEVERITY FINDINGS

### Vuln 4: Cookie Secure Flag Inconsistency

**File:** `service-client/src/lib/server/agency.ts`
**Lines:** 145, 198

| Attribute | Value |
|-----------|-------|
| Severity | MEDIUM |
| Confidence | 8/10 |

**Description:** Three locations use `process.env['NODE_ENV'] === 'production'` for the cookie `secure` flag, while the documented pattern (and `refresh.ts`) uses `env.DOMAIN !== 'localhost'`. This inconsistency could cause authentication issues in staging environments.

**Affected Locations:**
- `service-client/src/lib/server/agency.ts:145` - `setAgencyCookie()`
- `service-client/src/lib/server/agency.ts:198` - `switchAgency()`
- `service-client/src/lib/server/super-admin.ts:55` - `setImpersonatedAgencyId()`

**Exploit Scenario:** In a staging environment with `NODE_ENV=production` but HTTP (not HTTPS), cookies with `secure: true` won't be sent. This creates inconsistent auth state between session tokens (working) and agency cookies (failing).

**Recommendation:** Standardize all cookie security flags to use the pattern from `refresh.ts`:
```typescript
import { env } from '$env/dynamic/private';
const isProduction = env.DOMAIN !== 'localhost';
secure: isProduction
```

---

## POSITIVE FINDINGS (No Issues)

The following security controls are **correctly implemented**:

| Category | Status | Notes |
|----------|--------|-------|
| Multi-Tenant Isolation | SECURE | `withAgencyScope()` properly enforced in all remote functions |
| Permission System | SECURE | `requirePermission()` correctly guards sensitive operations |
| JWT Authentication | SECURE | EdDSA algorithm, proper verification with jose library |
| Input Validation | SECURE | All remote functions use Valibot schemas |
| SQL Injection | SECURE | Drizzle ORM parameterizes all queries |
| XSS Protection | SECURE | `parseMarkdown()` escapes HTML before processing |
| Stripe Webhook | SECURE | Signature validation implemented correctly |
| Payment Authorization | SECURE | Proper permission checks on all payment operations |
| Session Management | SECURE | HTTP-only, SameSite cookies |

---

## Summary

| Finding | Severity | Confidence | Status |
|---------|----------|------------|--------|
| Invoice PDF IDOR | HIGH | 10/10 | **FIX REQUIRED** |
| Contract PDF IDOR | HIGH | 10/10 | **FIX REQUIRED** |
| Questionnaire PDF IDOR | HIGH | 10/10 | **FIX REQUIRED** |
| Cookie Secure Flag | MEDIUM | 8/10 | **FIX RECOMMENDED** |

**Total: 3 HIGH, 1 MEDIUM vulnerabilities requiring remediation.**

---

## Remediation Priority

### Immediate (P0)
1. Add authentication and agency scope to all three PDF endpoints
2. Deploy fix before any public announcement of the platform

### Short-term (P1)
3. Standardize cookie secure flag pattern across codebase
4. Add integration tests for tenant isolation on all API endpoints

---

## Notes

The PDF endpoint vulnerabilities are critical because they completely bypass the otherwise well-implemented tenant isolation. An attacker with knowledge of any UUID can access cross-tenant data without authentication.

The rest of the codebase demonstrates mature security practices with consistent use of:
- `withAgencyScope()` for database queries
- `requirePermission()` for authorization
- Valibot schemas for input validation
- Drizzle ORM for SQL safety
