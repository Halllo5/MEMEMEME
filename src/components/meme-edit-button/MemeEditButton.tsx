import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { server$, useNavigate } from "@builder.io/qwik-city";
import { LuPencil } from "@qwikest/icons/lucide";
import type { PrivacyLevel } from "~/db/db";
import { db } from "~/db/db";
import { BUCKET_NAME, s3 } from "~/lib/s3";
import { Button } from "~/components/button";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

interface MemeEditButtonProps {
  memeId: string;
  uploaderId: string;
  caption: string | null;
  privacy: PrivacyLevel;
}

export const updateCaption = server$(async function (
  memeId: string,
  newCaption: string,
) {
  const session = this.sharedMap.get("session");
  if (!session?.user) {
    throw new Error("Not authenticated");
  }

  const meme = await db
    .selectFrom("memes")
    .select("user_id")
    .where("id", "=", memeId)
    .executeTakeFirst();

  if (!meme || meme.user_id !== session.user.id) {
    throw new Error("Not authorized to edit this meme");
  }

  await db
    .updateTable("memes")
    .set({ caption: newCaption })
    .where("id", "=", memeId)
    .execute();

  return { success: true };
});

export const updatePrivacy = server$(async function (
  memeId: string,
  newPrivacy: PrivacyLevel,
) {
  const session = this.sharedMap.get("session");
  if (!session?.user) {
    throw new Error("Not authenticated");
  }

  const meme = await db
    .selectFrom("memes")
    .select("user_id")
    .where("id", "=", memeId)
    .executeTakeFirst();

  if (!meme || meme.user_id !== session.user.id) {
    throw new Error("Not authorized to edit this meme");
  }

  await db
    .updateTable("memes")
    .set({ privacy: newPrivacy })
    .where("id", "=", memeId)
    .execute();

  return { success: true };
});

export const deleteMeme = server$(async function (memeId: string) {
  const session = this.sharedMap.get("session");
  if (!session?.user) {
    throw new Error("Not authenticated");
  }

  const meme = await db
    .selectFrom("memes")
    .select(["user_id", "image_url"])
    .where("id", "=", memeId)
    .executeTakeFirst();

  if (!meme || meme.user_id !== session.user.id) {
    throw new Error("Not authorized to delete this meme");
  }

  const imageUrl = meme.image_url;
  if (imageUrl) {
    const orgKey = `${imageUrl}.org`;
    const optKey = `${imageUrl}.opt`;
    await Promise.all([
      s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: orgKey })),
      s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: optKey })),
    ]);
  }

  await db.deleteFrom("memes").where("id", "=", memeId).execute();

  return { success: true };
});

export const getMemePrivacy = server$(async function (memeId: string) {
  const session = this.sharedMap.get("session");
  if (!session?.user) return null;

  const meme = await db
    .selectFrom("memes")
    .select(["privacy", "user_id"])
    .where("id", "=", memeId)
    .executeTakeFirst();

  if (!meme || meme.user_id !== session.user.id) return null;
  return meme.privacy;
});

export const MemeEditButton = component$<MemeEditButtonProps>((props) => {
  const { memeId, caption, privacy } = props;
  const navigate = useNavigate();
  const captionInput = useSignal(caption ?? "");
  const privacySelect = useSignal<PrivacyLevel | null>(null);

  useVisibleTask$(async () => {
    const actualPrivacy = await getMemePrivacy(memeId);
    if (actualPrivacy) {
      privacySelect.value = actualPrivacy;
    } else {
      privacySelect.value = privacy ?? "public";
    }
  });

  const isUpdatingCaption = useSignal(false);
  const isUpdatingPrivacy = useSignal(false);
  const isDeleting = useSignal(false);

  return (
    <div class="group relative">
      <button
        type="button"
        class="border-border shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY rounded-base bg-main text-main-foreground flex items-center gap-2 border-2 px-4 py-2 transition-all hover:shadow-none"
      >
        <LuPencil class="size-4" />
        Edit
      </button>
      <div class="rounded-base border-border bg-background shadow-shadow absolute top-full right-0 z-10 mt-2 hidden min-w-64 border-2 p-4 group-focus-within:block group-hover:block">
        {/* Rename */}
        <div class="mb-4">
          <label for="edit-caption" class="text-sm font-bold">
            Caption
          </label>
          <input
            id="edit-caption"
            type="text"
            value={captionInput.value}
            onInput$={(e) =>
              (captionInput.value = (e.target as HTMLInputElement).value)
            }
            class="rounded-base border-border bg-background shadow-shadow focus:border-main mt-1 block w-full border-2 p-2 focus:outline-none"
          />
          <Button
            class="mt-2 w-full"
            disabled={isUpdatingCaption.value}
            onClick$={async () => {
              isUpdatingCaption.value = true;
              try {
                const res = await updateCaption(memeId, captionInput.value);
                if (res.success) {
                  window.location.reload();
                }
              } catch {
                isUpdatingCaption.value = false;
              }
            }}
          >
            {isUpdatingCaption.value ? "Saving..." : "Save Caption"}
          </Button>
        </div>

        {/* Privacy */}
        <div class="mb-4">
          <label for="edit-privacy" class="text-sm font-bold">
            Privacy
          </label>
          <div class="relative mt-1">
            <select
              id="edit-privacy"
              value={privacySelect.value ?? privacy ?? "public"}
              onInput$={(e) =>
                (privacySelect.value = (e.target as HTMLSelectElement)
                  .value as PrivacyLevel)
              }
              class="rounded-base border-border bg-background shadow-shadow focus:border-main block w-full appearance-none border-2 p-2 focus:outline-none"
            >
              <option value="buddies_only">Buddies Only</option>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
            <div class="text-foreground pointer-events-none absolute inset-y-0 right-0 flex items-center px-3">
              <svg
                class="size-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            </div>
          </div>
          <Button
            class="mt-2 w-full"
            variant="neutral"
            disabled={isUpdatingPrivacy.value}
            onClick$={async () => {
              isUpdatingPrivacy.value = true;
                try {
                  const val = privacySelect.value ?? privacy ?? "public";
                  const res = await updatePrivacy(memeId, val);
                if (res.success) {
                  window.location.reload();
                }
              } catch {
                isUpdatingPrivacy.value = false;
              }
            }}
          >
            {isUpdatingPrivacy.value ? "Saving..." : "Save Privacy"}
          </Button>
        </div>

        {/* Delete */}
        <div class="border-border border-t-2 pt-4">
          <Button
            variant="neutral"
            class="w-full"
            disabled={isDeleting.value}
            onClick$={async () => {
              if (!confirm("Are you sure you want to delete this meme?")) {
                return;
              }
              isDeleting.value = true;
              try {
                const res = await deleteMeme(memeId);
                if (res.success) {
                  await navigate("/");
                }
              } catch {
                isDeleting.value = false;
              }
            }}
          >
            {isDeleting.value ? "Deleting..." : "Delete Meme"}
          </Button>
        </div>
      </div>
    </div>
  );
});
