// src/routes/plugin@startup.ts
import { migrateToLatest } from "../db/migrator";

// --------------------------------------------------------
// TOP-LEVEL AWAIT: The "Magic" Startup Hook
// --------------------------------------------------------
// This code runs exactly ONCE when the server process loads
// this file. It blocks the app from starting until finished.
// --------------------------------------------------------

if (process.env.DATABASE_MIGRATE === "true") {
  console.log("⏳ Server starting... checking migrations...");

  try {
    await migrateToLatest();
    console.log("Migrations ready.");
  } catch (e) {
    console.error("Migration failed during startup:", e);
    // In production, you generally want to crash if DB is invalid
    if (process.env.NODE_ENV === "production") process.exit(1);
  }
}
