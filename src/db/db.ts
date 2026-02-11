import { PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { GeneratedAlways } from "kysely";
import { Kysely } from "kysely";

// --------------------------------------------------------
// 1. SHARED TYPES
// --------------------------------------------------------

export type PrivacyLevel = "public" | "buddies_only" | "private";
export type BuddyStatus = "created" | "buddy" | "blocked";
export type ReportStatus = "created" | "reviewed";

// --------------------------------------------------------
// 2. AUTH TABLES (Auth.js / NextAuth Standard)
// --------------------------------------------------------

export interface UserTable {
  id: GeneratedAlways<string>;
  name: string | null;
  email: string;
  emailVerified: Date | null;
  image: string | null;
}

export interface AccountTable {
  id: GeneratedAlways<string>;
  userId: string;
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token: string | null;
  access_token: string | null;
  expires_at: number | null;
  token_type: string | null;
  scope: string | null;
  id_token: string | null;
  session_state: string | null;
}

export interface SessionTable {
  id: GeneratedAlways<string>;
  userId: string;
  sessionToken: string;
  expires: Date;
}

export interface VerificationTokenTable {
  identifier: string;
  token: string;
  expires: Date;
}

// --------------------------------------------------------
// 3. APP TABLES (Social & Memes)
// --------------------------------------------------------

export interface BuddyListTable {
  // references User.id
  user_id: string;
  // references User.id
  buddy_id: string;
  created_at: GeneratedAlways<Date>;
  status: BuddyStatus;
}

export interface MemesTable {
  id: GeneratedAlways<string>;
  // references User.id
  user_id: string;
  image_url: string;
  caption: string | null;
  extracted_text: string | null;

  // Vector data (handled as string for inserts/selects)
  embedding: string | null;

  // Generated TSVector column
  content_search: GeneratedAlways<string>;

  privacy: PrivacyLevel;
  created_at: GeneratedAlways<Date>;
}

export interface ReportsTable {
  id: GeneratedAlways<string>;
  reporter_id: string;
  meme_id: string;
  message: string | null;
  status: ReportStatus;
  created_at: GeneratedAlways<Date>;
}

export interface SharesTable {
  id: GeneratedAlways<string>;
  share_key: string;
  meme_id: string;
  created_by: string;
  label: string | null;
  created_at: GeneratedAlways<Date>;
  view_count: number;
  last_viewed_at: Date | null;
}

// --------------------------------------------------------
// 4. MAIN DATABASE INTERFACE
// --------------------------------------------------------

export interface Database {
  // Auth.js tables usually default to PascalCase
  User: UserTable;
  Account: AccountTable;
  Session: SessionTable;
  VerificationToken: VerificationTokenTable;

  // Your custom tables usually default to snake_case
  buddy_list: BuddyListTable;
  memes: MemesTable;
  reports: ReportsTable;
  shares: SharesTable;
}

// --------------------------------------------------------
// 5. CLIENT INITIALIZATION
// --------------------------------------------------------

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool: new Pool({
      host: process.env.DATABASE_HOST,
      database: process.env.DATABASE_NAME,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      // Recommended: max connection pool size
      max: 10,
    }),
  }),
});
