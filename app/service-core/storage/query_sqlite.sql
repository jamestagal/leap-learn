-- name: SelectToken :one
select * from tokens where id = ?1;

-- name: InsertToken :one
insert into tokens (id, expires, target, callback) values (?1, ?2, ?3, ?4) returning *;

-- name: UpdateToken :exec
update tokens set expires = ?1 where id = ?2 returning *;

-- name: DeleteTokens :exec
delete from tokens where expires < current_timestamp;

-- name: SelectUsers :many
select * from users;

-- name: SelectUser :one
select * from users where id = ?1;

-- name: SelectUserByCustomerID :one
select * from users where customer_id = ?1;

-- name: SelectUserByEmailAndSub :one
select * from users where email = ?1 and sub = ?2;

-- name: SelectUserByEmail :one
select * from users where email = ?1;

-- name: UpdateUserSub :exec
update users set sub = ?2 where id = ?1;

-- name: AcceptPendingMemberships :exec
update organisation_memberships set accepted_at = current_timestamp, updated_at = current_timestamp where user_id = ?1 and accepted_at is null;

-- name: InsertUser :one
insert into users (id, email, access, sub, avatar, api_key) values (?1, ?2, ?3, ?4, ?5, ?6) returning *;

-- name: UpdateUserPhone :exec
update users set phone = ?2 where id = ?1;

-- name: UpdateUserActivity :exec
update users set updated = current_timestamp where id = ?1;

-- name: UpdateUserCustomerID :exec
update users set customer_id = ?1 where id = ?2;

-- name: UpdateUserSubscription :exec
update users set access = ?1, subscription_id = ?2, subscription_end = ?3 where customer_id = ?4;

-- name: UpdateUserAccess :one
update users set access = ?1 where id = ?2 returning *;

-- name: UpdateUser :one
update users set
    email = ?1,
    phone = ?2,
    access = ?3,
    avatar = ?4,
    subscription_id = ?5,
    subscription_end = ?6,
    api_key = ?7,
    updated = current_timestamp
where id = ?8 returning *;

-- name: SelectFiles :many
select * from files where user_id = ?1;

-- name: SelectFile :one
select * from files where id = ?1;

-- name: InsertFile :one
insert into files (id, user_id, file_key, file_name, file_size, content_type) values (?1, ?2, ?3, ?4, ?5, ?6) returning *;

-- name: DeleteFile :exec
delete from files where id = ?1;

-- name: SelectEmails :many
select * from emails where user_id = ?1;

-- name: InsertEmail :one
insert into emails (id, user_id, email_to, email_from, email_subject, email_body) values (?1, ?2, ?3, ?4, ?5, ?6) returning *;

-- name: SelectEmailAttachments :many
select * from email_attachments where email_id = ?1;

-- name: InsertEmailAttachment :one
insert into email_attachments (id, email_id, file_name, content_type) values (?1, ?2, ?3, ?4) returning *;

-- name: CountNotes :one
select count(*) from notes where user_id = ?1;

-- name: SelectNotes :many
select * from notes where user_id = ?1 order by created desc limit ?2 offset ?3;

-- name: SelectNote :one
select * from notes where id = ?1;

-- name: InsertNote :one
insert into notes (id, user_id, title, category, content) values (?1, ?2, ?3, ?4, ?5) returning *;

-- name: UpdateNote :one
update notes set title = ?1, category = ?2, content = ?3 where id = ?4 returning *;

-- name: DeleteNote :exec
delete from notes where id = ?1;

-- Consultation queries (New Schema - SQLite version)

-- Basic CRUD operations for consultations

-- name: CreateConsultation :one
INSERT INTO consultations (
    id, user_id, contact_info, business_context, pain_points, goals_objectives, status, completion_percentage
) VALUES (
    ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
) RETURNING *;

-- name: GetConsultation :one
SELECT * FROM consultations WHERE id = ?1;

-- name: GetConsultationByUser :one
SELECT * FROM consultations WHERE id = ?1 AND user_id = ?2;

-- name: UpdateConsultation :one
UPDATE consultations SET
    contact_info = ?2,
    business_context = ?3,
    pain_points = ?4,
    goals_objectives = ?5,
    status = ?6,
    completion_percentage = ?7,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?1
RETURNING *;

-- name: UpdateConsultationStatus :one
UPDATE consultations SET
    status = ?2,
    completed_at = CASE WHEN ?2 = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?1
RETURNING *;

-- name: DeleteConsultation :exec
DELETE FROM consultations WHERE id = ?1;

-- Consultation listing and filtering

-- name: ListConsultationsByUser :many
SELECT * FROM consultations
WHERE user_id = ?1
ORDER BY created_at DESC
LIMIT ?2 OFFSET ?3;

-- name: CountConsultationsByUser :one
SELECT COUNT(*) FROM consultations WHERE user_id = ?1;

-- name: ListConsultationsByStatus :many
SELECT * FROM consultations
WHERE user_id = ?1 AND status = ?2
ORDER BY created_at DESC
LIMIT ?3 OFFSET ?4;

-- name: CountConsultationsByStatus :one
SELECT COUNT(*) FROM consultations WHERE user_id = ?1 AND status = ?2;

-- name: ListConsultationsByDateRange :many
SELECT * FROM consultations
WHERE user_id = ?1
AND created_at BETWEEN ?2 AND ?3
ORDER BY created_at DESC
LIMIT ?4 OFFSET ?5;

-- name: ListConsultationsByCompletion :many
SELECT * FROM consultations
WHERE user_id = ?1
AND completion_percentage BETWEEN ?2 AND ?3
ORDER BY completion_percentage DESC, created_at DESC
LIMIT ?4 OFFSET ?5;

-- JSON field queries for advanced filtering (SQLite uses JSON functions)

-- name: GetConsultationsByBusinessName :many
SELECT * FROM consultations
WHERE user_id = ?1
AND json_extract(contact_info, '$.business_name') LIKE ?2
ORDER BY created_at DESC
LIMIT ?3 OFFSET ?4;

-- name: GetConsultationsByIndustry :many
SELECT * FROM consultations
WHERE user_id = ?1
AND json_extract(business_context, '$.industry') = ?2
ORDER BY created_at DESC
LIMIT ?3 OFFSET ?4;

-- name: GetConsultationsByUrgency :many
SELECT * FROM consultations
WHERE user_id = ?1
AND json_extract(pain_points, '$.urgency_level') = ?2
ORDER BY created_at DESC
LIMIT ?3 OFFSET ?4;

-- name: SearchConsultations :many
SELECT * FROM consultations
WHERE user_id = ?1
AND (
    json_extract(contact_info, '$.business_name') LIKE ?2 OR
    json_extract(contact_info, '$.contact_person') LIKE ?2 OR
    json_extract(business_context, '$.industry') LIKE ?2
)
ORDER BY created_at DESC
LIMIT ?3 OFFSET ?4;

-- Draft management queries

-- name: CreateConsultationDraft :one
INSERT INTO consultation_drafts (
    id, consultation_id, user_id, contact_info, business_context, pain_points, goals_objectives, auto_saved, draft_notes
) VALUES (
    ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9
) RETURNING *;

-- name: GetConsultationDraft :one
SELECT * FROM consultation_drafts WHERE consultation_id = ?1;

-- name: GetConsultationDraftByUser :one
SELECT * FROM consultation_drafts WHERE consultation_id = ?1 AND user_id = ?2;

-- name: UpdateConsultationDraft :one
UPDATE consultation_drafts SET
    contact_info = ?2,
    business_context = ?3,
    pain_points = ?4,
    goals_objectives = ?5,
    auto_saved = ?6,
    draft_notes = ?7,
    updated_at = CURRENT_TIMESTAMP
WHERE consultation_id = ?1
RETURNING *;

-- name: UpsertConsultationDraft :one
INSERT INTO consultation_drafts (
    id, consultation_id, user_id, contact_info, business_context, pain_points, goals_objectives, auto_saved, draft_notes
) VALUES (
    ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9
)
ON CONFLICT (consultation_id)
DO UPDATE SET
    contact_info = excluded.contact_info,
    business_context = excluded.business_context,
    pain_points = excluded.pain_points,
    goals_objectives = excluded.goals_objectives,
    auto_saved = excluded.auto_saved,
    draft_notes = excluded.draft_notes,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;

-- name: DeleteConsultationDraft :exec
DELETE FROM consultation_drafts WHERE consultation_id = ?1;

-- name: DeleteConsultationDraftByUser :exec
DELETE FROM consultation_drafts WHERE consultation_id = ?1 AND user_id = ?2;

-- name: CleanupOldDrafts :exec
DELETE FROM consultation_drafts
WHERE auto_saved = 1
AND updated_at < ?1;

-- Version tracking queries

-- name: CreateConsultationVersion :one
INSERT INTO consultation_versions (
    id, consultation_id, user_id, version_number, contact_info, business_context, pain_points, goals_objectives,
    status, completion_percentage, change_summary, changed_fields
) VALUES (
    ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12
) RETURNING *;

-- name: GetConsultationVersion :one
SELECT * FROM consultation_versions
WHERE consultation_id = ?1 AND version_number = ?2;

-- name: GetLatestConsultationVersion :one
SELECT * FROM consultation_versions
WHERE consultation_id = ?1
ORDER BY version_number DESC
LIMIT 1;

-- name: ListConsultationVersions :many
SELECT * FROM consultation_versions
WHERE consultation_id = ?1
ORDER BY version_number DESC
LIMIT ?2 OFFSET ?3;

-- name: CountConsultationVersions :one
SELECT COUNT(*) FROM consultation_versions WHERE consultation_id = ?1;

-- name: GetNextVersionNumber :one
SELECT COALESCE(MAX(version_number), 0) + 1
FROM consultation_versions
WHERE consultation_id = ?1;

-- name: DeleteConsultationVersions :exec
DELETE FROM consultation_versions WHERE consultation_id = ?1;

-- =============================================================================
-- Organisation Billing Queries (Platform Subscriptions)
-- =============================================================================

-- name: GetOrganisationBillingInfo :one
SELECT
    id,
    name,
    slug,
    subscription_tier,
    subscription_id,
    subscription_end,
    stripe_customer_id,
    ai_generations_this_month,
    ai_generations_reset_at,
    is_freemium,
    freemium_expires_at
FROM organisations
WHERE id = ?1;

-- name: UpdateOrganisationStripeCustomer :exec
UPDATE organisations
SET stripe_customer_id = ?2, updated_at = CURRENT_TIMESTAMP
WHERE id = ?1;

-- name: UpdateOrganisationSubscription :exec
UPDATE organisations
SET
    subscription_tier = ?2,
    subscription_id = ?3,
    subscription_end = ?4,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?1;

-- name: GetOrganisationByStripeCustomer :one
SELECT * FROM organisations
WHERE stripe_customer_id = ?1;

-- name: DowngradeOrganisationToFree :exec
UPDATE organisations
SET
    subscription_tier = 'free',
    subscription_id = '',
    subscription_end = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?1;