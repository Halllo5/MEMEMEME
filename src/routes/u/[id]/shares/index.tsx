import { component$, useSignal, $ } from "@builder.io/qwik";
import { routeLoader$, server$, type DocumentHead, Link } from "@builder.io/qwik-city";
import { db } from "~/db/db";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BUCKET_NAME, s3 } from "~/lib/s3";
import { useSession } from "~/routes/plugin@auth";
import { ErrorPageContent } from "~/components/error-page/ErrorPageContent";
import { Button } from "~/components/button";

export const useSharesLoader = routeLoader$(async (requestEvent) => {
  const profileUserId = requestEvent.params.id;
  const session = requestEvent.sharedMap.get("session");
  const sessionUserId = session?.user?.id;

  // Only the user themselves can view their shares
  if (!sessionUserId || sessionUserId !== profileUserId) {
    requestEvent.status(404);
    return null;
  }

  const shares = await db
    .selectFrom("shares")
    .innerJoin("memes", "memes.id", "shares.meme_id")
    .innerJoin("User", "User.id", "memes.user_id")
    .select([
      "shares.id as shareId",
      "shares.share_key",
      "shares.label",
      "shares.view_count",
      "shares.last_viewed_at",
      "shares.created_at",
      "memes.id as memeId",
      "memes.caption",
      "memes.image_url",
      "User.name as memeOwnerName",
      "User.email as memeOwnerEmail",
      "memes.user_id as memeOwnerId",
    ])
    .where("shares.created_by", "=", profileUserId)
    .orderBy("shares.created_at", "desc")
    .execute();

  const origin = requestEvent.url.origin;

  const sharesWithUrls = await Promise.all(
    shares.map(async (share) => {
      let thumbnailUrl: string | null = null;
      if (share.image_url) {
        const s3Key = `${share.image_url}.opt`;
        const command = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
        });
        thumbnailUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 5 });
      }

      return {
        shareId: share.shareId,
        shareKey: share.share_key,
        shareUrl: `${origin}/meme/${share.memeId}?share=${share.share_key}`,
        label: share.label,
        viewCount: share.view_count,
        lastViewedAt: share.last_viewed_at
          ? new Date(share.last_viewed_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : null,
        createdAt: new Date(share.created_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        memeId: share.memeId,
        caption: share.caption,
        thumbnailUrl,
        memeOwnerName: share.memeOwnerName || share.memeOwnerEmail,
        memeOwnerId: share.memeOwnerId,
      };
    }),
  );

  return { shares: sharesWithUrls };
});

const deleteShare = server$(async function (shareId: string) {
  const session = this.sharedMap.get("session");
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const share = await db
    .selectFrom("shares")
    .select("created_by")
    .where("id", "=", shareId)
    .executeTakeFirst();

  if (!share || share.created_by !== session.user.id) {
    throw new Error("Not authorized");
  }

  await db.deleteFrom("shares").where("id", "=", shareId).execute();

  return { success: true };
});

const updateLabel = server$(async function (shareId: string, label: string) {
  const session = this.sharedMap.get("session");
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const share = await db
    .selectFrom("shares")
    .select("created_by")
    .where("id", "=", shareId)
    .executeTakeFirst();

  if (!share || share.created_by !== session.user.id) {
    throw new Error("Not authorized");
  }

  await db
    .updateTable("shares")
    .set({ label: label || null })
    .where("id", "=", shareId)
    .execute();

  return { success: true };
});

const NotFound = component$(() => (
  <ErrorPageContent status={404} message="Page not found." />
));

export default component$(() => {
  const data = useSharesLoader();
  const session = useSession();

  if (!data.value) {
    return <NotFound />;
  }

  const shares = data.value.shares;

  return (
    <div class="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <h1 class="text-3xl font-bold">My Shares</h1>
          <Link
            href={`/u/${session.value?.user?.id}`}
            class="text-foreground/70 text-sm hover:underline"
          >
            Back to Profile
          </Link>
        </div>

        {shares.length === 0 ? (
          <div class="rounded-base border-border text-foreground/50 border-2 border-dashed p-12 text-center">
            <p>You haven't shared any memes yet.</p>
            <p class="mt-2 text-sm">
              Visit a meme and click "Share" to create a share link.
            </p>
          </div>
        ) : (
          <div class="space-y-4">
            {shares.map((share) => (
              <ShareRow key={share.shareId} share={share} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

interface ShareRowProps {
  share: {
    shareId: string;
    shareKey: string;
    shareUrl: string;
    label: string | null;
    viewCount: number;
    lastViewedAt: string | null;
    createdAt: string;
    memeId: string;
    caption: string | null;
    thumbnailUrl: string | null;
    memeOwnerName: string | null;
    memeOwnerId: string;
  };
}

const ShareRow = component$<ShareRowProps>(({ share }) => {
  const copied = useSignal(false);
  const isDeleting = useSignal(false);
  const isDeleted = useSignal(false);
  const isEditingLabel = useSignal(false);
  const labelInput = useSignal(share.label ?? "");
  const currentLabel = useSignal(share.label);
  const isSavingLabel = useSignal(false);

  const handleCopy = $(async () => {
    try {
      await navigator.clipboard.writeText(share.shareUrl);
      copied.value = true;
      setTimeout(() => {
        copied.value = false;
      }, 2000);
    } catch {
      // Clipboard API may not be available
    }
  });

  const handleDelete = $(async () => {
    if (!confirm("Delete this share link? Anyone using it will lose access.")) {
      return;
    }
    isDeleting.value = true;
    try {
      const res = await deleteShare(share.shareId);
      if (res.success) {
        isDeleted.value = true;
      }
    } catch {
      isDeleting.value = false;
    }
  });

  const handleSaveLabel = $(async () => {
    isSavingLabel.value = true;
    try {
      await updateLabel(share.shareId, labelInput.value);
      currentLabel.value = labelInput.value || null;
      isEditingLabel.value = false;
    } catch {
      // Error saving
    } finally {
      isSavingLabel.value = false;
    }
  });

  if (isDeleted.value) {
    return null;
  }

  return (
    <div class="rounded-base border-border bg-background shadow-shadow border-2 p-4">
      <div class="flex gap-4">
        {/* Thumbnail */}
        {share.thumbnailUrl && (
          <Link
            href={`/meme/${share.memeId}`}
            class="hidden flex-shrink-0 sm:block"
          >
            {/* eslint-disable-next-line qwik/jsx-img */}
            <img
              src={share.thumbnailUrl}
              alt={share.caption || "Shared meme"}
              class="rounded-base border-border h-20 w-20 border-2 object-cover"
            />
          </Link>
        )}

        {/* Info */}
        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              {/* Label */}
              {isEditingLabel.value ? (
                <div class="mb-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={labelInput.value}
                    onInput$={(e) =>
                      (labelInput.value = (e.target as HTMLInputElement).value)
                    }
                    placeholder="e.g. For Discord"
                    class="rounded-base border-border bg-background focus:border-main border-2 px-2 py-1 text-sm focus:outline-none"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    variant="default"
                    disabled={isSavingLabel.value}
                    onClick$={handleSaveLabel}
                  >
                    {isSavingLabel.value ? "..." : "Save"}
                  </Button>
                  <button
                    type="button"
                    class="text-foreground/50 hover:text-foreground text-sm"
                    onClick$={() => {
                      isEditingLabel.value = false;
                      labelInput.value = currentLabel.value ?? "";
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div class="mb-1 flex items-center gap-2">
                  {currentLabel.value ? (
                    <span class="text-sm font-bold">{currentLabel.value}</span>
                  ) : (
                    <span class="text-foreground/40 text-sm italic">
                      No label
                    </span>
                  )}
                  <button
                    type="button"
                    class="text-foreground/50 hover:text-foreground text-xs hover:underline"
                    onClick$={() => (isEditingLabel.value = true)}
                  >
                    edit
                  </button>
                </div>
              )}

              {/* Meme link */}
              <Link
                href={`/meme/${share.memeId}`}
                class="text-sm hover:underline"
              >
                {share.caption || "Untitled meme"}
              </Link>
              <p class="text-foreground/50 text-xs">
                by{" "}
                <Link
                  href={`/u/${share.memeOwnerId}`}
                  class="hover:underline"
                >
                  {share.memeOwnerName}
                </Link>
              </p>
            </div>

            {/* Metrics */}
            <div class="text-foreground/50 flex-shrink-0 text-right text-xs">
              <p>
                {share.viewCount} {share.viewCount === 1 ? "view" : "views"}
              </p>
              {share.lastViewedAt && <p>Last viewed {share.lastViewedAt}</p>}
              <p>Created {share.createdAt}</p>
            </div>
          </div>

          {/* Share URL + Actions */}
          <div class="mt-2 flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={share.shareUrl}
              class="rounded-base border-border bg-secondary-background min-w-0 flex-1 border-2 px-2 py-1 text-xs"
              onClick$={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button size="sm" variant="default" onClick$={handleCopy}>
              {copied.value ? "Copied!" : "Copy"}
            </Button>
            <Button
              size="sm"
              variant="neutral"
              disabled={isDeleting.value}
              onClick$={handleDelete}
            >
              {isDeleting.value ? "..." : "Delete"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "My Shares | Memememe",
  meta: [
    {
      name: "description",
      content: "Manage your shared meme links.",
    },
  ],
};
