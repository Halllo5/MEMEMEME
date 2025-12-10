// src/db/migrator.ts
import { Migrator, type Migration, type MigrationProvider } from "kysely";
import { db } from "./db"; // Import your main db instance

// 1. Setup a custom provider to work with Vite/Bun bundling
// This grabs all files in the migrations folder ending in .ts
const migrationFiles = import.meta.glob("./migrations/*.ts", { eager: true });

const viteMigrationProvider: MigrationProvider = {
  async getMigrations() {
    const migrations: Record<string, Migration> = {};

    for (const [path, mod] of Object.entries(migrationFiles)) {
      // Extract filename (e.g., '001_create_db.ts') to use as the key
      const key = path.split("/").pop()?.replace(".ts", "") || "";
      if (key) {
        migrations[key] = mod as Migration;
      }
    }
    return migrations;
  },
};

export async function migrateToLatest() {
  const migrator = new Migrator({
    db,
    provider: viteMigrationProvider,
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === "Success") {
      console.log(`✅ Migration "${it.migrationName}" executed successfully`);
    } else if (it.status === "Error") {
      console.error(`❌ Failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error("❌ Failed to migrate");
    console.error(error);
    // Optional: exit process if migration fails
    // process.exit(1)
  }
}
