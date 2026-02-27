/**
 * Clients Remote Functions
 *
 * CRUD operations for managing organisation clients.
 * Clients are linked to form submissions and can be searched when sending forms.
 */

import { query, command } from "$app/server";
import * as v from "valibot";
import { db } from "$lib/server/db";
import {
	clients,
} from "$lib/server/schema";
import { error } from "@sveltejs/kit";
import { getOrganisationContext, requireOrganisationRole } from "$lib/server/organisation";
import { eq, and, asc, ilike, or, sql } from "drizzle-orm";

// =============================================================================
// Validation Schemas
// =============================================================================

const CreateClientSchema = v.object({
	businessName: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
	email: v.pipe(v.string(), v.email(), v.maxLength(255)),
	phone: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(50)))),
	contactName: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(255)))),
	notes: v.optional(v.nullable(v.string())),
	website: v.optional(v.string()),
});

const UpdateClientSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	businessName: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(255))),
	email: v.optional(v.pipe(v.string(), v.email(), v.maxLength(255))),
	phone: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(50)))),
	contactName: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(255)))),
	notes: v.optional(v.nullable(v.string())),
	website: v.optional(v.string()),
});

const ClientStatusSchema = v.union([v.literal("active"), v.literal("archived")]);

const ClientFiltersSchema = v.optional(
	v.object({
		search: v.optional(v.string()),
		status: v.optional(ClientStatusSchema),
		limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
		offset: v.optional(v.pipe(v.number(), v.minValue(0))),
	})
);

// =============================================================================
// Query Functions (Read Operations)
// =============================================================================

/**
 * Get all clients for the current organisation.
 * Supports search, status filtering, and pagination.
 * By default, returns only active clients unless status is specified.
 */
export const getClients = query(ClientFiltersSchema, async (filters) => {
	const context = await getOrganisationContext();
	const { search, status = "active", limit = 50, offset = 0 } = filters || {};

	// Build base conditions
	const conditions = [eq(clients.organisationId, context.organisationId)];

	// Add status filter (null means all statuses)
	if (status) {
		conditions.push(eq(clients.status, status));
	}

	// Add search filter
	if (search && search.trim()) {
		const searchTerm = `%${search.trim()}%`;
		conditions.push(
			or(
				ilike(clients.businessName, searchTerm),
				ilike(clients.email, searchTerm),
				ilike(clients.contactName, searchTerm)
			)!
		);
	}

	return db
		.select()
		.from(clients)
		.where(and(...conditions))
		.orderBy(asc(clients.businessName))
		.limit(limit)
		.offset(offset);
});

/**
 * Get a single client by ID.
 */
export const getClientById = query(v.pipe(v.string(), v.uuid()), async (clientId) => {
	const context = await getOrganisationContext();

	const [client] = await db
		.select()
		.from(clients)
		.where(and(eq(clients.id, clientId), eq(clients.organisationId, context.organisationId)));

	if (!client) {
		throw error(404, "Client not found");
	}

	return client;
});

/**
 * Get a client by email (for duplicate checking or linking).
 */
export const getClientByEmail = query(v.pipe(v.string(), v.email()), async (email) => {
	const context = await getOrganisationContext();

	const [client] = await db
		.select()
		.from(clients)
		.where(and(eq(clients.email, email.toLowerCase()), eq(clients.organisationId, context.organisationId)));

	return client || null;
});

/**
 * Search clients by query string.
 * Returns top 10 matches for autocomplete.
 */
export const searchClients = query(
	v.object({
		query: v.pipe(v.string(), v.minLength(1)),
		limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(50))),
	}),
	async ({ query: searchQuery, limit = 10 }) => {
		const context = await getOrganisationContext();
		const searchTerm = `%${searchQuery.trim()}%`;

		// Search in clients table
		const clientResults = await db
			.select()
			.from(clients)
			.where(
				and(
					eq(clients.organisationId, context.organisationId),
					or(
						ilike(clients.businessName, searchTerm),
						ilike(clients.email, searchTerm),
						ilike(clients.contactName, searchTerm)
					)
				)
			)
			.orderBy(asc(clients.businessName))
			.limit(limit);

		return clientResults;
	}
);

/**
 * Get client count for the organisation.
 */
export const getClientCount = query(async () => {
	const context = await getOrganisationContext();

	const [result] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(clients)
		.where(eq(clients.organisationId, context.organisationId));

	return result?.count || 0;
});

// =============================================================================
// Command Functions (Write Operations)
// =============================================================================

/**
 * Create a new client.
 * Requires admin or owner role.
 */
export const createClient = command(CreateClientSchema, async (data) => {
	const context = await requireOrganisationRole(["owner", "admin", "member"]);

	// Check for existing client with same email
	const [existing] = await db
		.select({ id: clients.id })
		.from(clients)
		.where(
			and(
				eq(clients.organisationId, context.organisationId),
				eq(clients.email, data.email.toLowerCase())
			)
		);

	if (existing) {
		throw error(400, "A client with this email already exists");
	}

	const [client] = await db
		.insert(clients)
		.values({
			organisationId: context.organisationId,
			businessName: data.businessName,
			email: data.email.toLowerCase(),
			phone: data.phone || null,
			contactName: data.contactName || null,
			notes: data.notes || null,
			website: data.website || "",
		})
		.returning();

	return client;
});

/**
 * Create a client if they don't exist, or return existing.
 * Used when creating form submissions.
 */
export const getOrCreateClient = command(
	v.object({
		businessName: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
		email: v.pipe(v.string(), v.email(), v.maxLength(255)),
		contactName: v.optional(v.nullable(v.string())),
	}),
	async (data) => {
		const context = await getOrganisationContext();

		// Check for existing client
		const [existing] = await db
			.select()
			.from(clients)
			.where(
				and(
					eq(clients.organisationId, context.organisationId),
					eq(clients.email, data.email.toLowerCase())
				)
			);

		if (existing) {
			return { client: existing, created: false };
		}

		// Create new client
		const [client] = await db
			.insert(clients)
			.values({
				organisationId: context.organisationId,
				businessName: data.businessName,
				email: data.email.toLowerCase(),
				contactName: data.contactName || null,
			})
			.returning();

		return { client, created: true };
	}
);

/**
 * Update an existing client.
 * Requires admin or owner role.
 */
export const updateClient = command(UpdateClientSchema, async (data) => {
	const context = await requireOrganisationRole(["owner", "admin", "member"]);

	// Verify client belongs to organisation
	const [existing] = await db
		.select()
		.from(clients)
		.where(and(eq(clients.id, data.id), eq(clients.organisationId, context.organisationId)));

	if (!existing) {
		throw error(404, "Client not found");
	}

	// Check email uniqueness if changing
	if (data.email && data.email.toLowerCase() !== existing.email) {
		const [emailExists] = await db
			.select({ id: clients.id })
			.from(clients)
			.where(
				and(
					eq(clients.organisationId, context.organisationId),
					eq(clients.email, data.email.toLowerCase())
				)
			);

		if (emailExists) {
			throw error(400, "A client with this email already exists");
		}
	}

	// Build update object
	const updates: Record<string, unknown> = {
		updatedAt: new Date(),
	};

	if (data.businessName !== undefined) updates["businessName"] = data.businessName;
	if (data.email !== undefined) updates["email"] = data.email.toLowerCase();
	if (data.phone !== undefined) updates["phone"] = data.phone;
	if (data.contactName !== undefined) updates["contactName"] = data.contactName;
	if (data.notes !== undefined) updates["notes"] = data.notes;
	if (data.website !== undefined) updates["website"] = data.website;

	const [client] = await db
		.update(clients)
		.set(updates)
		.where(eq(clients.id, data.id))
		.returning();

	return client;
});

/**
 * Delete a client.
 * Requires owner role.
 */
export const deleteClient = command(v.pipe(v.string(), v.uuid()), async (clientId) => {
	const context = await requireOrganisationRole(["owner"]);

	// Verify client belongs to organisation
	const [existing] = await db
		.select({ id: clients.id })
		.from(clients)
		.where(and(eq(clients.id, clientId), eq(clients.organisationId, context.organisationId)));

	if (!existing) {
		throw error(404, "Client not found");
	}

	// Note: form_submissions have ON DELETE SET NULL for client_id,
	// so deleting a client won't delete their submissions
	await db.delete(clients).where(eq(clients.id, clientId));

	return { success: true };
});

/**
 * Archive a client (soft delete).
 * Sets status to 'archived'.
 */
export const archiveClient = command(v.pipe(v.string(), v.uuid()), async (clientId) => {
	const context = await requireOrganisationRole(["owner", "admin"]);

	// Verify client belongs to organisation
	const [existing] = await db
		.select({ id: clients.id })
		.from(clients)
		.where(and(eq(clients.id, clientId), eq(clients.organisationId, context.organisationId)));

	if (!existing) {
		throw error(404, "Client not found");
	}

	await db
		.update(clients)
		.set({ status: "archived", updatedAt: new Date() })
		.where(eq(clients.id, clientId));

	return { success: true };
});

/**
 * Restore an archived client.
 * Sets status back to 'active'.
 */
export const restoreClient = command(v.pipe(v.string(), v.uuid()), async (clientId) => {
	const context = await requireOrganisationRole(["owner", "admin"]);

	// Verify client belongs to organisation
	const [existing] = await db
		.select({ id: clients.id })
		.from(clients)
		.where(and(eq(clients.id, clientId), eq(clients.organisationId, context.organisationId)));

	if (!existing) {
		throw error(404, "Client not found");
	}

	await db
		.update(clients)
		.set({ status: "active", updatedAt: new Date() })
		.where(eq(clients.id, clientId));

	return { success: true };
});

