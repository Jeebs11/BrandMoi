import app from "./app.js";
import { seedDraftsIfEmpty } from "./lib/seed.js";
import { loadBlocklist } from "./lib/blocklist.js";

// Last-resort safety net: a transient driver/socket error escaping a handler
// should be logged, not crash the whole API. (The pg pool has its own handler
// in lib/db; this catches anything else.)
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async () => {
  console.log(`Server listening on port ${port}`);
  try {
    await seedDraftsIfEmpty();
  } catch (err) {
    console.error("Seed error:", err);
  }
  try {
    await loadBlocklist();
  } catch (err) {
    console.error("Blocklist load error:", err);
  }
});
