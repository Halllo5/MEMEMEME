import { component$, useSignal } from "@builder.io/qwik";
import { routeLoader$, type DocumentHead, Link } from "@builder.io/qwik-city";
import { db } from "~/db/db";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BUCKET_NAME, s3 } from "~/lib/s3";
import {
  canViewMeme,
  canViewMemeViaShare,
  getBuddyStatus,
} from "~/lib/permissions";
import { useSession } from "~/routes/plugin@auth";
import { ErrorPageContent } from "~/components/error-page/ErrorPageContent";
import { BuddyButton } from "~/components/buddy-button/BuddyButton";
import { MemeEditButton } from "~/components/meme-edit-button/MemeEditButton";
import { ShareButton } from "~/components/share-button/ShareButton";

export const useMemeLoader = routeLoader$(async (requestEvent) => {
  const memeId = requestEvent.params.id;
  const session = requestEvent.sharedMap.get("session");
  const sessionUserId = session?.user?.id;

  const query = db
    .selectFrom("memes")
    .where("memes.id", "=", memeId)
    .innerJoin("User", "User.id", "memes.user_id")
    .select([
      "memes.id as imageId",
      "memes.caption",
      "memes.privacy",
      "memes.image_url",
      "memes.extracted_text",
      "memes.created_at as createdAt", // Fetch the timestamp
      "User.name as uploaderName",
      "User.email as uploaderEmail",
      "memes.user_id as uploaderId", // Correctly reference the user_id from memes table
    ]);

  const memeFromDb = await query.executeTakeFirst();

  if (!memeFromDb || !memeFromDb.image_url) {
    requestEvent.status(404);
    return null;
  }

  let hasPermission = await canViewMeme(session, {
    user_id: memeFromDb.uploaderId,
    privacy: memeFromDb.privacy,
  });

  // If normal access denied, check for a share key in the query string
  const shareKey = requestEvent.url.searchParams.get("share");
  if (!hasPermission && shareKey) {
    hasPermission = await canViewMemeViaShare(shareKey, memeId);
  }

  if (!hasPermission) {
    requestEvent.status(404);
    return null;
  }

  const s3Key = `${memeFromDb.image_url}.opt`;
  const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key });
  const presignedImageUrl = await getSignedUrl(s3, command, {
    expiresIn: 3600,
  });

  const buddyStatus = await getBuddyStatus(
    sessionUserId,
    memeFromDb.uploaderId,
  );

  return {
    imageId: memeFromDb.imageId,
    caption: memeFromDb.caption,
    privacy: memeFromDb.privacy,
    extractedText: memeFromDb.extracted_text,
    createdAt: new Date(memeFromDb.createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    uploaderName: memeFromDb.uploaderName || memeFromDb.uploaderEmail,
    uploaderId: memeFromDb.uploaderId,
    imageUrl: presignedImageUrl,
    uploaderLink: `/u/${memeFromDb.uploaderId}`,
    uploaderImageUrl: `/api/avatar/${memeFromDb.uploaderId}`,
    buddyStatus,
  };
});

const MemeNotFound = component$(() => (
  <ErrorPageContent
    status={404}
    message="Meme not found or you don't have permission to view it."
  />
));

export default component$(() => {
  const meme = useMemeLoader();
  const session = useSession();

  if (!meme.value) {
    return <MemeNotFound />;
  }

  const uploaderInitial = meme.value.uploaderName.substring(0, 2).toUpperCase();
  const uploaderProfilePiceError = useSignal(false);
  return (
    <div class="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <div class="space-y-6">
        {/* Header: Uploader Info */}
        <div class="flex items-center justify-between gap-2 sm:gap-4">
          <Link
            href={meme.value.uploaderLink}
            class="group flex min-w-0 items-center gap-3 sm:gap-4"
          >
            {uploaderProfilePiceError.value ? (
              <div class="rounded-base border-border bg-main text-main-foreground flex h-12 w-12 shrink-0 items-center justify-center border-2 text-lg font-bold">
                {uploaderInitial}
              </div>
            ) : (
              <img
                src={meme.value.uploaderImageUrl}
                alt=""
                width={48}
                height={48}
                class="rounded-base border-border h-12 w-12 shrink-0 border-2 object-cover"
                onError$={() => (uploaderProfilePiceError.value = true)}
              />
            )}
            <div class="min-w-0">
              <p class="truncate text-lg font-bold group-hover:underline">
                {meme.value.uploaderName}
              </p>
              <p class="text-foreground/70 truncate text-sm">
                Uploaded on {meme.value.createdAt}
              </p>
            </div>
          </Link>
          <div class="flex shrink-0 items-center gap-2">
            {session.value?.user && (
              <ShareButton memeId={meme.value.imageId} />
            )}
            {session.value?.user &&
              session.value.user.id === meme.value.uploaderId && (
                <MemeEditButton
                  memeId={meme.value.imageId}
                  uploaderId={meme.value.uploaderId}
                  caption={meme.value.caption}
                  privacy={meme.value.privacy}
                />
              )}
            {session.value?.user &&
              session.value.user.id !== meme.value.uploaderId && (
                <BuddyButton
                  buddyStatus={meme.value.buddyStatus}
                  profileUserId={meme.value.uploaderId}
                />
              )}
          </div>
        </div>

        {/* Main Image */}
        <div class="rounded-base border-border bg-main shadow-shadow flex h-[75vh] items-center justify-center overflow-hidden border-2">
          {/* eslint-disable-next-line qwik/jsx-img */}
          <img
            src={meme.value.imageUrl}
            alt={meme.value.caption || "Meme image"}
            class="h-full w-full object-contain"
          />
        </div>

        {/* Caption */}
        {meme.value.caption && (
          <div class="rounded-base border-border bg-background shadow-shadow border-2 p-4">
            <p class="text-lg">{meme.value.caption}</p>
          </div>
        )}

        {/* OCR Text */}
        {meme.value.extractedText && (
          <blockquote class="rounded-base border-border bg-background shadow-shadow border-l-main border-y-2 border-r-2 border-l-4 p-4 italic">
            {meme.value.extractedText}
          </blockquote>
        )}

        {/* Comments Placeholder */}
        <div class="pt-8">
          <h2 class="text-2xl font-bold">Comments</h2>
          <div class="rounded-base border-border text-foreground/50 mt-4 border-2 border-dashed p-8 text-center">
            <p>Comments are coming soon!</p>
          </div>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const meme = resolveValue(useMemeLoader);
  if (!meme) {
    return { title: "Not found | Memememe" };
  }
  const title = meme.caption
    ? `${meme.caption} | Meme by ${meme.uploaderName}`
    : `Meme by ${meme.uploaderName}`;
  return {
    title,
    meta: [
      {
        name: "description",
        content: `A meme titled "${meme.caption}" uploaded by ${meme.uploaderName}.`,
      },
    ],
  };
};
