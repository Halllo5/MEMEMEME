import { component$, useSignal } from "@builder.io/qwik";
import { Link, server$ } from "@builder.io/qwik-city";
import { LuArrowRight } from "@qwikest/icons/lucide";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db } from "~/db/db";
import { applyMemeFeedVisibility } from "~/lib/permissions";
import { BUCKET_NAME, s3 } from "~/lib/s3";

export interface ImageCardProps {
  imageUrl: string;
  caption?: string;
  uploaderName: string;
  uploaderImageUrl?: string;
  uploaderLink?: string;
  imageId?: string;
}

export const refreshImageUrl = server$(async function (imageId: string) {
  const session = this.sharedMap.get("session");
  if (!imageId) return null;

  let query = db
    .selectFrom("memes")
    .select("image_url")
    .where("id", "=", imageId);

  query = applyMemeFeedVisibility(query, session);

  const meme = await query.executeTakeFirst();

  if (!meme || !meme.image_url) return null;

  const s3Key = `${meme.image_url}.opt`;
  const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key });
  const presignedImageUrl = await getSignedUrl(s3, command, {
    expiresIn: 60 * 5,
  });

  return presignedImageUrl;
});

export const ImageCard = component$<ImageCardProps>(
  ({
    imageUrl,
    caption,
    uploaderName,
    uploaderImageUrl,
    uploaderLink = "#",
    imageId,
  }) => {
    const uploaderInitial = uploaderName?.substring(0, 2);
    const profilePicHasError = useSignal(false);
    const currentImageUrl = useSignal(imageUrl);
    const retryCount = useSignal(0);

    return (
      <div class="rounded-base border-border bg-background shadow-shadow block h-auto overflow-hidden border-2">
        {/* Main Image */}
        <div class="bg-secondary-background">
          <Link href={`/meme/${imageId}`}>
            {/* eslint-disable-next-line qwik/jsx-img */}
            <img
              src={currentImageUrl.value}
              alt={caption || `Uploaded by ${uploaderName}`}
              class="h-auto w-full"
              loading="lazy"
              onError$={async () => {
                if (retryCount.value < 3 && imageId) {
                  retryCount.value++;
                  const newUrl = await refreshImageUrl(imageId);
                  if (newUrl) {
                    currentImageUrl.value = newUrl;
                  }
                }
              }}
            />
          </Link>

          <div />

          {/* Bottom Bar */}
          <div class="bg-main flex flex-row items-center justify-between gap-4 p-2">
            {/* Uploader Info */}
            <Link
              href={uploaderLink}
              class="group flex min-w-0 items-center gap-3"
              preventdefault:click
            >
              {uploaderImageUrl && !profilePicHasError.value ? (
                <img
                  src={uploaderImageUrl}
                  alt=""
                  width={32}
                  height={32}
                  class="border-border rounded-base h-8 w-8 shrink-0 border-2 object-cover"
                  loading="lazy"
                  onError$={() => (profilePicHasError.value = true)}
                />
              ) : (
                <div class="border-border bg-main text-main-foreground rounded-base flex h-8 w-8 shrink-0 items-center justify-center border-2 text-sm font-bold">
                  {uploaderInitial}
                </div>
              )}
              <span class="truncate font-bold group-hover:underline">
                {uploaderName}
              </span>
            </Link>

            {/* Caption on the right */}
            {
              <Link
                href={`/meme/${imageId}`}
                class="group flex items-center gap-2"
              >
                <p class="truncate text-right text-sm group-hover:underline">
                  {caption}
                </p>
                <LuArrowRight class="h-8 w-auto" />
              </Link>
            }
          </div>
        </div>
      </div>
    );
  },
);
