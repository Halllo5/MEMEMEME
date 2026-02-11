import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("shares")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("share_key", "text", (col) => col.unique().notNull())
    .addColumn("meme_id", "uuid", (col) =>
      col.references("memes.id").onDelete("cascade").notNull(),
    )
    .addColumn("created_by", "uuid", (col) =>
      col.references("User.id").onDelete("cascade").notNull(),
    )
    .addColumn("label", "text")
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("view_count", "integer", (col) => col.defaultTo(0).notNull())
    .addColumn("last_viewed_at", "timestamp")
    .execute();

  await db.schema
    .createIndex("shares_meme_id_idx")
    .on("shares")
    .column("meme_id")
    .execute();

  await db.schema
    .createIndex("shares_created_by_idx")
    .on("shares")
    .column("created_by")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("shares").ifExists().execute();
}
