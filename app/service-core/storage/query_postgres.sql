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

-- =============================================================================
-- H5P Libraries (Platform-wide)
-- =============================================================================

-- name: GetH5PLibrary :one
SELECT * FROM h5p_libraries WHERE id = $1;

-- name: GetH5PLibraryByMachineNameVersion :one
SELECT * FROM h5p_libraries
WHERE machine_name = $1
  AND major_version = $2
  AND minor_version = $3
  AND patch_version = $4;

-- name: GetH5PLibraryByMachineName :one
SELECT * FROM h5p_libraries
WHERE machine_name = $1
ORDER BY major_version DESC, minor_version DESC, patch_version DESC
LIMIT 1;

-- name: ListH5PLibraries :many
SELECT * FROM h5p_libraries
ORDER BY machine_name ASC, major_version DESC, minor_version DESC, patch_version DESC;

-- name: ListH5PRunnableLibraries :many
SELECT * FROM h5p_libraries
WHERE runnable = true
ORDER BY title ASC;

-- name: UpsertH5PLibrary :one
INSERT INTO h5p_libraries (
    id, machine_name, major_version, minor_version, patch_version,
    title, origin, metadata_json, categories, keywords,
    screenshots, description, icon_path, package_path, extracted_path,
    runnable, restricted
) VALUES (
    $1, $2, $3, $4, $5,
    $6, $7, $8, $9, $10,
    $11, $12, $13, $14, $15,
    $16, $17
)
ON CONFLICT (machine_name, major_version, minor_version, patch_version)
DO UPDATE SET
    title = EXCLUDED.title,
    origin = EXCLUDED.origin,
    metadata_json = EXCLUDED.metadata_json,
    categories = EXCLUDED.categories,
    keywords = EXCLUDED.keywords,
    screenshots = EXCLUDED.screenshots,
    description = EXCLUDED.description,
    icon_path = EXCLUDED.icon_path,
    package_path = EXCLUDED.package_path,
    extracted_path = EXCLUDED.extracted_path,
    runnable = EXCLUDED.runnable,
    restricted = EXCLUDED.restricted,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;

-- name: DeleteH5PLibrary :exec
DELETE FROM h5p_libraries WHERE id = $1;

-- name: DeleteH5PLibraryByMachineName :exec
DELETE FROM h5p_libraries WHERE machine_name = $1;

-- name: CountH5PLibraries :one
SELECT count(*) FROM h5p_libraries;

-- =============================================================================
-- H5P Library Dependencies
-- =============================================================================

-- name: InsertH5PLibraryDependency :exec
INSERT INTO h5p_library_dependencies (id, library_id, depends_on_id, dependency_type)
VALUES ($1, $2, $3, $4)
ON CONFLICT (library_id, depends_on_id, dependency_type) DO NOTHING;

-- name: GetH5PLibraryDependencies :many
SELECT d.*, l.machine_name, l.major_version, l.minor_version, l.patch_version, l.title
FROM h5p_library_dependencies d
JOIN h5p_libraries l ON l.id = d.depends_on_id
WHERE d.library_id = $1;

-- name: DeleteH5PLibraryDependencies :exec
DELETE FROM h5p_library_dependencies WHERE library_id = $1;

-- name: GetH5PLibraryFullDependencyTree :many
WITH RECURSIVE dep_tree AS (
    SELECT d.depends_on_id AS library_id, d.dependency_type, 0 AS depth
    FROM h5p_library_dependencies d
    WHERE d.library_id = $1
    UNION
    SELECT d.depends_on_id, d.dependency_type, dt.depth + 1
    FROM h5p_library_dependencies d
    JOIN dep_tree dt ON dt.library_id = d.library_id
    WHERE dt.depth < 20
)
SELECT DISTINCT l.*
FROM dep_tree dt
JOIN h5p_libraries l ON l.id = dt.library_id;

-- =============================================================================
-- H5P Hub Cache
-- =============================================================================

-- name: GetH5PHubCache :one
SELECT * FROM h5p_hub_cache
WHERE cache_key = $1 AND expires_at > CURRENT_TIMESTAMP;

-- name: UpsertH5PHubCache :one
INSERT INTO h5p_hub_cache (id, cache_key, data, expires_at)
VALUES ($1, $2, $3, $4)
ON CONFLICT (cache_key)
DO UPDATE SET
    data = EXCLUDED.data,
    expires_at = EXCLUDED.expires_at,
    created_at = CURRENT_TIMESTAMP
RETURNING *;

-- name: DeleteExpiredH5PHubCache :exec
DELETE FROM h5p_hub_cache WHERE expires_at < CURRENT_TIMESTAMP;

-- =============================================================================
-- H5P Org Libraries (Per-organisation enablement)
-- =============================================================================

-- name: ListH5POrgLibraries :many
SELECT ol.*, l.machine_name, l.major_version, l.minor_version, l.patch_version,
       l.title, l.description, l.icon_path, l.runnable, l.origin
FROM h5p_org_libraries ol
JOIN h5p_libraries l ON l.id = ol.library_id
WHERE ol.org_id = $1
ORDER BY l.title ASC;

-- name: ListH5POrgEnabledLibraries :many
SELECT ol.*, l.machine_name, l.major_version, l.minor_version, l.patch_version,
       l.title, l.description, l.icon_path, l.runnable, l.origin
FROM h5p_org_libraries ol
JOIN h5p_libraries l ON l.id = ol.library_id
WHERE ol.org_id = $1 AND ol.enabled = true
ORDER BY l.title ASC;

-- name: EnableH5POrgLibrary :exec
INSERT INTO h5p_org_libraries (id, org_id, library_id, enabled)
VALUES ($1, $2, $3, true)
ON CONFLICT (org_id, library_id)
DO UPDATE SET enabled = true;

-- name: DisableH5POrgLibrary :exec
UPDATE h5p_org_libraries SET enabled = false
WHERE org_id = $1 AND library_id = $2;

-- name: DeleteH5POrgLibrary :exec
DELETE FROM h5p_org_libraries WHERE org_id = $1 AND library_id = $2;
