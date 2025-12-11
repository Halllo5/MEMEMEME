import { MemesTable, db } from "~/db/db";
import type { Session } from "@auth/core/types";
import { Selectable } from "kysely";

type Meme = Selectable<MemesTable>;

export async function areBuddies(
  userId1: string | undefined | null,
  userId2: string | undefined | null,
): Promise<boolean> {
  if (!userId1 || !userId2) return false;
  if (userId1 === userId2) return false;

  // Check both directions to be safe, though UI logic should handle creation
  const buddyConnection = await db
    .selectFrom("buddy_list")
    .selectAll()
    .where((eb) =>
      eb.or([
        eb.and([
          eb("user_id", "=", userId1),
          eb("buddy_id", "=", userId2),
          eb("status", "=", "buddy"),
        ]),
        eb.and([
          eb("user_id", "=", userId2),
          eb("buddy_id", "=", userId1),
          eb("status", "=", "buddy"),
        ]),
      ]),
    )
    .executeTakeFirst();

  return !!buddyConnection;
}

export async function canViewMeme(
  session: Session | null,
  meme: { user_id: string; privacy: Meme["privacy"] | null },
): Promise<boolean> {
  if (meme.privacy === "public") {
    return true;
  }

  if (!session?.user?.id) {
    return false; // Must be logged in for non-public memes
  }

  const sessionUserId = session.user.id;
  if (meme.user_id === sessionUserId) {
    return true; // Owner can always view
  }

  if (meme.privacy === "buddies_only") {
    return await areBuddies(meme.user_id, sessionUserId);
  }

  return false;
}

export async function getVisiblePrivacyLevelsForUser(
  session: Session | null,
  profileUserId: string,
): Promise<Array<Meme["privacy"]>> {
  const levels: Array<Meme["privacy"]> = ["public"];

  if (session?.user) {
    const sessionUserId = session.user.id;
    if (sessionUserId === profileUserId) {
      levels.push("buddies_only", "private");
    } else if (await areBuddies(sessionUserId, profileUserId)) {
      levels.push("buddies_only");
    }
  }
  return levels;
}

// Kysely query builder type is complex. Using 'any' for simplicity here.
export function applyMemeFeedVisibility(query: any, session: Session | null) {
  if (session?.user) {
    const userId = session.user.id;
    return query.where((eb: any) =>
      eb.or([
        eb("memes.user_id", "=", userId),
        eb("memes.privacy", "=", "public"),
        eb.and([
          eb("memes.privacy", "=", "buddies_only"),
          eb(
            "memes.user_id",
            "in",
            eb
              .selectFrom("buddy_list")
              .select("buddy_id")
              .where("user_id", "=", userId)
              .where("status", "=", "buddy"),
          ),
        ]),
      ]),
    );
  }
  return query.where("memes.privacy", "=", "public");
}
