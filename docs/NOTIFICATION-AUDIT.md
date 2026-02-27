# Email Notification Audit

> Last updated: 2026-01-17

This document tracks the current state of email notifications in the Webkit platform and identifies missing features.

---

## Legend

| Status | Meaning |
|--------|---------|
| ✅ | Implemented and working |
| 🔲 | Not implemented (TODO) |
| ⚠️ | Partially implemented |

---

## 1. Proposals

### Outbound (Agency → Client)

| Notification | Status | Trigger | Template | Notes |
|--------------|--------|---------|----------|-------|
| Proposal sent | ✅ | Agency clicks "Send" | `generateProposalEmail` | Includes PDF attachment |
| Proposal reminder | 🔲 | Manual or scheduled | - | Remind client to review |

### Inbound (Client Action → Agency)

| Notification | Status | Trigger | Template | Notes |
|--------------|--------|---------|----------|-------|
| Proposal accepted | 🔲 | Client accepts | - | Notify agency, include comments |
| Proposal declined | 🔲 | Client declines | - | Notify agency, include reason |
| Revision requested | 🔲 | Client requests changes | - | Notify agency, include notes |

### Confirmation (System → Client)

| Notification | Status | Trigger | Template | Notes |
|--------------|--------|---------|----------|-------|
| Accept confirmation | 🔲 | Client accepts | - | Confirm acceptance to client |
| Decline confirmation | 🔲 | Client declines | - | Confirm decline to client |
| Revision confirmation | 🔲 | Client requests changes | - | Confirm request received |

---

## 2. Contracts

### Outbound (Agency → Client)

| Notification | Status | Trigger | Template | Notes |
|--------------|--------|---------|----------|-------|
| Contract sent | 🔲 | Agency clicks "Send" | `generateContractEmail` (template exists) | TODO marker in code |
| Contract reminder | 🔲 | Manual or scheduled | - | Remind client to sign |

### Inbound (Client Action → Agency)

| Notification | Status | Trigger | Template | Notes |
|--------------|--------|---------|----------|-------|
| Contract signed | 🔲 | Client signs | - | Notify agency |

### Confirmation (System → Client)

| Notification | Status | Trigger | Template | Notes |
|--------------|--------|---------|----------|-------|
| Signature confirmation | 🔲 | Client signs | - | Confirm signature, include PDF |

---

## 3. Invoices

### Outbound (Agency → Client)

| Notification | Status | Trigger | Template | Notes |
|--------------|--------|---------|----------|-------|
| Invoice sent | ✅ | Agency clicks "Send" | `generateInvoiceEmail` | Includes PDF + Stripe link |
| Payment reminder | ✅ | Manual send | `generateInvoiceReminderEmail` | Friendly or overdue versions |

### Inbound (Payment → Agency)

| Notification | Status | Trigger | Template | Notes |
|--------------|--------|---------|----------|-------|
| Payment received | 🔲 | Stripe webhook | - | Notify agency of payment |

### Confirmation (System → Client)

| Notification | Status | Trigger | Template | Notes |
|--------------|--------|---------|----------|-------|
| Payment confirmation | 🔲 | Stripe webhook | - | Receipt/confirmation to client |

---

## 4. Questionnaires

### Outbound (Agency → Client)

| Notification | Status | Trigger | Template | Notes |
|--------------|--------|---------|----------|-------|
| Questionnaire link | ⚠️ | Contract signed (auto) | - | Link in contract signing flow |

### Inbound (Client Action → Agency)

| Notification | Status | Trigger | Template | Notes |
|--------------|--------|---------|----------|-------|
| Questionnaire completed | ✅ | Client submits | `generateQuestionnaireCompletedEmail` | Notifies agency |

---

## 5. Team/Agency

| Notification | Status | Trigger | Template | Notes |
|--------------|--------|---------|----------|-------|
| Team invitation (new user) | ✅ | Admin invites | `generateTeamInvitationEmail` | New user signup flow |
| Team added (existing user) | ✅ | Admin adds | `generateTeamAddedEmail` | Existing user notification |

---

## Implementation Priority

### Phase 1: Critical (Client Actions)

These are the most important - agency needs to know when clients take action.

1. **Proposal accepted** → Agency notification
2. **Proposal declined** → Agency notification
3. **Proposal revision requested** → Agency notification
4. **Contract signed** → Agency notification

### Phase 2: Confirmations (Client UX)

Good UX to confirm actions to clients.

5. **Proposal accept confirmation** → Client
6. **Proposal decline confirmation** → Client
7. **Proposal revision confirmation** → Client
8. **Contract signature confirmation** → Client (with PDF)

### Phase 3: Contract Emails

Complete the contract email flow.

9. **Contract sent** → Client (wiring exists, needs implementation)
10. **Contract reminder** → Client

### Phase 4: Payment Flow

Requires Stripe webhook integration.

11. **Payment received** → Agency notification
12. **Payment confirmation** → Client receipt

---

## Email Types for `email_logs` Table

Current types in schema:
- `proposal_sent`
- `invoice_sent`
- `contract_sent`
- `payment_reminder`
- `custom`

**Proposed additions:**
- `proposal_accepted_notification`
- `proposal_declined_notification`
- `proposal_revision_notification`
- `proposal_accept_confirmation`
- `proposal_decline_confirmation`
- `proposal_revision_confirmation`
- `contract_signed_notification`
- `contract_signature_confirmation`
- `contract_reminder`
- `payment_received_notification`
- `payment_confirmation`
- `questionnaire_completed`
- `team_invitation`
- `team_added`

---

## Code Locations

### Email Infrastructure
- `service-client/src/lib/server/services/email.service.ts` - Email sending service
- `service-client/src/lib/templates/email-templates.ts` - HTML templates
- `service-client/src/lib/api/email.remote.ts` - Remote functions

### TODO Markers (search for these)
```bash
grep -r "TODO.*email" service-client/src/
```

Key files with TODOs:
- `src/routes/c/[slug]/+page.server.ts:162-163` - Contract signing confirmations
- `src/lib/api/contracts.remote.ts:788,826,839,865,910,952-953` - Contract email flow
- `src/lib/api/proposals.remote.ts` - May need additions for client response notifications

---

## Template Requirements

### Agency Notifications (Client Action → Agency)

Should include:
- Client name and business
- Document reference number
- Action taken (accepted/declined/signed/etc)
- Any comments/reason provided
- Link to view document in agency dashboard
- Timestamp

### Client Confirmations (System → Client)

Should include:
- Agency branding (logo, colors)
- Confirmation of action taken
- Document reference number
- Next steps (if applicable)
- Link to view document
- PDF attachment (for contracts)

---

## Notes

1. **Email logging**: All emails should be logged to `email_logs` table for audit trail
2. **Agency branding**: All emails use agency's logo/colors via `getEffectiveBranding()`
3. **PDF attachments**: Proposals, invoices, contracts include PDF when sent
4. **Reply-to**: Set to agency email so replies go to them
5. **Resend integration**: Using Resend API for email delivery
