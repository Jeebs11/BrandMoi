import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { setDefaultResultOrder } from "node:dns";
import { setDefaultAutoSelectFamily } from "node:net";
import * as schema from "./schema";

// Node's happy-eyeballs (autoSelectFamily) reliably ETIMEDOUTs against this
// Neon endpoint even though raw TCP connects instantly — its 250ms per-address
// attempt window is too tight for the TLS-fronted multi-A-record host.
// Verified empirically: ON → ETIMEDOUT, OFF → connects in ~2.5s every time.
setDefaultAutoSelectFamily(false);
setDefaultResultOrder("ipv4first");

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Keep sockets alive and bound the connect wait so a cold serverless DB
  // produces a clean retryable error instead of hung parallel connects.
  keepAlive: true,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
  max: 5,
});

// CRITICAL: an idle pooled connection dropping (Neon is serverless and recycles
// sockets; transient EADDRNOTAVAIL/ECONNRESET happen) emits an 'error' event on
// the pool. Without this handler Node treats it as an unhandled 'error' and
// crashes the whole process. Log and let pg discard the dead connection — the
// next query transparently opens a fresh one.
pool.on("error", (err) => {
  console.error("[db pool] idle connection error (recovered):", err.message);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
