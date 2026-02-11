import { component$, useSignal, $ } from "@builder.io/qwik";
import { server$ } from "@builder.io/qwik-city";
import { LuShare2 } from "@qwikest/icons/lucide";
import { db } from "~/db/db";
import { canViewMeme } from "~/lib/permissions";
import { Button } from "~/components/button";

export const createShareLink = server$(async function (memeId: string) {
  const session = this.sharedMap.get("session");
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  // Verify the user can view this meme
  const meme = await db
    .selectFrom("memes")
    .select(["user_id", "privacy"])
    .where("id", "=", memeId)
    .executeTakeFirst();

  if (!meme) {
    throw new Error("Meme not found");
  }

  const hasAccess = await canViewMeme(session, {
    user_id: meme.user_id,
    privacy: meme.privacy,
  });

  if (!hasAccess) {
    throw new Error("You do not have access to this meme");
  }

  // Generate a cryptographically random share key (32 bytes -> 43 chars base64url)
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const shareKey = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const share = await db
    .insertInto("shares")
    .values({
      share_key: shareKey,
      meme_id: memeId,
      created_by: session.user.id,
    })
    .returning(["id", "share_key"])
    .executeTakeFirstOrThrow();

  const origin = this.url.origin;
  const shareUrl = `${origin}/meme/${memeId}?share=${share.share_key}`;

  return { shareId: share.id, shareUrl };
});

export const updateShareLabel = server$(async function (
  shareId: string,
  label: string,
) {
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

export const deleteShareLink = server$(async function (shareId: string) {
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

interface ShareButtonProps {
  memeId: string;
}

export const ShareButton = component$<ShareButtonProps>(({ memeId }) => {
  const isOpen = useSignal(false);
  const isCreating = useSignal(false);
  const isSavingLabel = useSignal(false);
  const shareUrl = useSignal("");
  const shareId = useSignal("");
  const labelInput = useSignal("");
  const labelSaved = useSignal(false);
  const copied = useSignal(false);

  const handleShare = $(async () => {
    if (isCreating.value) return;
    isCreating.value = true;
    try {
      const result = await createShareLink(memeId);
      shareUrl.value = result.shareUrl;
      shareId.value = result.shareId;
      labelInput.value = "";
      labelSaved.value = false;
      copied.value = false;
      isOpen.value = true;

      // Auto-copy to clipboard
      try {
        await navigator.clipboard.writeText(result.shareUrl);
        copied.value = true;
        setTimeout(() => {
          copied.value = false;
        }, 2000);
      } catch {
        // Clipboard API may not be available
      }
    } catch {
      // Error creating share link
    } finally {
      isCreating.value = false;
    }
  });

  const handleCopy = $(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl.value);
      copied.value = true;
      setTimeout(() => {
        copied.value = false;
      }, 2000);
    } catch {
      // Clipboard API may not be available
    }
  });

  const handleSaveLabel = $(async () => {
    if (!shareId.value || isSavingLabel.value) return;
    isSavingLabel.value = true;
    try {
      await updateShareLabel(shareId.value, labelInput.value);
      labelSaved.value = true;
      setTimeout(() => {
        labelSaved.value = false;
      }, 2000);
    } catch {
      // Error saving label
    } finally {
      isSavingLabel.value = false;
    }
  });

  return (
    <div class="relative">
      <Button
        variant="neutral"
        disabled={isCreating.value}
        onClick$={handleShare}
      >
        <LuShare2 class="size-4" />
        {isCreating.value ? "Sharing..." : "Share"}
      </Button>

      {isOpen.value && (
        <>
          {/* Backdrop -- closes popover on tap outside */}
          <div
            class="fixed inset-0 z-10"
            onClick$={() => (isOpen.value = false)}
          />

          {/* Popover -- full-width on mobile, positioned on desktop */}
          <div class="rounded-base border-border bg-background shadow-shadow fixed left-2 right-2 z-20 mt-2 border-2 p-4 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:w-80">
            {/* Close button */}
            <div class="mb-3 flex items-center justify-between">
              <span class="text-sm font-bold">Share Link Created</span>
              <button
                type="button"
                class="text-foreground/50 hover:text-foreground text-lg leading-none"
                onClick$={() => (isOpen.value = false)}
              >
                &times;
              </button>
            </div>

            {/* Share URL + Copy */}
            <div class="mb-3 flex gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl.value}
                class="rounded-base border-border bg-secondary-background min-w-0 flex-1 border-2 px-2 py-1.5 text-xs"
                onClick$={(e) =>
                  (e.target as HTMLInputElement).select()
                }
              />
              <Button
                size="sm"
                variant="default"
                onClick$={handleCopy}
              >
                {copied.value ? "Copied!" : "Copy"}
              </Button>
            </div>

            {/* Optional label */}
            <div class="border-border border-t-2 pt-3">
              <label for="share-label" class="text-sm font-bold">
                Label (optional)
              </label>
              <p class="text-foreground/50 mb-1 text-xs">
                Name this link to find it later, e.g. "Discord"
              </p>
              <div class="flex gap-2">
                <input
                  id="share-label"
                  type="text"
                  placeholder="e.g. For Discord"
                  value={labelInput.value}
                  onInput$={(e) =>
                    (labelInput.value = (e.target as HTMLInputElement).value)
                  }
                  class="rounded-base border-border bg-background focus:border-main min-w-0 flex-1 border-2 px-2 py-1.5 text-sm focus:outline-none"
                />
                <Button
                  size="sm"
                  variant="neutral"
                  disabled={isSavingLabel.value}
                  onClick$={handleSaveLabel}
                >
                  {labelSaved.value
                    ? "Saved!"
                    : isSavingLabel.value
                      ? "..."
                      : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
});
