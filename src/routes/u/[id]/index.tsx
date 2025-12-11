import { component$, useSignal } from "@builder.io/qwik";
import {
  routeLoader$,
  type DocumentHead,
  server$,
} from "@builder.io/qwik-city";
import { db } from "~/db/db";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BUCKET_NAME, s3 } from "~/lib/s3";
import { ImageCard } from "~/components/image-card/ImageCard";
import { Button } from "~/components/button";
import { areBuddies, getVisiblePrivacyLevelsForUser } from "~/lib/permissions";
import { useSession } from "~/routes/plugin@auth";

const PAGE_SIZE = 12;

export const useUserLoader = routeLoader$(async (requestEvent) => {
  const profileUserId = requestEvent.params.id;
  const session = requestEvent.sharedMap.get("session");
  const sessionUserId = session?.user?.id;

  const profileUser = await db
    .selectFrom("User")
    .where("User.id", "=", profileUserId)
    .select(["id", "name", "email"])
    .executeTakeFirst();

  if (!profileUser) {
    throw requestEvent.error(404, "User not found.");
  }

  const isSelf = sessionUserId === profileUserId;
  const isBuddy = await areBuddies(profileUserId, sessionUserId);
  const privacyLevels = await getVisiblePrivacyLevelsForUser(
    session,
    profileUserId,
  );

  const memesFromDb = await db
    .selectFrom("memes")
    .where("memes.user_id", "=", profileUserId)
    .innerJoin("User", "User.id", "memes.user_id")
    .select([
      "memes.id as imageId",
      "memes.caption",
      "memes.image_url",
      "User.name as uploaderName",
      "User.email as uploaderEmail",
      "User.id as uploaderId",
    ])
    .where("memes.image_url", "is not", null)
    .where("memes.image_url", "!=", "")
    .where("memes.privacy", "in", privacyLevels)
    .limit(PAGE_SIZE)
    .orderBy("memes.created_at", "desc")
    .execute();

  const memesWithUrls = await Promise.all(
    memesFromDb.map(async (meme) => {
      const s3Key = `${meme.image_url}.opt`;
      const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key });
      const presignedImageUrl = await getSignedUrl(s3, command, {
        expiresIn: 60 * 5,
      });

      return {
        ...meme,
        imageUrl: presignedImageUrl,
        uploaderLink: `/u/${meme.uploaderId}`,
        uploaderImageUrl: `/api/avatar/${meme.uploaderId}`,
        uploaderName: meme.uploaderName || meme.uploaderEmail,
      };
    }),
  );

  return {
    profileUser: {
      ...profileUser,
      name: profileUser.name || profileUser.email,
      avatarUrl: `/api/avatar/${profileUser.id}`,
    },
    memes: memesWithUrls,
    isSelf,
    isBuddy,
    hasMore: memesFromDb.length === PAGE_SIZE,
  };
});

export const addBuddy = server$(async function (buddyId: string) {
  const session = this.sharedMap.get("session");
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  const userId: string = session.user.id;

  if (userId === buddyId) {
    throw new Error("Cannot add yourself as a buddy");
  }

  // Bidirectional buddy relationship
  await db
    .insertInto("buddy_list")
    .values({ user_id: userId, buddy_id: buddyId, status: "created" })
    .onConflict((oc) => oc.doNothing())
    .execute();

  return { success: true };
});

export default component$(() => {
  const data = useUserLoader();
  const session = useSession();
  const user = data.value.profileUser;
  const memes = data.value.memes;
  const profilePicError = useSignal(false);
  const isBuddySignal = useSignal(data.value.isBuddy);
  const uploaderInitial = user.name.substring(0, 2).toUpperCase();

  const canBuddyUp = session.value?.user && !data.value.isSelf;

  return (
    <div class="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <div class="space-y-8">
        {/* User Header */}
        <div class="flex flex-col items-center gap-6 sm:flex-row">
          {profilePicError.value ? (
            <div class="rounded-base border-border bg-main text-main-foreground flex h-24 w-24 flex-shrink-0 items-center justify-center border-2 text-4xl font-bold sm:h-32 sm:w-32">
              {uploaderInitial}
            </div>
          ) : (
            <img
              src={user.avatarUrl}
              alt=""
              width={128}
              height={128}
              class="rounded-base border-border h-24 w-24 flex-shrink-0 border-2 object-contain sm:h-32 sm:w-32"
              onError$={() => (profilePicError.value = true)}
            />
          )}
          <div class="flex-grow text-center sm:text-left">
            <h1 class="text-3xl font-bold sm:text-4xl">{user.name}</h1>
            {/* Could add more user info here, like join date */}
          </div>
          {canBuddyUp &&
            (isBuddySignal.value ? (
              <Button disabled style="secondary">
                Buddies
              </Button>
            ) : (
              <Button
                onClick$={async () => {
                  const res = await addBuddy(user.id);
                  if (res.success) {
                    isBuddySignal.value = true;
                  }
                }}
              >
                Buddy Up
              </Button>
            ))}
        </div>

        {/* User's Memes */}
        <div>
          <h2 class="text-2xl font-bold">Memes</h2>
          {memes.length > 0 ? (
            <div class="mt-6 grid grid-cols-3 items-start gap-4">
              {memes.map((meme) => (
                <ImageCard
                  key={meme.imageId}
                  imageUrl={meme.imageUrl}
                  caption={meme.caption ?? undefined}
                  uploaderName={meme.uploaderName}
                  uploaderImageUrl={meme.uploaderImageUrl}
                  uploaderLink={meme.uploaderLink}
                  imageId={meme.imageId}
                />
              ))}
            </div>
          ) : (
            <div class="rounded-base border-border text-foreground/50 mt-6 border-2 border-dashed p-12 text-center">
              <p>This user hasn't uploaded any public memes yet.</p>
            </div>
          )}
        </div>

        {/* TODO: Add pagination / infinite scroll */}
      </div>
    </div>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const data = resolveValue(useUserLoader);
  const title = `${data.profileUser.name}'s Profile | Memememe`;
  return {
    title,
    meta: [
      {
        name: "description",
        content: `Check out ${data.profileUser.name}'s profile and their collection of memes.`,
      },
    ],
  };
};
