import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // 1. Enable Extensions
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`.execute(db);
  await sql`CREATE EXTENSION IF NOT EXISTS "vector"`.execute(db); // For the vibe check

  // 2. Create Types
  await db.schema
    .createType("privacy_level")
    .asEnum(["public", "buddies_only", "private"])
    .execute();

  // 4. Buddy List (The Social Graph)
  await db.schema
    .createTable("buddy_list")
    .addColumn("user_id", "uuid", (col) => col.references("User.id").notNull())
    .addColumn("buddy_id", "uuid", (col) => col.references("User.id").notNull())
    .addColumn("created_at", "timestamp", (col) => col.defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("buddy_list_pk", ["user_id", "buddy_id"]) // Composite PK
    .execute();

  // 5. Memes (The Heavy Lifter)
  await db.schema
    .createTable("memes")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("user_id", "uuid", (col) => col.references("User.id").notNull())
    .addColumn("image_url", "text", (col) => col.notNull())
    .addColumn("caption", "text")
    .addColumn("extracted_text", "text")
    .addColumn("privacy", sql`privacy_level`, (col) =>
      col.defaultTo("public").notNull(),
    )
    .addColumn("created_at", "timestamp", (col) => col.defaultTo(sql`now()`))

    // The Vibe (768 dimensions is standard for Google/HuggingFace embeddings)
    .addColumn("embedding", sql`vector(768)`)

    // The Keywords (Generated Column)
    // We use raw SQL here to define the 'GENERATED ALWAYS AS' logic
    .addColumn("content_search", sql`tsvector`, (col) =>
      col
        .generatedAlwaysAs(
          sql`to_tsvector('english', (coalesce(caption, '') || ' ' || coalesce(extracted_text, ''))::text)`,
        )
        .stored(),
    )
    .execute();
  await sql`CREATE INDEX meme_embedding_idx ON memes USING hnsw (embedding vector_cosine_ops)`.execute(
    db,
  );
  await sql`CREATE INDEX meme_search_idx ON memes USING gin (content_search)`.execute(
    db,
  );
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("memes").execute();
  await db.schema.dropTable("buddy_list").execute();
  await db.schema.dropType("privacy_level").execute();
}
