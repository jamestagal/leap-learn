-- name: SelectToken :one
select * from tokens where id = $1;

-- name: InsertToken :one
insert into tokens (id, expires, target, callback) values ($1, $2, $3, $4) returning *;

-- name: UpdateToken :exec
update tokens set expires = $1 where id = $2 returning *;

-- name: DeleteTokens :exec
delete from tokens where expires < current_timestamp;

-- name: SelectUsers :many
select * from users;

-- name: SelectUser :one
select * from users where id = $1;

-- name: SelectUserByCustomerID :one
select * from users where customer_id = $1;

-- name: SelectUserByEmailAndSub :one
select * from users where email = $1 and sub = $2;

-- name: SelectUserByEmail :one
select * from users where email = $1;

-- name: UpdateUserSub :exec
update users set sub = $2 where id = $1;

-- name: AcceptPendingMemberships :exec
update organisation_memberships set accepted_at = current_timestamp, updated_at = current_timestamp where user_id = $1 and accepted_at is null;

-- name: InsertUser :one
insert into users (id, email, access, sub, avatar, api_key) values ($1, $2, $3, $4, $5, $6) returning *;

-- name: UpdateUserPhone :exec
update users set phone = $2 where id = $1;

-- name: UpdateUserActivity :exec
update users set updated = current_timestamp where id = $1;

-- name: UpdateUserCustomerID :exec
update users set customer_id = $1 where id = $2;

-- name: UpdateUserSubscription :exec
update users set access = $1, subscription_id = $2, subscription_end = $3 where customer_id = $4;

-- name: UpdateUserAccess :one
update users set access = $1 where id = $2 returning *;

-- name: UpdateUser :one
update users set
    email = $1,
    phone = $2,
    access = $3,
    avatar = $4,
    subscription_id = $5,
    subscription_end = $6,
    api_key = $7,
    updated = current_timestamp
where id = $8 returning *;

-- name: SelectFiles :many
select * from files where user_id = $1;

-- name: SelectFile :one
select * from files where id = $1;

-- name: InsertFile :one
insert into files (id, user_id, file_key, file_name, file_size, content_type) values ($1, $2, $3, $4, $5, $6) returning *;

-- name: DeleteFile :exec
delete from files where id = $1;

-- name: SelectEmails :many
select * from emails where user_id = $1;

-- name: InsertEmail :one
insert into emails (id, user_id, email_to, email_from, email_subject, email_body) values ($1, $2, $3, $4, $5, $6) returning *;

-- name: SelectEmailAttachments :many
select * from email_attachments where email_id = $1;

-- name: InsertEmailAttachment :one
insert into email_attachments (id, email_id, file_name, content_type) values ($1, $2, $3, $4) returning *;

-- name: CountNotes :one
select count(*) from notes where user_id = $1;

-- name: SelectNotes :many
select * from notes where user_id = $1 order by created desc limit $2 offset $3;

-- name: SelectNote :one
select * from notes where id = $1;

-- name: InsertNote :one
insert into notes (id, user_id, title, category, content) values ($1, $2, $3, $4, $5) returning *;

-- name: UpdateNote :one
update notes set title = $1, category = $2, content = $3 where id = $4 returning *;

-- name: DeleteNote :exec
delete from notes where id = $1;

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
WHERE id = $1;

-- name: UpdateOrganisationStripeCustomer :exec
UPDATE organisations
SET stripe_customer_id = $2, updated_at = CURRENT_TIMESTAMP
WHERE id = $1;

-- name: UpdateOrganisationSubscription :exec
UPDATE organisations
SET
    subscription_tier = $2,
    subscription_id = $3,
    subscription_end = $4,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1;

-- name: GetOrganisationByStripeCustomer :one
SELECT * FROM organisations
WHERE stripe_customer_id = $1;

-- name: DowngradeOrganisationToFree :exec
UPDATE organisations
SET
    subscription_tier = 'free',
    subscription_id = '',
    subscription_end = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1;