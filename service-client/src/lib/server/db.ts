/**
 * Database Connection for Remote Functions
 *
 * Direct PostgreSQL connection using drizzle-orm.
 * Enables remote functions to access the database without going through the Go backend.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "$env/dynamic/private";
import * as schema from "./schema";

const { Pool } = pg;

// Create a connection pool
const pool = new Pool({
	host: env["POSTGRES_HOST"] || "localhost",
	port: parseInt(env["POSTGRES_PORT"] || "5432"),
	database: env["POSTGRES_DB"] || "postgres",
	user: env["POSTGRES_USER"] || "postgres",
	password: env["POSTGRES_PASSWORD"] || "postgres",
	max: 10, // Maximum number of connections in the pool
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 2000,
});

// Create drizzle instance with schema
export const db = drizzle(pool, { schema });

// Export pool for direct queries if needed
export { pool };
