import { MemesTable, db } from "~/db/db";
import type { Session } from "@auth/core/types";
import { Selectable, sql } from "kysely";

type Meme = Selectable<MemesTable>;

export type BuddyStatus =
  | { status: "not_buddies" }
  | { status: "buddies" }
  | { status: "request_sent" }
  | { status: "request_received" }
  | { status: "blocked" }
  | { status: "self" };

export async function getBuddyStatus(
  sessionUserId: string | undefined | null,
  profileUserId: string | undefined | null,
): Promise<BuddyStatus> {
  if (!sessionUserId || !profileUserId) {
    return { status: "not_buddies" };
  }

  if (sessionUserId === profileUserId) {
    return { status: "self" };
  }

  const connection = await db
    .selectFrom("buddy_list")
    .selectAll()
    .where((eb) =>
      eb.or([
        eb.and([
          eb("user_id", "=", sessionUserId),
          eb("buddy_id", "=", profileUserId),
        ]),
        eb.and([
          eb("user_id", "=", profileUserId),
          eb("buddy_id", "=", sessionUserId),
        ]),
      ]),
    )
    .executeTakeFirst();

  if (!connection) {
    return { status: "not_buddies" };
  }

  if (connection.status === "blocked") {
    return { status: "blocked" };
  }

  if (connection.status === "buddy") {
    return { status: "buddies" };
  }

  if (connection.status === "created") {
    if (connection.user_id === sessionUserId) {
      return { status: "request_sent" };
    } else {
      return { status: "request_received" };
    }
  }

  return { status: "not_buddies" };
}

export async function areBuddies(
  userId1: string | undefined | null,
  userId2: string | undefined | null,
): Promise<boolean> {
  if (!userId1 || !userId2) return false;
  if (userId1 === userId2) return false;

  const buddyStatus = await getBuddyStatus(userId1, userId2);
  return buddyStatus.status === "buddies";
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

/**
 * Check if a user (by id) can view a meme, without needing a full Session object.
 * Used to re-validate that a share link creator still has access.
 */
export async function canUserViewMeme(
  userId: string,
  meme: { user_id: string; privacy: Meme["privacy"] | null },
): Promise<boolean> {
  if (meme.privacy === "public") {
    return true;
  }

  if (meme.user_id === userId) {
    return true; // Owner can always view
  }

  if (meme.privacy === "buddies_only") {
    return await areBuddies(meme.user_id, userId);
  }

  return false;
}

/**
 * Check if a meme can be viewed via a share key.
 * Validates the share record exists and that the creator still has access.
 * Increments view_count and updates last_viewed_at on success.
 */
export async function canViewMemeViaShare(
  shareKey: string,
  memeId: string,
): Promise<boolean> {
  const share = await db
    .selectFrom("shares")
    .innerJoin("memes", "memes.id", "shares.meme_id")
    .select([
      "shares.id as shareId",
      "shares.created_by",
      "memes.user_id",
      "memes.privacy",
    ])
    .where("shares.share_key", "=", shareKey)
    .where("shares.meme_id", "=", memeId)
    .executeTakeFirst();

  if (!share) {
    return false;
  }

  // Verify the share creator still has access to the meme
  const creatorHasAccess = await canUserViewMeme(share.created_by, {
    user_id: share.user_id,
    privacy: share.privacy,
  });

  if (!creatorHasAccess) {
    return false;
  }

  // Update metrics
  await db
    .updateTable("shares")
    .set({
      view_count: sql`view_count + 1`,
      last_viewed_at: sql`now()`,
    })
    .where("id", "=", share.shareId)
    .execute();

  return true;
}

/**
 * Check if a share key is valid for a given meme, without updating metrics.
 * Used by the thumbnail proxy and social crawlers to avoid inflating view counts.
 */
export async function isShareKeyValid(
  shareKey: string,
  memeId: string,
): Promise<boolean> {
  const share = await db
    .selectFrom("shares")
    .innerJoin("memes", "memes.id", "shares.meme_id")
    .select([
      "shares.created_by",
      "memes.user_id",
      "memes.privacy",
    ])
    .where("shares.share_key", "=", shareKey)
    .where("shares.meme_id", "=", memeId)
    .executeTakeFirst();

  if (!share) {
    return false;
  }

  return await canUserViewMeme(share.created_by, {
    user_id: share.user_id,
    privacy: share.privacy,
  });
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
          eb.or([
            eb(
              "memes.user_id",
              "in",
              eb
                .selectFrom("buddy_list")
                .select("buddy_id")
                .where("user_id", "=", userId)
                .where("status", "=", "buddy"),
            ),
            eb(
              "memes.user_id",
              "in",
              eb
                .selectFrom("buddy_list")
                .select("user_id")
                .where("buddy_id", "=", userId)
                .where("status", "=", "buddy"),
            ),
          ]),
        ]),
      ]),
    );
  }
  return query.where("memes.privacy", "=", "public");
}
