import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // 1. Buddy list status
  await db.schema
    .createType("buddy_status")
    .asEnum(["created", "buddy", "blocked"])
    .execute();

  await db.schema
    .alterTable("buddy_list")
    .addColumn("status", sql`buddy_status`, (col) =>
      col.defaultTo("created").notNull(),
    )
    .execute();

  // 2. Reports table
  await db.schema
    .createType("report_status")
    .asEnum(["created", "reviewed"])
    .execute();

  await db.schema
    .createTable("reports")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("reporter_id", "uuid", (col) =>
      col.references("User.id").onDelete("cascade").notNull(),
    )
    .addColumn("meme_id", "uuid", (col) =>
      col.references("memes.id").onDelete("cascade").notNull(),
    )
    .addColumn("message", "text")
    .addColumn("status", sql`report_status`, (col) =>
      col.defaultTo("created").notNull(),
    )
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await db.schema
    .createIndex("reports_reporter_id_idx")
    .on("reports")
    .column("reporter_id")
    .execute();

  await db.schema
    .createIndex("reports_meme_id_idx")
    .on("reports")
    .column("meme_id")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("reports").ifExists().execute();
  await db.schema.dropType("report_status").ifExists().execute();

  // It's safer to check if the column exists before dropping, but Kysely's alterTable().dropColumn() doesn't have ifExists().
  // We'll wrap in a try-catch or assume it exists if the up migration ran.
  // For simplicity, we'll just execute it. If it fails, the migration is in a bad state.
  try {
    await db.schema.alterTable("buddy_list").dropColumn("status").execute();
  } catch {
    // You can log the error if you want, e.g., if the column was already removed.
    console.log(
      "Could not drop column 'status' from 'buddy_list', it might not exist.",
    );
  }

  await db.schema.dropType("buddy_status").ifExists().execute();
}
